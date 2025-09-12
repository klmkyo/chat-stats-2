//! Facebook Messenger path parsing and ZIP entry handling.
//!
//! Contains Facebook-specific utilities for parsing message file paths
//! and organizing ZIP archive entries by conversation threads.

use once_cell::sync::Lazy;
use regex::Regex;
use std::io::{Read, Seek};
use zip::read::ZipArchive;

/// Facebook Messenger export directory names.
pub const DIRECTORIES: [&str; 4] = [
    "inbox",
    "e2ee_cutover",
    "filtered_threads",
    "message_requests",
];

/// Regex pattern for matching Facebook Messenger JSON message files.
pub static MESSAGES_RE: Lazy<Regex> = Lazy::new(|| {
    let pattern = format!(
        r"^your_facebook_activity/messages/({})/([^/]+)/message_\d+\.json$",
        DIRECTORIES.join("|")
    );
    Regex::new(&pattern).expect("valid regex")
});

/// Parse the message number from a Facebook message file path.
fn parse_message_number_from_path(path: &str) -> i64 {
    path.rsplit_once("message_")
        .and_then(|(_, rest)| rest.strip_suffix(".json"))
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0)
}

/// Collect and sort Facebook message entries from a ZIP archive.
/// 
/// Returns a sorted list of (thread_directory, message_number, full_path) tuples.
/// Entries are sorted first by thread directory name, then by message number.
pub fn collect_message_entries<R: Seek + Read>(
    archive: &ZipArchive<R>,
    re: &Regex,
) -> Vec<(String, i64, String)> {
    let mut entries: Vec<(String, i64, String)> = Vec::new();
    for path in archive.file_names() {
        if let Some(caps) = re.captures(path) {
            let thread_dir = caps.get(2).map(|m| m.as_str()).unwrap_or("").to_string();
            let num = parse_message_number_from_path(path);
            entries.push((thread_dir, num, path.to_string()));
        }
    }
    entries.sort_by(|a, b| match a.0.cmp(&b.0) {
        std::cmp::Ordering::Equal => a.1.cmp(&b.1),
        other => other,
    });

    entries
}
