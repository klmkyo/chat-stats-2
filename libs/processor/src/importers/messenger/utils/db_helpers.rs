//! Database helper functions for messenger imports.
//!
//! Contains helpers to create conversations and per-conversation persons with canonical links.

use anyhow::{Context, Result};

use crate::database::{ConversationType, WriteBatch};
use crate::importers::messenger::ImportState;

/// Create or get a conversation by folder/thread name within a single import run.
pub fn ensure_conversation(
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
    folder_name: &str,
    participant_count: usize,
    image_uri: Option<&str>,
    title: Option<&str>,
    export_id: i64,
) -> Result<i64> {
    if let Some(&conv_id) = state.folder_names_to_conv_ids.get(folder_name) {
        return Ok(conv_id);
    }

    let ctype = if participant_count == 2 {
        ConversationType::DM
    } else {
        ConversationType::Group
    };

    let canon_id = batch
        .insert_canonical_conversation(ctype, title)
        .context("insert canonical_conversation")?;
    let conv_id = batch
        .insert_conversation(ctype, image_uri, title, export_id, canon_id)
        .context("insert conversation")?;

    state
        .folder_names_to_conv_ids
        .insert(folder_name.to_string(), conv_id);
    Ok(conv_id)
}

/// Create or get a per-conversation person by name.
pub fn ensure_person_in_conversation(
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
    conversation_id: i64,
    user_name: &str,
) -> Result<i64> {
    let entry = state
        .person_ids_by_conversation
        .entry(conversation_id)
        .or_default();
    if let Some(&uid) = entry.get(user_name) {
        return Ok(uid);
    }

    let canon_id = batch
        .insert_canonical_person(Some(user_name), None)
        .with_context(|| format!("insert canonical_person: {}", user_name))?;
    let person_id = batch
        .insert_person(conversation_id, Some(user_name), None, canon_id)
        .with_context(|| format!("insert person in conv {}: {}", conversation_id, user_name))?;
    entry.insert(user_name.to_string(), person_id);
    Ok(person_id)
}
