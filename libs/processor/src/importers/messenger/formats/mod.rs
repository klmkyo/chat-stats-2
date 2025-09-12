//! Messenger chat export format parsers.
//!
//! Supports multiple Messenger export formats:
//! - Facebook export format (legacy)
//! - End-to-end export format (E2E)

pub mod e2e;
pub mod facebook;

// Re-export main functions from each format
pub use e2e::{import_e2e_archive, import_e2e_json, is_e2e_archive};
pub use facebook::{import_facebook_archive, import_thread};
