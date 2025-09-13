//! Archive and ZIP file utilities.
//!
//! Common operations for working with ZIP archives across different importers.

use anyhow::Result;
use std::io::{Read, Seek};
use zip::ZipArchive;

/// List all file names in a ZIP archive.
pub fn list_files<R: Read + Seek>(archive: &ZipArchive<R>) -> Vec<String> {
    archive.file_names().map(|name| name.to_string()).collect()
}

/// Check if a ZIP archive contains a file with the given name.
pub fn contains_file<R: Read + Seek>(archive: &ZipArchive<R>, filename: &str) -> bool {
    archive.file_names().any(|name| name == filename)
}

/// Check if a ZIP archive contains files matching a pattern.
pub fn contains_files_matching<R: Read + Seek, F>(archive: &ZipArchive<R>, predicate: F) -> bool
where
    F: Fn(&str) -> bool,
{
    archive.file_names().any(predicate)
}

/// Extract the contents of a specific file from a ZIP archive as a string.
pub fn extract_text_file<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    filename: &str,
) -> Result<String> {
    let mut file = archive.by_name(filename)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}
