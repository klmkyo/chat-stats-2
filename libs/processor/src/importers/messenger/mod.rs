//! Messenger chat import functionality.
//!
//! Handles importing Facebook Messenger exports in various formats,
//! with support for both legacy and end-to-end encrypted chat exports.
//!
//! The import process creates a normalized database with an `export` table
//! tracked per run (Facebook multi-part zips form one export; each E2E zip is its own export).
//! Post-import merging is handled non-destructively by assigning canonical IDs.

use anyhow::{Context, Result};
use std::{collections::HashMap, fs::File, path::Path, path::PathBuf};
use zip::read::ZipArchive;

use crate::database::{MessageDb, WriteBatch};

pub mod formats;
pub mod utils;

/// Importer state shared across multiple files/zips in a run.
pub struct ImportState {
    /// Map from thread folder name to conversation id, to dedupe within a run.
    pub folder_names_to_conv_ids: HashMap<String, i64>,
    /// Map of per-conversation participant name -> per-conversation person id.
    pub person_ids_by_conversation: HashMap<i64, HashMap<String, i64>>,
    /// Global media index across all selected paths for duration probing.
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
            folder_names_to_conv_ids: HashMap::new(),
            person_ids_by_conversation: HashMap::new(),
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

    // Partition selected paths by export format (zip-based detection)
    let mut facebook_paths: Vec<PathBuf> = Vec::new();
    let mut e2e_paths: Vec<PathBuf> = Vec::new();
    for path in paths.into_iter() {
        match determine_zip_format(&path)? {
            ExportFormat::Facebook => facebook_paths.push(path),
            ExportFormat::E2E => e2e_paths.push(path),
        }
    }

    // Facebook: one export across all selected FB zips
    if !facebook_paths.is_empty() {
        let fb_meta_json = compute_group_meta(&facebook_paths);
        let export_id =
            batch.insert_export("messenger:facebook", None, Some(&fb_meta_json))?;

        for path in facebook_paths {
            import_facebook_zip(&path, export_id, &mut batch, &mut state)?;
        }
    }

    // E2E: one export per zip
    for path in e2e_paths {
        let meta_json = compute_group_meta(std::slice::from_ref(&path));
        let export_id = batch.insert_export("messenger:e2e", None, Some(&meta_json))?;
        import_e2e_zip(&path, export_id, &mut batch, &mut state)?;
    }

    batch
        .commit()
        .context("Failed to commit database transaction")?;
    Ok(())
}

/// Import Facebook conversations from a ZIP archive.
fn import_facebook_zip(
    path: &Path,
    export_id: i64,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    let file =
        File::open(path).with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
    formats::facebook::import_facebook_archive(&mut archive, export_id, batch, state)
}

/// Import E2E conversations from a ZIP archive.
fn import_e2e_zip(
    path: &Path,
    export_id: i64,
    batch: &mut WriteBatch<'_>,
    state: &mut ImportState,
) -> Result<()> {
    let file =
        File::open(path).with_context(|| format!("Failed to open ZIP file: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Failed to read ZIP archive: {}", path.display()))?;
    formats::e2e::import_e2e_archive(&mut archive, export_id, batch, state)
}

/// Build a small meta JSON listing file paths. Kept lightweight to avoid I/O hashing.
fn compute_group_meta(paths: &[PathBuf]) -> String {
    let files: Vec<String> = paths
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    serde_json::json!({
        "file_count": files.len(),
        "files": files,
    })
    .to_string()
}
