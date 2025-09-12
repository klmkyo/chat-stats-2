//! Messenger chat import functionality.
//!
//! Handles importing Facebook Messenger exports in various formats,
//! with support for both legacy and end-to-end encrypted chat exports.
//!
//! The import process creates a normalized database with export_source field
//! to track which format each conversation came from (messenger:facebook or messenger:e2e).
//! Post-import merging is handled separately by querying the database.

use anyhow::{Context, Result};
use std::{collections::HashMap, fs::File, path::Path, path::PathBuf};
use zip::read::ZipArchive;

use crate::{
    database::{MessageDb, WriteBatch},
    importers::messenger::formats::facebook::json::FacebookExportRoot,
};

pub mod formats;
pub mod utils;

/// Importer state shared across multiple files/zips in a run.
pub struct ImportState {
    pub user_ids: HashMap<String, i64>,
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
            next_user_id: 1,
            next_conv_id: 1,
            next_msg_id: 1,
        }
    }
}

/// The file format of an export file.
#[derive(Debug, Clone, PartialEq)]
pub enum FileFormat {
    Zip,
    Json,
}

/// The export format a conversation was found in.
#[derive(Debug, Clone, PartialEq)]
pub enum ExportFormat {
    Facebook,
    E2E,
}

/// Determine the file format of a path.
fn determine_file_format(path: &Path) -> Result<FileFormat> {
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .ok_or_else(|| anyhow::anyhow!("File has no extension: {}", path.display()))?;

    match extension.to_lowercase().as_str() {
        "zip" => Ok(FileFormat::Zip),
        "json" => Ok(FileFormat::Json),
        _ => Err(anyhow::anyhow!("Unsupported file type: {}", path.display())),
    }
}

/// Determine the export format of a ZIP archive.
fn determine_zip_format(path: &Path) -> Result<ExportFormat> {
    let file =
        File::open(path).with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
    let archive = ZipArchive::new(file)
        .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;

    if formats::e2e::is_e2e_archive(&archive) {
        Ok(ExportFormat::E2E)
    } else {
        Ok(ExportFormat::Facebook)
    }
}

/// Determine the export format of a JSON file based on filename patterns.
/// We'll validate the actual format when parsing.
fn determine_json_format(path: &Path) -> Result<ExportFormat> {
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

/// Import multiple chat export files into a SQLite database.
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

    for path in paths {
        let file_format = determine_file_format(&path)?;
        let export_format = match file_format {
            FileFormat::Zip => determine_zip_format(&path)?,
            FileFormat::Json => determine_json_format(&path)?,
        };

        match (file_format, export_format) {
            (FileFormat::Zip, ExportFormat::Facebook) => {
                import_facebook_zip(&path, &mut batch, &mut state)?
            }
            (FileFormat::Zip, ExportFormat::E2E) => import_e2e_zip(&path, &mut batch, &mut state)?,
            (FileFormat::Json, ExportFormat::Facebook) => {
                import_facebook_json(&path, &mut batch, &mut state)?
            }
            (FileFormat::Json, ExportFormat::E2E) => {
                import_e2e_json(&path, &mut batch, &mut state)?
            }
        }
    }

    batch
        .commit()
        .context("Failed to commit database transaction")?;
    Ok(())
}

/// Import Facebook conversations from a ZIP archive.
fn import_facebook_zip(
    path: &Path,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    let file =
        File::open(path).with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
    formats::facebook::import_facebook_archive(&mut archive, batch, state)
}

/// Import Facebook conversations from a JSON file.
fn import_facebook_json(
    path: &Path,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    let json_content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read JSON file: {}", path.display()))?;

    match serde_json::from_str::<FacebookExportRoot>(&json_content) {
        Ok(parsed) => {
            let parsed = utils::encoding::fix_encoding(parsed);
            formats::facebook::import_thread(&parsed, batch, state)
        }
        Err(e) => Err(anyhow::anyhow!("Failed to parse Facebook JSON: {}", e)),
    }
}

/// Import E2E conversations from a ZIP archive.
fn import_e2e_zip(path: &Path, batch: &mut WriteBatch<'_>, state: &mut ImportState) -> Result<()> {
    let file =
        File::open(path).with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
    formats::e2e::import_e2e_archive(&mut archive, batch, state)
}

/// Import E2E conversations from a JSON file.
/// Falls back to Facebook format if E2E parsing fails.
fn import_e2e_json(path: &Path, batch: &mut WriteBatch<'_>, state: &mut ImportState) -> Result<()> {
    let json_content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read JSON file: {}", path.display()))?;

    // Try E2E format first (since we determined this based on filename), fallback to Facebook format
    match formats::e2e::import_e2e_json(&json_content, batch, state) {
        Ok(()) => Ok(()),
        Err(_) => {
            // Fallback: try Facebook format in case our filename-based detection was wrong
            match serde_json::from_str::<FacebookExportRoot>(&json_content) {
                Ok(parsed) => {
                    let parsed = utils::encoding::fix_encoding(parsed);
                    formats::facebook::import_thread(&parsed, batch, state)
                }
                Err(e) => Err(anyhow::anyhow!(
                    "Failed to parse as either E2E or Facebook JSON: {}",
                    e
                )),
            }
        }
    }
}
