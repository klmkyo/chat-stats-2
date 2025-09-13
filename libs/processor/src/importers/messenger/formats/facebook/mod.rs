//! Facebook Messenger export format parser.
//!
//! Handles the legacy Facebook Messenger export format, including
//! encoding fixes and thread import functionality.

use std::io::Read;
use std::path::PathBuf;

use anyhow::{Context, Result};
use serde_json;
use zip::ZipArchive;

use crate::database::WriteBatch;
use crate::importers::messenger::utils::{upsert_conversation, upsert_user};
use crate::importers::messenger::ImportState;
use crate::utils::audio::detect_duration_seconds;

pub mod json;
pub mod paths;

use json::FacebookExportRoot;

/// Import a Facebook Messenger ZIP archive.
pub fn import_facebook_archive<R: std::io::Seek + std::io::Read>(
    archive: &mut ZipArchive<R>,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    let is_messages_re = &paths::MESSAGES_RE;
    let entries = paths::collect_message_entries(archive, is_messages_re);
    for (_thread_dir, _num, json_path) in entries.into_iter() {
        let mut json_content = String::new();
        {
            let mut file = archive
                .by_name(&json_path)
                .with_context(|| format!("opening {}", json_path))?;
            file.read_to_string(&mut json_content)
                .with_context(|| format!("reading {}", json_path))?;
        }

        let parsed: FacebookExportRoot = serde_json::from_str(&json_content)
            .with_context(|| format!("parsing {}", json_path))?;
        let parsed = crate::importers::messenger::utils::encoding::fix_encoding(parsed);

        let path: PathBuf = json_path.clone().into();
        let folder_name_cow = path
            .parent()
            .unwrap()
            .file_name()
            .unwrap()
            .to_string_lossy();

        let folder_name = folder_name_cow.as_ref();
        let thread_dir_path = path.parent().unwrap().to_string_lossy();
        import_thread(
            archive,
            folder_name,
            &thread_dir_path,
            &parsed,
            batch,
            state,
        )?;
    }
    Ok(())
}

/// Import a single Facebook Messenger thread.
pub fn import_thread<R: std::io::Seek + std::io::Read>(
    archive: &mut ZipArchive<R>,
    folder_name: &str,
    _thread_dir_path: &str,
    parsed: &FacebookExportRoot,
    batch: &mut WriteBatch<'_>,
    state: &mut crate::importers::messenger::ImportState,
) -> Result<()> {
    // Ensure users (participants)
    for p in &parsed.participants {
        upsert_user(batch, state, p.name.as_str())?;
    }

    // Create conversation with Facebook export source
    let image_uri = parsed.image.as_ref().map(|i| i.uri.as_str());
    let conv_id = upsert_conversation(
        batch,
        state,
        folder_name,
        parsed.participants.len(),
        image_uri,
        Some(&parsed.title),
        "messenger:facebook",
    )?;

    // Messages
    for m in parsed.messages.iter().rev() {
        if m.is_unsent.unwrap_or(false) || m.is_geoblocked_for_viewer {
            continue;
        }

        // sender id
        let sender_id = upsert_user(batch, state, &m.sender_name)?;

        let sent_at = m.timestamp_ms / 1000;

        enum Variant<'a> {
            Text(&'a str),
            Image(&'a str),
            Gif(&'a str),
            Audio(&'a str),
            Video(&'a str),
        }
        let mut variants: Vec<Variant<'_>> = Vec::new();

        if let Some(text) = m.content.as_deref() {
            if !text.trim().is_empty() {
                variants.push(Variant::Text(text));
            }
        }
        if let Some(sticker) = m.sticker.as_ref() {
            variants.push(Variant::Image(sticker.uri.as_str()));
        }
        if let Some(photos) = m.photos.as_ref() {
            for p in photos {
                variants.push(Variant::Image(p.uri.as_str()));
            }
        }
        if let Some(videos) = m.videos.as_ref() {
            for v in videos {
                variants.push(Variant::Video(v.uri.as_str()));
            }
        }
        if let Some(gifs) = m.gifs.as_ref() {
            for g in gifs {
                variants.push(Variant::Gif(g.uri.as_str()));
            }
        }
        if let Some(audios) = m.audio_files.as_ref() {
            for a in audios {
                variants.push(Variant::Audio(a.uri.as_str()));
            }
        }
        if let Some(share) = m.share.as_ref() {
            if let Some(text) = share.share_text.as_deref() {
                if !text.trim().is_empty() {
                    variants.push(Variant::Text(text));
                }
            } else if let Some(link) = share.link.as_deref() {
                variants.push(Variant::Text(link));
            }
        }
        if variants.is_empty() {
            continue;
        }

        // Create a single base message row.
        let msg_id = state.next_msg_id;
        state.next_msg_id += 1;
        batch
            .insert_message(msg_id, sender_id, conv_id, sent_at)
            .with_context(|| format!("insert base msg {}, conv_id {}", msg_id, conv_id))?;

        // Attach all variants to this message.
        for v in variants.iter() {
            match v {
                Variant::Text(t) => batch
                    .add_message_text(msg_id, t)
                    .with_context(|| format!("attach text to msg {}", msg_id))?,
                Variant::Image(u) => batch
                    .add_message_image(msg_id, u)
                    .with_context(|| format!("attach image to msg {}", msg_id))?,
                Variant::Gif(u) => batch
                    .add_message_gif(msg_id, u)
                    .with_context(|| format!("attach gif to msg {}", msg_id))?,
                Variant::Audio(u) => {
                    // Prefer current ZIP; fall back to global media index by full pathname
                    let len_opt = if let Ok(mut f) = archive.by_name(u) {
                        detect_duration_seconds(u, &mut f)
                    } else {
                        state
                            .file_index
                            .with_file(u, |r| detect_duration_seconds(u, r))
                            .unwrap_or(None)
                    };
                    batch
                        .add_message_audio(msg_id, u, len_opt)
                        .with_context(|| format!("attach audio to msg {}", msg_id))?
                }
                Variant::Video(u) => batch
                    .add_message_video(msg_id, u)
                    .with_context(|| format!("attach video to msg {}", msg_id))?,
            }
        }

        if let (pid, Some(reactions)) = (msg_id, m.reactions.as_ref()) {
            for r in reactions {
                let reactor_id = upsert_user(batch, state, &r.actor)?;
                batch
                    .insert_reaction(reactor_id, pid, &r.reaction)
                    .with_context(|| format!("insert reaction on msg {}", pid))?;
            }
        }
    }
    Ok(())
}
