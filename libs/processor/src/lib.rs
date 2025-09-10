//! Chat Statistics Processor
//!
//! A Rust library for processing chat exports and ZIP files.
//! Provides FFI functions for use with React Native and Swift.

use serde::Serialize;
use serde_json;
use std::ffi::CString;
use std::fs::File;
use std::io::{Read, Seek};
use std::os::fd::{FromRawFd, OwnedFd};
use zip::read::ZipArchive;

pub mod zip_merged;

pub const APP_NAME: &str = "Chat Processor";

/// Information about a file or directory within a ZIP archive.
///
/// This struct is serialized to JSON and sent to the React Native frontend.
/// Each ZIP entry (file or directory) becomes one `FileInfo` instance.
#[derive(Serialize)]
pub struct FileInfo {
    /// Full path of the file within the ZIP (e.g., "folder/subfolder/file.txt")
    pub name: String,
    /// Size of the file in bytes (0 for directories)
    pub size: u64,
    /// Whether this entry represents a directory (true) or file (false)
    pub is_directory: bool,
}

/// Lists contents of a ZIP file using a file descriptor.
///
/// This is the main function called from Swift when a user picks a ZIP file.
/// Takes ownership of the file descriptor and returns JSON data about all files in the ZIP.
///
/// # Arguments
/// * `fd` - A duplicated file descriptor pointing to the ZIP file.
///          The caller (Swift) must duplicate the fd before passing it here.
///
/// # Returns
/// A pointer to a null-terminated C string containing:
/// - On success: JSON array of `FileInfo` objects
/// - On error: A string starting with "ERROR: " followed by the error message
///
/// # Memory Management
/// The returned pointer must be freed by calling `rust_string_free()`.
///
/// # Safety
/// The caller must ensure the file descriptor is valid and duplicated.
/// This function takes ownership of the fd and will automatically close it when done.
#[no_mangle]
pub extern "C" fn rust_zip_list_fd(fd: i32) -> *mut std::os::raw::c_char {
    // SAFETY: Caller must pass a duplicated fd that we own.
    // We take full ownership of the fd and will close it automatically when done.
    let owned: OwnedFd = unsafe { OwnedFd::from_raw_fd(fd) };
    let file = File::from(owned); // File takes ownership of the OwnedFd
    let result = list_zip_from_reader(file); // fd will be closed when File drops

    into_c_string(result)
}

/// Frees a C string previously returned by other Rust functions.
///
/// **CRITICAL**: Every string returned by `rust_zip_list_fd` or `rust_zip_list_path`
/// must be freed using this function to prevent memory leaks.
///
/// # Arguments
/// * `ptr` - Pointer to the C string to free. Can be null (will be ignored).
///
/// # Safety
/// The pointer must have been returned by one of our Rust functions.
/// After calling this function, the pointer becomes invalid and must not be used.
///
/// # Example Usage in Swift
/// ```swift
/// let result = rust_zip_list_fd(fd)
/// let text = String(cString: result)  // Copy to Swift string
/// rust_string_free(result)           // Free the original C string
/// ```
#[no_mangle]
pub extern "C" fn rust_string_free(ptr: *mut std::os::raw::c_char) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        drop(CString::from_raw(ptr));
    }
}

fn into_c_string(result: Result<String, String>) -> *mut std::os::raw::c_char {
    let s = match result {
        Ok(s) => s,
        Err(e) => format!("ERROR: {}", e),
    };
    // Ensure no interior nulls - replace any null bytes with spaces
    let safe_string = s.replace('\0', " ");
    match CString::new(safe_string) {
        Ok(cs) => cs.into_raw(),
        Err(_) => CString::new("ERROR: failed to create C string")
            .unwrap()
            .into_raw(),
    }
}

/// Processes a ZIP file and returns its contents as JSON.
///
/// This is the core function that does the actual ZIP processing.
/// It reads through all entries in the ZIP file and converts them to `FileInfo` structs,
/// then serializes everything to a JSON string.
///
/// # Arguments
/// * `reader` - Any reader that implements Read + Seek (File, Cursor, etc.)
///
/// # Returns
/// * `Ok(String)` - JSON array of FileInfo objects
/// * `Err(String)` - Human-readable error message
///
/// # Example JSON Output
/// ```json
/// [
///   {"name": "folder/", "size": 0, "is_directory": true},
///   {"name": "folder/file.txt", "size": 1024, "is_directory": false}
/// ]
/// ```
fn list_zip_from_reader<R: Read + Seek>(reader: R) -> Result<String, String> {
    // Try to create ZIP archive
    let mut archive = match ZipArchive::new(reader) {
        Ok(archive) => archive,
        Err(e) => return Err(format!("Failed to read ZIP file: {}", e)),
    };

    // Collect all files/directories into our FileInfo structs
    let mut files = Vec::new();

    for i in 0..archive.len() {
        let entry = match archive.by_index(i) {
            Ok(entry) => entry,
            Err(e) => return Err(format!("Failed to read ZIP entry {}: {}", i, e)),
        };

        let file_info = FileInfo {
            name: entry.name().to_string(),
            size: entry.size(),
            is_directory: entry.is_dir(),
        };

        files.push(file_info);
    }

    // Convert to JSON string
    // TODO can we not use json?
    match serde_json::to_string(&files) {
        Ok(json) => Ok(json),
        Err(e) => Err(format!("Failed to serialize to JSON: {}", e)),
    }
}

#[cfg(test)]
mod tests {}
