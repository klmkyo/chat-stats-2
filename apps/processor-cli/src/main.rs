use clap::{Parser, Subcommand};
use processor::{self, APP_NAME};
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

            // TODO: Stage 2: Query DB and merge duplicates based on heuristics
            // This will be implemented next to query the database, find duplicate conversations
            // based on title matching and participant overlap, and merge them.
        }
    }
}
