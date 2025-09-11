//! Chat Statistics Processor
//!
//! A Rust library for processing chat exports and ZIP files.
//! Provides FFI functions for use with React Native and Swift.

pub mod adapters;
pub mod artifact;
pub mod utils;

pub const APP_NAME: &str = "Chat Processor";

#[cfg(test)]
mod tests {}
