use ::zip::read::ZipArchive;
use once_cell::sync::Lazy;
use regex::Regex;
use std::io::{Read, Seek};

pub const DIRECTORIES: [&str; 4] = [
    "inbox",
    "e2ee_cutover",
    "filtered_threads",
    "message_requests",
];

pub static MESSAGES_RE: Lazy<Regex> = Lazy::new(|| {
    let pattern = format!(
        r"^your_facebook_activity/messages/({})/([^/]+)/message_\d+\.json$",
        DIRECTORIES.join("|")
    );
    Regex::new(&pattern).expect("valid regex")
});

fn parse_message_number_from_path(path: &str) -> i64 {
    path.rsplit_once("message_")
        .and_then(|(_, rest)| rest.strip_suffix(".json"))
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0)
}

pub fn collect_sorted_message_entries<R: Seek + Read>(
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

