use ::zip::read::ZipArchive;
use anyhow::{Context, Result};
use regex::Regex;
use std::{fs::File, io::Read};

use crate::adapters::messenger::json::Root;

pub mod json;

const DIRECTORIES: [&str; 4] = [
    "inbox",
    "e2ee_cutover",
    "filtered_threads",
    "message_requests",
];

/// Build and return the merged directory tree root node from multiple ZIP files.
pub fn build_merged_tree_from_fds(zip_files: Vec<File>) -> Result<()> {
    for (idx, file) in zip_files.into_iter().enumerate() {
        let mut archive = ZipArchive::new(file).context("Failed to open ZIP file")?;

        let regex_string = format!(
            r"^your_facebook_activity/messages/({})/([^/]+)/message_\d+\.json$",
            DIRECTORIES.join("|")
        );

        let is_messages_re = Regex::new(&regex_string).unwrap();

        let json_paths: Vec<String> = archive
            .file_names()
            .filter(|path| is_messages_re.is_match(path))
            .map(|path| path.to_string())
            .collect();

        for json_path in json_paths {
            println!("{}: JSON file: {}", idx, json_path);
            let mut file = archive
                .by_name(&json_path)
                .context("Failed to read entry")?;

            let mut json_content = String::new();

            file.read_to_string(&mut json_content)
                .context("Failed to read entry")?;

            let json: Root = serde_json::from_str(&json_content)?;

            println!("JSON messages: {}", json.messages.len());
        }
    }

    Ok(())
}
