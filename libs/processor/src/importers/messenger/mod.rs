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

use crate::database::{MessageDb, WriteBatch};

pub mod formats;
pub mod utils;

/// Importer state shared across multiple files/zips in a run.
pub struct ImportState {
    pub user_ids: HashMap<String, i64>,
    pub folder_names_to_conv_ids: HashMap<String, i64>,
    pub next_user_id: i64,
    pub next_conv_id: i64,
    pub next_msg_id: i64,
    pub file_index: utils::file_index::FileIndex,
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
            folder_names_to_conv_ids: HashMap::new(),
            next_user_id: 1,
            next_conv_id: 1,
            next_msg_id: 1,
            file_index: utils::file_index::FileIndex::default(),
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
    // Build a global media index so we can resolve audio across ZIPs by full pathname.
    state.file_index = utils::file_index::build_file_index(&paths);

    for path in paths {
        let export_format = determine_zip_format(&path)?;

        match export_format {
            ExportFormat::Facebook => import_facebook_zip(&path, &mut batch, &mut state)?,
            ExportFormat::E2E => import_e2e_zip(&path, &mut batch, &mut state)?,
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

/// Import E2E conversations from a ZIP archive.
fn import_e2e_zip(path: &Path, batch: &mut WriteBatch<'_>, state: &mut ImportState) -> Result<()> {
    let file =
        File::open(path).with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
    formats::e2e::import_e2e_archive(&mut archive, batch, state)
}
