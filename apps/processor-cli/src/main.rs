use clap::{Parser, Subcommand};
use processor::{self, database::MessageDb, APP_NAME};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "processor-cli", about = APP_NAME, version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Import mixed Messenger/E2E exports (ZIP or JSON) into a normalized SQLite DB
    NormalizeMessenger {
        /// Output SQLite DB path (will be overwritten)
        #[arg(long)]
        db: PathBuf,
        /// Input files: any mix of old ZIPs, new E2E ZIPs, or JSON files
        #[arg(value_name = "FILES", num_args = 1..)]
        files: Vec<PathBuf>,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::NormalizeMessenger { db, files } => {
            if files.is_empty() {
                eprintln!("No files provided.");
                std::process::exit(2);
            }

            // Overwrite existing DB once
            if db.exists() {
                let _ = std::fs::remove_file(&db);
            }

            // Stage 1: Import everything into normalized DB with export_source
            match processor::importers::messenger::import_to_database(files, &db) {
                Ok(()) => println!("Imported into DB: {}", db.display()),
                Err(e) => {
                    eprintln!("Import failed: {}", e);
                    std::process::exit(1);
                }
            }

            // Stage 2: Query DB and merge duplicates based on heuristics
            match merge_duplicate_conversations(&db) {
                Ok(merged_count) => {
                    if merged_count > 0 {
                        println!("Merged {} duplicate conversation pairs", merged_count);
                    } else {
                        println!("No duplicate conversations found to merge");
                    }
                }
                Err(e) => {
                    eprintln!("Warning: Failed to merge duplicates: {}", e);
                    // Don't exit - the import was successful even if merging failed
                }
            }
        }
    }
}

/// Find and merge duplicate DM conversations based on heuristics.
///
/// Only merges DM conversations since group messages only exist in Facebook format,
/// not in E2E format, so there are no valid group conversation merge cases.
///
/// Returns the number of conversation pairs that were merged.
fn merge_duplicate_conversations(
    db_path: &std::path::Path,
) -> Result<usize, Box<dyn std::error::Error>> {
    let db = MessageDb::open(db_path)?;
    let conn = db.conn();

    // Find potential duplicates: DM conversations with the same name but different export_source
    // We only merge DMs since group messages only exist in Facebook format, not E2E
    let mut stmt = conn.prepare(
        "
        SELECT 
            cfb.id as id_fb, cfb.name as name_fb, cfb.export_source as source_fb, cfb.type as type_fb,
            ce.id as id_e2e, ce.name as name_e2e, ce.export_source as source_e2e, ce.type as type_e2e
        FROM conversation cfb 
        JOIN conversation ce ON cfb.name = ce.name 
        AND cfb.export_source = 'messenger:facebook' AND ce.export_source = 'messenger:e2e' -- Avoid duplicate pairs
        AND cfb.type = 'dm' AND ce.type = 'dm'  -- Only merge DM conversations
        ORDER BY cfb.name
    ",
    )?;

    let mut rows = stmt.query([])?;
    let mut merge_pairs = Vec::new();

    while let Some(row) = rows.next()? {
        let id1: i64 = row.get("id_fb")?;
        let name1: String = row.get("name_fb")?;

        let id2: i64 = row.get("id_e2e")?;

        merge_pairs.push((id1, id2, name1.clone()));
    }

    // Perform the actual merges
    let mut merged_count = 0;
    for (keep_id, merge_id, name) in merge_pairs {
        match merge_conversations(conn, keep_id, merge_id) {
            Ok(()) => {
                println!(
                    "  Merged '{}' (kept conversation {}, merged {})",
                    name, keep_id, merge_id
                );
                merged_count += 1;
            }
            Err(e) => {
                eprintln!("  Failed to merge '{}': {}", name, e);
            }
        }
    }

    Ok(merged_count)
}

/// Merge two conversations by moving all messages from merge_id to keep_id and deleting merge_id.
fn merge_conversations(
    conn: &rusqlite::Connection,
    keep_id: i64,
    merge_id: i64,
) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute("BEGIN TRANSACTION", [])?;

    // Move all messages from merge_id conversation to keep_id conversation
    conn.execute(
        "UPDATE message SET conversation = ? WHERE conversation = ?",
        [keep_id, merge_id],
    )?;

    // Delete the merged conversation
    conn.execute("DELETE FROM conversation WHERE id = ?", [merge_id])?;

    conn.execute("COMMIT", [])?;

    Ok(())
}
