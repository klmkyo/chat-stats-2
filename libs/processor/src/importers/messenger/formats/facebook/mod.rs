//! Facebook Messenger export format parser.
//!
//! Handles the legacy Facebook Messenger export format, including
//! encoding fixes and thread import functionality.

use std::collections::HashMap;
use std::io::Read;

use anyhow::{Context, Result};
use serde_json;
use zip::ZipArchive;

use crate::database::{ConversationType, WriteBatch};
use crate::importers::messenger::ImportState;

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
        let mut file = archive
            .by_name(&json_path)
            .with_context(|| format!("opening {}", json_path))?;

        let mut json_content = String::new();
        file.read_to_string(&mut json_content)
            .with_context(|| format!("reading {}", json_path))?;

        let parsed: FacebookExportRoot = serde_json::from_str(&json_content)
            .with_context(|| format!("parsing {}", json_path))?;
        let parsed = crate::importers::messenger::utils::encoding::fix_encoding(parsed);

        import_thread(
            batch,
            &mut state.user_ids,
            &mut state.next_user_id,
            &mut state.conv_ids,
            &mut state.next_conv_id,
            &mut state.next_msg_id,
            &parsed,
        )?;
    }
    Ok(())
}

/// Import a single Facebook Messenger thread.
pub fn import_thread(
    batch: &mut WriteBatch<'_>,
    user_ids: &mut HashMap<String, i64>,
    next_user_id: &mut i64,
    conv_ids: &mut HashMap<String, i64>,
    next_conv_id: &mut i64,
    next_msg_id: &mut i64,
    parsed: &FacebookExportRoot,
) -> Result<()> {
    // Ensure users (participants)
    for p in &parsed.participants {
        if !user_ids.contains_key(&p.name) {
            let id = *next_user_id;
            *next_user_id += 1;
            batch
                .insert_user(Some(id), Some(&p.name), None)
                .with_context(|| format!("inserting user: {}", p.name))?;
            user_ids.insert(p.name.clone(), id);
        }
    }

    // Conversation per thread_path
    let conv_key = parsed.thread_path.clone();
    let conv_id = if let Some(&cid) = conv_ids.get(&conv_key) {
        cid
    } else {
        let cid = *next_conv_id;
        *next_conv_id += 1;
        let ctype = if parsed.participants.len() == 2 {
            ConversationType::DM
        } else {
            ConversationType::Group
        };
        let image_uri = parsed.image.as_ref().map(|i| i.uri.as_str());
        let title = Some(parsed.title.as_str());
        batch
            .insert_conversation(cid, ctype, image_uri, title)
            .with_context(|| format!("insert conversation {} ({})", cid, conv_key))?;
        conv_ids.insert(conv_key.clone(), cid);
        cid
    };

    // Messages
    for m in parsed.messages.iter().rev() {
        if m.is_unsent.unwrap_or(false) || m.is_geoblocked_for_viewer {
            continue;
        }

        // sender id
        let sender_id = if let Some(&id) = user_ids.get(&m.sender_name) {
            id
        } else {
            let id = *next_user_id;
            *next_user_id += 1;
            batch
                .insert_user(Some(id), Some(&m.sender_name), None)
                .with_context(|| format!("inserting user: {}", m.sender_name))?;
            user_ids.insert(m.sender_name.clone(), id);
            id
        };

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
        let msg_id = *next_msg_id;
        *next_msg_id += 1;
        batch
            .insert_message(msg_id, sender_id, conv_id, sent_at)
            .with_context(|| format!("insert base msg {}", msg_id))?;

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
                Variant::Audio(u) => batch
                    .add_message_audio(msg_id, u, None)
                    .with_context(|| format!("attach audio to msg {}", msg_id))?,
                Variant::Video(u) => batch
                    .add_message_video(msg_id, u)
                    .with_context(|| format!("attach video to msg {}", msg_id))?,
            }
        }

        if let (pid, Some(reactions)) = (msg_id, m.reactions.as_ref()) {
            for r in reactions {
                let reactor_id = if let Some(&id) = user_ids.get(&r.actor) {
                    id
                } else {
                    let id = *next_user_id;
                    *next_user_id += 1;
                    batch
                        .insert_user(Some(id), Some(&r.actor), None)
                        .with_context(|| format!("inserting user: {}", r.actor))?;
                    user_ids.insert(r.actor.clone(), id);
                    id
                };
                batch
                    .insert_reaction(reactor_id, pid, &r.reaction)
                    .with_context(|| format!("insert reaction on msg {}", pid))?;
            }
        }
    }
    Ok(())
}
