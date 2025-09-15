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

            // Active dev: recreate DB for this run
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

    // Find potential duplicates: DM conversations with the same name but from different sources
    // Sources are joined via export table. Only DM merges are considered.
    let mut stmt = conn.prepare(
        "
        SELECT 
            cfb.id as id_fb,
            cfb.name as name_fb,
            efb.source as source_fb,
            cfb.type as type_fb,
            ce.id as id_e2e,
            ce.name as name_e2e,
            ee.source as source_e2e,
            ce.type as type_e2e
        FROM conversation cfb 
        JOIN export efb ON efb.id = cfb.export_id
        JOIN conversation ce ON cfb.name = ce.name 
        JOIN export ee ON ee.id = ce.export_id
        WHERE efb.source = 'messenger:facebook' AND ee.source = 'messenger:e2e'
          AND cfb.type = 'dm' AND ce.type = 'dm'
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

    // Perform the actual merges (non-destructive): point both at the same canonical_conversation
    let mut merged_count = 0;
    for (keep_id, merge_id, name) in merge_pairs {
        match merge_conversations_canonical(conn, keep_id, merge_id) {
            Ok(()) => {
                println!(
                    "  Linked '{}' canonically (kept {}, merged {})",
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

/// Non-destructively merge conversations by assigning the same canonical_conversation_id.
fn merge_conversations_canonical(
    conn: &rusqlite::Connection,
    keep_id: i64,
    merge_id: i64,
) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute("BEGIN TRANSACTION", [])?;

    // Get canonical of keep_id
    let canon: i64 = conn.query_row(
        "SELECT canonical_conversation_id FROM conversation WHERE id=?",
        [keep_id],
        |r| r.get(0),
    )?;
    // Point merge_id to the same canonical
    conn.execute(
        "UPDATE conversation SET canonical_conversation_id=? WHERE id=?",
        [canon, merge_id],
    )?;

    conn.execute("COMMIT", [])?;

    Ok(())
}
