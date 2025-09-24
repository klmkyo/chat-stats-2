//! Foreign Function Interface (FFI) layer for native bridge integration.
//!
//! Organized into submodules so importer-specific surfaces remain isolated.

mod messenger;
mod progress_callbacks;
mod utilities;

pub use messenger::*;
pub use progress_callbacks::*;
pub use utilities::*;
