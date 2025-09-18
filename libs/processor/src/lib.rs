//! Chat Statistics Processor
//!
//! A high-performance Rust library for processing chat exports and ZIP files.
//! Designed for on-device analytics with cross-platform FFI support for
//! React Native, Swift, and other native integrations.
//!
//! ## Main Components
//!
//! - [`database`] - SQLite schema and database operations
//! - [`importers`] - Chat format parsers and import logic  
//! - [`ffi`] - C-compatible functions for native bridges
//! - [`utils`] - Shared utilities and helper functions

pub mod database;
pub mod ffi;
pub mod importers;
pub mod progress;
pub mod utils;

pub const APP_NAME: &str = "Chat Processor";

#[cfg(test)]
mod tests {}
