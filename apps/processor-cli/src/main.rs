use clap::{Parser, Subcommand};
use processor::{self, APP_NAME};
use std::fs::File;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "processor-cli", about = APP_NAME, version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Merge directory trees of multiple ZIP files and write to a text file
    ListZips {
        /// Paths to ZIP files to merge
        #[arg(value_name = "ZIP_FILES")]
        files: Vec<PathBuf>,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::ListZips { files: file_paths } => {
            if file_paths.is_empty() {
                eprintln!("No ZIP files provided.");
                std::process::exit(2);
            }

            let files: Vec<File> = file_paths
                .into_iter()
                .map(|path| File::open(path).unwrap())
                .collect();

            match processor::adapters::messenger::build_merged_tree_from_fds(files) {
                Err(e) => {
                    eprintln!("Error building tree: {}", e);
                    std::process::exit(1);
                }
                Ok(()) => {
                    println!("Tree built successfully");
                }
            }
        }
    }
}
