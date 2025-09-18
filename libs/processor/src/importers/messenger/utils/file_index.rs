//! Global file index for cross-ZIP resolution (pre-opens ZIPs). For now, indexes audio files.

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use zip::ZipArchive;

#[derive(Clone, Debug)]
pub struct FileLocation {
    pub zip_path: PathBuf,
    pub entry_name: String,
}

#[derive(Default)]
pub struct FileIndex {
    by_full: HashMap<String, FileLocation>,
    zips: HashMap<PathBuf, ZipArchive<File>>, // pre-opened ZIPs
}

/// Build a file index from a set of ZIP paths. Indexes audio-like files by full path.
pub fn build_file_index(paths: &[PathBuf]) -> FileIndex {
    let mut idx = FileIndex::default();

    for zp in paths {
        if let Ok(f) = File::open(zp) {
            if let Ok(archive) = ZipArchive::new(f) {
                // Build index entries for this archive
                for name in archive.file_names() {
                    if is_audio_like(name) {
                        let loc = FileLocation {
                            zip_path: zp.clone(),
                            entry_name: name.to_string(),
                        };
                        idx.by_full.entry(name.to_string()).or_insert(loc.clone());
                        if !name.starts_with("./") {
                            let dot = format!("./{}", name);
                            idx.by_full.entry(dot).or_insert(loc);
                        }
                    }
                }
                // Store the opened archive for fast future access
                // Re-open to move into our map (ZipArchive is not Clone)
                if let Ok(f2) = File::open(zp) {
                    if let Ok(ar2) = ZipArchive::new(f2) {
                        idx.zips.insert(zp.clone(), ar2);
                    }
                }
            }
        }
    }

    idx
}

impl FileIndex {
    /// Execute a closure with a Read handle to the given full path inside a pre-opened ZIP.
    /// The handle does not escape this method (avoids lifetime issues with ZipArchive).
    pub fn with_file<F, R>(&mut self, full_path: &str, f: F) -> Option<R>
    where
        F: FnOnce(&mut dyn Read) -> R,
    {
        let loc = self.by_full.get(full_path)?;
        let zip = self.zips.get_mut(&loc.zip_path)?;
        let mut zf = zip.by_name(&loc.entry_name).ok()?;
        Some(f(&mut zf))
    }
}

fn is_audio_like(name: &str) -> bool {
    let ext = Path::new(name)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase());
    matches!(
        ext.as_deref(),
        Some(
            "mp3"
                | "m4a"
                | "aac"
                | "wav"
                | "ogg"
                | "oga"
                | "opus"
                | "flac"
                | "mp4"
                | "mov"
                | "3gp"
                | "3gpp"
        )
    )
}
