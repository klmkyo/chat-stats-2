use ::zip::read::ZipArchive;
use anyhow::{Context, Result};
use std::{collections::HashMap, fs::File, path::Path, path::PathBuf};

use crate::{
    adapters::messenger::export::facebook::json::FacebookExportRoot, artifact::schema::MessageDb,
};

pub mod export;
pub mod helpers;

/// Importer state shared across multiple files/zips in a run.
pub struct ImportState {
    pub user_ids: HashMap<String, i64>,
    pub conv_ids: HashMap<String, i64>,
    pub next_user_id: i64,
    pub next_conv_id: i64,
    pub next_msg_id: i64,
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

/// High-level import that accepts a mixed list of paths (ZIPs or JSON files) and imports them
/// into a single SQLite database using the current normalized schema.
pub fn import_mixed_inputs_to_sqlite(paths: Vec<PathBuf>, db_path: &Path) -> Result<()> {
    let mut db = MessageDb::open(db_path).context("opening sqlite db")?;
    let mut batch = db.begin_write().context("beginning write batch")?;
    let mut state = ImportState::new();

    for p in paths {
        if p.extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case("zip"))
            .unwrap_or(false)
        {
            let file = File::open(&p).with_context(|| format!("open zip {}", p.display()))?;
            let mut archive = ZipArchive::new(file)
                .with_context(|| format!("open zip archive {}", p.display()))?;
            if export::e2e::is_e2e_zip(&archive) {
                export::e2e::import_e2e_zip_into_batch(&mut archive, &mut batch, &mut state)?;
            } else {
                export::facebook::import_facebook_zip_archive_into_batch(
                    &mut archive,
                    &mut batch,
                    &mut state,
                )?;
            }
        } else if p
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.eq_ignore_ascii_case("json"))
            .unwrap_or(false)
        {
            let json_content = std::fs::read_to_string(&p)
                .with_context(|| format!("read json {}", p.display()))?;

            // Try old format first; if it fails, try e2e format.
            match serde_json::from_str::<FacebookExportRoot>(&json_content) {
                Ok(parsed_old) => {
                    let parsed_old = helpers::encoding::fix_messenger_encoding(parsed_old);
                    export::facebook::import_thread_into_batch(
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
                    export::e2e::import_e2e_json_str_into_batch(
                        &json_content,
                        &mut batch,
                        &mut state,
                    )?;
                }
            }
        } else {
            return Err(anyhow::anyhow!("unsupported file type: {}", p.display()));
        }
    }

    batch.commit().context("committing write batch")?;
    Ok(())
}
