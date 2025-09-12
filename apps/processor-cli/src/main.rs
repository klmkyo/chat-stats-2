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

            // First, discover all conversations
            let discovery_result =
                match processor::importers::messenger::discover_conversations(files.clone()) {
                    Ok(result) => result,
                    Err(e) => {
                        eprintln!("Discovery failed: {}", e);
                        std::process::exit(1);
                    }
                };

            // Generate automatic merges based on title matching
            let merges = generate_automatic_merges(&discovery_result);

            if !merges.is_empty() {
                println!(
                    "Found {} automatic conversation matches based on titles:",
                    merges.len()
                );
                for merge in &merges {
                    println!(
                        "  Merging '{}' (Facebook: {}, E2E: {})",
                        merge.merged_title, merge.facebook_id, merge.e2e_id
                    );
                }
            }

            // Overwrite existing DB once
            if db.exists() {
                let _ = std::fs::remove_file(&db);
            }

            let merge_instructions = if merges.is_empty() {
                None
            } else {
                Some(merges)
            };
            match processor::importers::messenger::import_to_database(
                files,
                &db,
                merge_instructions,
            ) {
                Ok(()) => println!("Imported into DB: {}", db.display()),
                Err(e) => {
                    eprintln!("Import failed: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }
}

/// Generate automatic conversation merges based on title matching.
fn generate_automatic_merges(
    discovery: &processor::importers::messenger::DiscoveryResult,
) -> Vec<processor::importers::messenger::ConversationMerge> {
    let mut merges = Vec::new();

    // Create a map of titles to Facebook conversations for quick lookup
    let mut facebook_by_title: std::collections::HashMap<
        String,
        &processor::importers::messenger::DiscoveredConversation,
    > = std::collections::HashMap::new();
    for fb_conv in &discovery.facebook_conversations {
        facebook_by_title.insert(fb_conv.title.clone(), fb_conv);
    }

    // For each E2E conversation, look for an exact title match in Facebook conversations
    for e2e_conv in &discovery.e2e_conversations {
        if let Some(fb_conv) = facebook_by_title.get(&e2e_conv.title) {
            // Check if they have the same conversation type and similar participant counts
            if fb_conv.conversation_type == e2e_conv.conversation_type {
                let fb_participant_count = fb_conv.participants.len();
                let e2e_participant_count = e2e_conv.participants.len();

                // Allow some flexibility in participant counts (people might have left/joined)
                let count_diff = if fb_participant_count > e2e_participant_count {
                    fb_participant_count - e2e_participant_count
                } else {
                    e2e_participant_count - fb_participant_count
                };

                // Only merge if participant count difference is reasonable (≤ 2 people difference)
                if count_diff <= 2 {
                    merges.push(processor::importers::messenger::ConversationMerge {
                        facebook_id: fb_conv.id.clone(),
                        e2e_id: e2e_conv.id.clone(),
                        merged_title: fb_conv.title.clone(), // Use Facebook title as canonical
                    });
                }
            }
        }
    }

    merges
}
