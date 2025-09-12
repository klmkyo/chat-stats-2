//! Messenger chat import functionality.
//!
//! Handles importing Facebook Messenger exports in various formats,
//! with support for both legacy and end-to-end encrypted chat exports.

use anyhow::{Context, Result};
use std::{collections::HashMap, fs::File, path::Path, path::PathBuf};
use zip::read::ZipArchive;

use crate::{
    database::MessageDb, importers::messenger::formats::facebook::json::FacebookExportRoot,
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
        }
    }
}

/// Import multiple chat export files into a SQLite database.
///
/// Accepts a mixed list of paths (ZIPs or JSON files) and imports them
/// into a single SQLite database using the current normalized schema.
///
/// # Arguments
/// * `paths` - List of file paths to import (ZIP archives or JSON files)
/// * `db_path` - Path where the SQLite database should be created/updated
pub fn import_to_database(paths: Vec<PathBuf>, db_path: &Path) -> Result<()> {
    let mut db = MessageDb::open(db_path)
        .with_context(|| format!("Failed to open SQLite database: {}", db_path.display()))?;
    let mut batch = db
        .begin_write()
        .context("Failed to begin database write transaction")?;
    let mut state = ImportState::new();

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
                    formats::facebook::import_thread(
                        &mut batch,
                        &mut state.user_ids,
                        &mut state.next_user_id,
                        &mut state.conv_ids,
                        &mut state.next_conv_id,
                        &mut state.next_msg_id,
                        &parsed_old,
                    )?;
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
