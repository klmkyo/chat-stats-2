//! Database helper functions for messenger imports.
//!
//! Contains upsert functions to avoid duplicate user and conversation creation.

use anyhow::{Context, Result};

use crate::database::{ConversationType, WriteBatch};
use crate::importers::messenger::ImportState;

/// Either inserts a user or returns the ID of an existing user.
pub fn upsert_user(
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
    user_name: &str,
) -> Result<i64> {
    if let Some(&id) = state.user_ids.get(user_name) {
        Ok(id)
    } else {
        let id = state.next_user_id;
        state.next_user_id += 1;
        batch
            .insert_user(Some(id), Some(user_name), None)
            .with_context(|| format!("inserting user: {}", user_name))?;
        state.user_ids.insert(user_name.to_string(), id);
        Ok(id)
    }
}

/// Either inserts a conversation or returns the ID of an existing conversation.
///
/// This function handles the logic for creating conversations with proper deduplication
/// based on folder/thread names. It automatically determines conversation type based
/// on participant count and sets the appropriate export source.
pub fn upsert_conversation(
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
    folder_name: &str,
    participant_count: usize,
    image_uri: Option<&str>,
    title: Option<&str>,
    export_source: &str,
) -> Result<i64> {
    // Check if this conversation was already created in this import session
    if let Some(&conv_id) = state.folder_names_to_conv_ids.get(folder_name) {
        // Conversation already exists in our current state, just return the ID
        return Ok(conv_id);
    }

    let ctype = if participant_count == 2 {
        ConversationType::DM
    } else {
        ConversationType::Group
    };

    let conv_id = state.next_conv_id;
    state.next_conv_id += 1;
    state
        .folder_names_to_conv_ids
        .insert(folder_name.to_string(), conv_id);

    batch
        .insert_conversation(conv_id, ctype, image_uri, title, export_source)
        .with_context(|| format!("insert conversation {}", conv_id))?;

    Ok(conv_id)
}
