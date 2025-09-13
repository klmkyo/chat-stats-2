//! End-to-End (E2E) Messenger export format parser.
//!
//! Handles the newer Facebook Messenger end-to-end encrypted export format,
//! which uses a different structure and JSON schema than the legacy format.

use crate::importers::messenger::utils::{upsert_conversation, upsert_user};
use crate::utils::audio::detect_duration_seconds;
use crate::{
    database::WriteBatch, importers::messenger::formats::e2e::json::E2eExportRoot,
    importers::messenger::ImportState,
};
use anyhow::{Context, Result};
use std::io::{Read, Seek};
use zip::read::ZipArchive;

pub mod json;

/// Detect if a ZIP archive is the new E2E format: root contains json files and a `media/` dir.
pub fn is_e2e_archive<R: Seek + Read>(archive: &ZipArchive<R>) -> bool {
    let mut has_media = false;
    let mut has_root_json = false;
    for name in archive.file_names() {
        if name.starts_with("media/") {
            has_media = true;
        }
        if !name.contains('/') && name.ends_with(".json") {
            has_root_json = true;
        }
        if has_media && has_root_json {
            return true;
        }
    }
    false
}

/// Import an E2E-format ZIP archive.
pub fn import_e2e_archive<R: Seek + Read>(
    archive: &mut ZipArchive<R>,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    // Iterate root-level JSON files.
    let root_jsons: Vec<String> = archive
        .file_names()
        .filter(|name| !name.contains('/') && name.ends_with(".json"))
        .map(|s| s.to_string())
        .collect();

    for json_path in root_jsons {
        let mut json_content = String::new();
        {
            let mut f = archive
                .by_name(&json_path)
                .with_context(|| format!("open {}", json_path))?;
            f.read_to_string(&mut json_content)
                .with_context(|| format!("read {}", json_path))?;
        }

        import_e2e_json(archive, &json_content, batch, state)?;
    }
    Ok(())
}

/// Classify media by file extension.
fn classify_media(uri: &str) -> &'static str {
    let ext = std::path::Path::new(uri)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase());
    match ext.as_deref() {
        Some("mp3" | "m4a" | "aac" | "wav" | "ogg" | "oga" | "opus" | "flac") => "audio",
        Some("mp4" | "mov" | "mkv" | "webm") => "video",
        Some("gif") => "gif",
        Some("jpg" | "jpeg" | "png" | "webp" | "heic" | "heif") => "image",
        _ => "image",
    }
}

/// Import a single E2E JSON content.
pub fn import_e2e_json<R: Seek + Read>(
    archive: &mut ZipArchive<R>,
    json_content: &str,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    let parsed: E2eExportRoot = serde_json::from_str(json_content).context("parsing e2e json")?;

    // Ensure users
    for name in &parsed.participants {
        upsert_user(batch, state, name)?;
    }

    // Create conversation with E2E export source
    // Thread names have the "Name Surname_X" format, where X is some number. We want
    // to remove the _X.
    let thread_name = parsed
        .thread_name
        .split('_')
        .next()
        .unwrap_or(&parsed.thread_name);

    let conv_id = upsert_conversation(
        batch,
        state,
        &parsed.thread_name,
        parsed.participants.len(),
        None,
        Some(thread_name),
        "messenger:e2e",
    )?;

    // Collect audio URIs (if we can probe durations from zip)
    let mut audio_uris: Vec<String> = Vec::new();
    for m in &parsed.messages {
        for media in &m.media {
            if classify_media(&media.uri) == "audio" {
                audio_uris.push(media.uri.clone());
            }
        }
    }

    for m in parsed.messages {
        if m.is_unsent {
            continue;
        }

        // Sender
        let sender_id = upsert_user(batch, state, &m.sender_name)?;

        // Timestamp: detect seconds vs ms
        let mut sent_at = m.timestamp;
        if sent_at > 1_000_000_000_000 {
            // treat as ms
            sent_at /= 1000;
        }

        let msg_id = state.next_msg_id;
        state.next_msg_id += 1;
        batch
            .insert_message(msg_id, sender_id, conv_id, sent_at)
            .context("insert base e2e msg")?;

        if !m.text.trim().is_empty() {
            batch
                .add_message_text(msg_id, &m.text)
                .context("attach text")?;
        }
        for media in m.media {
            match classify_media(&media.uri) {
                "audio" => {
                    let len_opt = match archive.by_name(&media.uri) {
                        Ok(mut f) => detect_duration_seconds(&media.uri, &mut f),
                        Err(_) => None,
                    };
                    batch
                        .add_message_audio(msg_id, &media.uri, len_opt)
                        .context("attach audio")?;
                }
                "video" => {
                    batch
                        .add_message_video(msg_id, &media.uri)
                        .context("attach video")?;
                }
                "gif" => {
                    batch
                        .add_message_gif(msg_id, &media.uri)
                        .context("attach gif")?;
                }
                _ => {
                    batch
                        .add_message_image(msg_id, &media.uri)
                        .context("attach image")?;
                }
            }
        }

        for r in m.reactions {
            let reactor_id = upsert_user(batch, state, &r.actor)?;
            batch
                .insert_reaction(reactor_id, msg_id, &r.reaction)
                .context("insert reaction")?;
        }
    }

    Ok(())
}
