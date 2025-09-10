use std::fs::File;
use std::os::fd::{FromRawFd, IntoRawFd, OwnedFd};
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use processor::{self, APP_NAME};

#[derive(Parser)]
#[command(name = "processor-cli", about = APP_NAME, version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Merge directory trees of multiple ZIP files and write to a text file
    MergeTree {
        /// Output file path (defaults to debug.txt)
        #[arg(short, long, default_value = "debug.txt")]
        output: PathBuf,

        /// Paths to ZIP files to merge
        #[arg(value_name = "ZIP_FILES")]
        files: Vec<PathBuf>,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::MergeTree { output, files } => {
            if files.is_empty() {
                eprintln!("No ZIP files provided.");
                std::process::exit(2);
            }

            let mut fds: Vec<OwnedFd> = Vec::with_capacity(files.len());
            for path in files {
                match File::open(&path) {
                    Ok(file) => {
                        // Take ownership of the fd so library can safely close it
                        let raw = file.into_raw_fd();
                        // SAFETY: we just obtained the raw fd from a File we own
                        let owned: OwnedFd = unsafe { OwnedFd::from_raw_fd(raw) };
                        fds.push(owned);
                    }
                    Err(e) => {
                        eprintln!("Failed to open {}: {}", path.display(), e);
                        std::process::exit(1);
                    }
                }
            }

            match processor::zip_merged::build_merged_tree_from_fds(fds) {
                Err(e) => {
                    eprintln!("Error building tree: {}", e);
                    std::process::exit(1);
                }
                Ok(root) => {
                    println!("Merged tree!");
                    return;
                    if let Err(e) = processor::zip_merged::write_tree_debug(&root) {
                        eprintln!("Error writing output: {}", e);
                        std::process::exit(1);
                    } else {
                        println!("Merged tree written to {}", output.display());
                    }
                }
            }
        }
    }
}
