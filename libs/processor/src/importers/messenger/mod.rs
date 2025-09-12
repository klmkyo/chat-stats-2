//! Messenger chat import functionality.
//!
//! Handles importing Facebook Messenger exports in various formats,
//! with support for both legacy and end-to-end encrypted chat exports.
//!
//! The import process is split into two stages:
//! 1. Discovery: Analyze exports to identify conversations and participants
//! 2. Import: Actually import data to database with optional merge instructions

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs::File, io::Read, path::Path, path::PathBuf};
use zip::read::ZipArchive;

use crate::{
    database::{ConversationType, MessageDb},
    importers::messenger::formats::facebook::json::FacebookExportRoot,
};

pub mod formats;
pub mod utils;

/// Importer state shared across multiple files/zips in a run.
pub struct ImportState {
    pub user_ids: HashMap<String, i64>,
    pub conv_ids: HashMap<String, i64>,
    pub next_user_id: i64,
    pub next_conv_id: i64,
    pub next_msg_id: i64,
    /// Merge instructions for combining conversations
    pub merges: HashMap<String, ConversationMerge>,
}

impl Default for ImportState {
    fn default() -> Self {
        Self::new()
    }
}

impl ImportState {
    pub fn new() -> Self {
        Self {
            user_ids: HashMap::new(),
            conv_ids: HashMap::new(),
            next_user_id: 1,
            next_conv_id: 1,
            next_msg_id: 1,
            merges: HashMap::new(),
        }
    }

    /// Create new ImportState with merge instructions.
    pub fn with_merges(merges: Vec<ConversationMerge>) -> Self {
        let mut merge_map = HashMap::new();

        // Map both Facebook and E2E IDs to the merge instruction
        for merge in merges {
            merge_map.insert(merge.facebook_id.clone(), merge.clone());
            merge_map.insert(merge.e2e_id.clone(), merge);
        }

        Self {
            user_ids: HashMap::new(),
            conv_ids: HashMap::new(),
            next_user_id: 1,
            next_conv_id: 1,
            next_msg_id: 1,
            merges: merge_map,
        }
    }

    /// Get the canonical conversation key, considering merges.
    ///
    /// If this conversation is part of a merge, returns the merged conversation's
    /// canonical key. Otherwise, returns the original key.
    pub fn get_conversation_key(&self, original_key: &str) -> String {
        if let Some(merge) = self.merges.get(original_key) {
            // Use a canonical form that combines both IDs for merged conversations
            format!("merged_{}_{}", merge.facebook_id, merge.e2e_id)
        } else {
            original_key.to_string()
        }
    }

    /// Get the title to use for a conversation, considering merges.
    pub fn get_conversation_title(&self, original_key: &str, default_title: &str) -> String {
        if let Some(merge) = self.merges.get(original_key) {
            merge.merged_title.clone()
        } else {
            default_title.to_string()
        }
    }
}

/// Represents a discovered participant in a conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredParticipant {
    /// Participant name
    pub name: String,
    /// Optional avatar/image URI
    pub image_uri: Option<String>,
}

/// Represents a discovered conversation from either Facebook or E2E format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredConversation {
    /// Unique identifier for this conversation within its format
    pub id: String,
    /// Export format this conversation was found in
    pub format: ExportFormat,
    /// Conversation title/name
    pub title: String,
    /// List of participants with metadata
    pub participants: Vec<DiscoveredParticipant>,
    /// Conversation type (DM or Group)
    pub conversation_type: ConversationType,
}

/// The export format a conversation was found in.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExportFormat {
    Facebook,
    E2E,
}

/// Results from the discovery stage of import.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryResult {
    /// Conversations found in Facebook format exports
    pub facebook_conversations: Vec<DiscoveredConversation>,
    /// Conversations found in E2E format exports
    pub e2e_conversations: Vec<DiscoveredConversation>,
}

/// Instructions for merging conversations during import.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMerge {
    /// ID of the Facebook conversation to merge
    pub facebook_id: String,
    /// ID of the E2E conversation to merge with
    pub e2e_id: String,
    /// The title to use for the merged conversation
    pub merged_title: String,
}

/// Determine the export format of a file path.
fn determine_export_format(path: &Path) -> Result<ExportFormat> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
    {
        let file = File::open(path)
            .with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
        let archive = ZipArchive::new(file)
            .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;

        if formats::e2e::is_e2e_archive(&archive) {
            Ok(ExportFormat::E2E)
        } else {
            Ok(ExportFormat::Facebook)
        }
    } else if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
    {
        // For JSON files, we'll guess based on filename and then validate by parsing
        guess_json_format(path)
    } else {
        Err(anyhow::anyhow!("Unsupported file type: {}", path.display()))
    }
}

/// Guess JSON format based on filename patterns.
fn guess_json_format(path: &Path) -> Result<ExportFormat> {
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");

    // E2E files are typically named like conversations or have specific patterns
    // Facebook files are typically message_X.json or in specific directory structures
    if filename.contains("message_") {
        Ok(ExportFormat::Facebook)
    } else {
        // Default to E2E for standalone JSON files, we'll validate when parsing
        Ok(ExportFormat::E2E)
    }
}

/// Discover conversations and participants from chat export files without importing.
///
/// This is the first stage of the two-stage import process. It analyzes the provided
/// export files and returns metadata about all discovered conversations, allowing
/// the consumer to decide which conversations should be merged.
///
/// # Arguments
/// * `paths` - List of file paths to analyze (ZIP archives or JSON files)
///
/// # Returns
/// A `DiscoveryResult` containing all discovered conversations from both formats.
pub fn discover_conversations(paths: Vec<PathBuf>) -> Result<DiscoveryResult> {
    let mut facebook_conversations = Vec::new();
    let mut e2e_conversations = Vec::new();

    for path in paths {
        let format = determine_export_format(&path)?;

        match format {
            ExportFormat::Facebook => {
                let mut conversations = discover_facebook_from_path(&path)?;
                facebook_conversations.append(&mut conversations);
            }
            ExportFormat::E2E => {
                let mut conversations = discover_e2e_from_path(&path)?;
                e2e_conversations.append(&mut conversations);
            }
        }
    }

    Ok(DiscoveryResult {
        facebook_conversations,
        e2e_conversations,
    })
}

/// Discover Facebook conversations from a single path (ZIP or JSON).
fn discover_facebook_from_path(path: &Path) -> Result<Vec<DiscoveredConversation>> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
    {
        let file = File::open(path)
            .with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
        let mut archive = ZipArchive::new(file)
            .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
        discover_facebook_archive(&mut archive)
    } else {
        let json_content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read JSON file: {}", path.display()))?;

        match serde_json::from_str::<FacebookExportRoot>(&json_content) {
            Ok(parsed) => {
                let parsed = utils::encoding::fix_encoding(parsed);
                let conversation = discover_facebook_thread(&parsed);
                Ok(vec![conversation])
            }
            Err(e) => Err(anyhow::anyhow!("Failed to parse Facebook JSON: {}", e)),
        }
    }
}

/// Discover E2E conversations from a single path (ZIP or JSON).
fn discover_e2e_from_path(path: &Path) -> Result<Vec<DiscoveredConversation>> {
    if path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
    {
        let file = File::open(path)
            .with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
        let mut archive = ZipArchive::new(file)
            .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
        discover_e2e_archive(&mut archive)
    } else {
        let json_content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read JSON file: {}", path.display()))?;

        let json_filename = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown.json");

        // Try E2E format first (since we guessed this), fallback to Facebook format
        match discover_e2e_json(&json_content, json_filename) {
            Ok(conversation) => Ok(vec![conversation]),
            Err(_) => {
                // Fallback: try Facebook format
                match serde_json::from_str::<FacebookExportRoot>(&json_content) {
                    Ok(parsed) => {
                        let parsed = utils::encoding::fix_encoding(parsed);
                        let conversation = discover_facebook_thread(&parsed);
                        Ok(vec![conversation])
                    }
                    Err(e) => Err(anyhow::anyhow!(
                        "Failed to parse as either E2E or Facebook JSON: {}",
                        e
                    )),
                }
            }
        }
    }
}

/// Import multiple chat export files into a SQLite database.
///
/// This is the second stage of the two-stage import process. It accepts the same
/// file paths as the discovery stage, plus optional merge instructions for combining
/// conversations that were identified as duplicates during discovery.
///
/// # Arguments
/// * `paths` - List of file paths to import (ZIP archives or JSON files)
/// * `db_path` - Path where the SQLite database should be created/updated
/// * `merges` - Optional list of conversation merge instructions
pub fn import_to_database(
    paths: Vec<PathBuf>,
    db_path: &Path,
    merges: Option<Vec<ConversationMerge>>,
) -> Result<()> {
    let mut db = MessageDb::open(db_path)
        .with_context(|| format!("Failed to open SQLite database: {}", db_path.display()))?;
    let mut batch = db
        .begin_write()
        .context("Failed to begin database write transaction")?;

    let mut state = if let Some(merge_list) = merges {
        ImportState::with_merges(merge_list)
    } else {
        ImportState::new()
    };

    for p in paths {
        if p.extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case("zip"))
            .unwrap_or(false)
        {
            let file = File::open(&p)
                .with_context(|| format!("Failed to open ZIP file: {}", p.display()))?;
            let mut archive = ZipArchive::new(file)
                .with_context(|| format!("Failed to read ZIP archive: {}", p.display()))?;
            if formats::e2e::is_e2e_archive(&archive) {
                formats::e2e::import_e2e_archive(&mut archive, &mut batch, &mut state)?;
            } else {
                formats::facebook::import_facebook_archive(&mut archive, &mut batch, &mut state)?;
            }
        } else if p
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case("json"))
            .unwrap_or(false)
        {
            let json_content = std::fs::read_to_string(&p)
                .with_context(|| format!("Failed to read JSON file: {}", p.display()))?;

            // Try old format first; if it fails, try e2e format.
            match serde_json::from_str::<FacebookExportRoot>(&json_content) {
                Ok(parsed_old) => {
                    let parsed_old = utils::encoding::fix_encoding(parsed_old);
                    formats::facebook::import_thread(&parsed_old, &mut batch, &mut state)?;
                }
                Err(_) => {
                    formats::e2e::import_e2e_json(&json_content, &mut batch, &mut state)?;
                }
            }
        } else {
            return Err(anyhow::anyhow!("Unsupported file type: {}", p.display()));
        }
    }

    batch
        .commit()
        .context("Failed to commit database transaction")?;
    Ok(())
}

/// Discover conversations from a Facebook Messenger ZIP archive.
fn discover_facebook_archive<R: std::io::Seek + std::io::Read>(
    archive: &mut ZipArchive<R>,
) -> Result<Vec<DiscoveredConversation>> {
    let is_messages_re = &formats::facebook::paths::MESSAGES_RE;
    let entries = formats::facebook::paths::collect_message_entries(archive, is_messages_re);

    // Group entries by thread directory to aggregate per conversation
    let mut conversations_map: HashMap<String, Vec<(i64, String)>> = HashMap::new();
    for (thread_dir, num, json_path) in entries {
        conversations_map
            .entry(thread_dir)
            .or_default()
            .push((num, json_path));
    }

    // First, read all file contents to avoid borrowing issues
    let mut thread_data: HashMap<String, (Vec<String>, String)> = HashMap::new(); // thread_dir -> (file contents, first file content for metadata)

    for (thread_dir, json_files) in &conversations_map {
        let mut json_files = json_files.clone();
        json_files.sort_by_key(|(num, _)| *num);

        let mut file_contents = Vec::new();
        let mut first_file_content = String::new();

        for (i, (_, json_path)) in json_files.iter().enumerate() {
            let mut file = archive
                .by_name(json_path)
                .with_context(|| format!("opening {}", json_path))?;
            let mut content = String::new();
            file.read_to_string(&mut content)
                .with_context(|| format!("reading {}", json_path))?;

            if i == 0 {
                first_file_content = content.clone();
            }
            file_contents.push(content);
        }

        thread_data.insert(thread_dir.clone(), (file_contents, first_file_content));
    }

    // Now process all the data
    let mut conversations = Vec::new();
    for (thread_dir, (_, first_content)) in thread_data {
        let parsed: FacebookExportRoot = serde_json::from_str(&first_content)
            .with_context(|| format!("parsing first file for {}", thread_dir))?;
        let parsed = crate::importers::messenger::utils::encoding::fix_encoding(parsed);

        let participants: Vec<DiscoveredParticipant> = parsed
            .participants
            .iter()
            .map(|p| DiscoveredParticipant {
                name: p.name.clone(),
                image_uri: None, // Facebook format doesn't have individual participant images
            })
            .collect();
        let conversation_type = if parsed.participants.len() == 2 {
            ConversationType::DM
        } else {
            ConversationType::Group
        };

        let conversation = DiscoveredConversation {
            id: thread_dir,
            format: ExportFormat::Facebook,
            title: parsed.title,
            participants,
            conversation_type,
        };
        conversations.push(conversation);
    }

    Ok(conversations)
}

/// Discover conversations from an E2E Messenger ZIP archive.
fn discover_e2e_archive<R: std::io::Seek + std::io::Read>(
    archive: &mut ZipArchive<R>,
) -> Result<Vec<DiscoveredConversation>> {
    let root_jsons: Vec<String> = archive
        .file_names()
        .filter(|name| !name.contains('/') && name.ends_with(".json"))
        .map(|s| s.to_string())
        .collect();

    let mut conversations = Vec::new();
    for json_path in root_jsons {
        let mut f = archive
            .by_name(&json_path)
            .with_context(|| format!("open {}", json_path))?;
        let mut json_content = String::new();
        f.read_to_string(&mut json_content)
            .with_context(|| format!("read {}", json_path))?;

        let conversation = discover_e2e_json(&json_content, &json_path)?;
        conversations.push(conversation);
    }

    Ok(conversations)
}

/// Discover conversation metadata from a Facebook thread JSON structure.
fn discover_facebook_thread(parsed: &FacebookExportRoot) -> DiscoveredConversation {
    let participants: Vec<DiscoveredParticipant> = parsed
        .participants
        .iter()
        .map(|p| DiscoveredParticipant {
            name: p.name.clone(),
            image_uri: None,
        })
        .collect();
    let conversation_type = if parsed.participants.len() == 2 {
        ConversationType::DM
    } else {
        ConversationType::Group
    };

    DiscoveredConversation {
        id: parsed.thread_path.clone(),
        format: ExportFormat::Facebook,
        title: parsed.title.clone(),
        participants,
        conversation_type,
    }
}

/// Discover conversation metadata from E2E JSON content.
fn discover_e2e_json(json_content: &str, json_filename: &str) -> Result<DiscoveredConversation> {
    let parsed: formats::e2e::json::E2eExportRoot =
        serde_json::from_str(json_content).context("parsing e2e json for discovery")?;

    let participants: Vec<DiscoveredParticipant> = parsed
        .participants
        .iter()
        .map(|name| DiscoveredParticipant {
            name: name.clone(),
            image_uri: None,
        })
        .collect();
    let conversation_type = if parsed.participants.len() == 2 {
        ConversationType::DM
    } else {
        ConversationType::Group
    };

    Ok(DiscoveredConversation {
        id: json_filename.to_string(),
        format: ExportFormat::E2E,
        title: parsed.thread_name,
        participants,
        conversation_type,
    })
}
