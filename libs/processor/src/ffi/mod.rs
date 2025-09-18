//! Foreign Function Interface (FFI) layer for native bridge integration.
//!
//! Provides C-compatible functions for use with React Native, Swift, and other
//! native platforms. All functions use C calling conventions and handle
//! memory management safely.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::path::{Path, PathBuf};

use crate::importers::messenger::import_to_database;
use crate::progress::{self, ProgressCallback};

/// Import a chat export file (ZIP or JSON) into a SQLite database.
///
/// # Arguments
/// * `file_path` - Null-terminated C string path to the export file
/// * `db_path` - Null-terminated C string path to the SQLite database
///
/// # Returns
/// * `0` on success
/// * `-1` on error
///
/// # Safety
/// - `file_path` and `db_path` must be valid pointers to null-terminated C strings.
/// - Pointers must be non-null and remain valid for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn processor_import_file(
    file_path: *const c_char,
    db_path: *const c_char,
) -> c_int {
    let file_path = match CStr::from_ptr(file_path).to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let db_path = match CStr::from_ptr(db_path).to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    match import_to_database(vec![file_path.into()], Path::new(db_path)) {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

#[no_mangle]
pub unsafe extern "C" fn processor_import_files_json(
    file_list_json: *const c_char,
    db_path: *const c_char,
) -> c_int {
    let file_list_json = match CStr::from_ptr(file_list_json).to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let db_path = match CStr::from_ptr(db_path).to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let file_paths: Vec<String> = match serde_json::from_str(file_list_json) {
        Ok(paths) => paths,
        Err(_) => return -1,
    };

    let path_bufs: Vec<PathBuf> = file_paths.into_iter().map(PathBuf::from).collect();

    match import_to_database(path_bufs, Path::new(db_path)) {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

/// Register a callback to receive import progress updates.
///
/// # Arguments
/// * `callback` - Function pointer invoked with `(processed, total)` counts.
#[no_mangle]
pub unsafe extern "C" fn processor_set_progress_callback(callback: ProgressCallback) {
    progress::set_progress_callback(Some(callback));
}

#[no_mangle]
pub unsafe extern "C" fn processor_clear_progress_callback() {
    progress::set_progress_callback(None);
}

/// List contents of a ZIP archive.
///
/// # Arguments  
/// * `archive_path` - Null-terminated C string path to ZIP file
///
/// # Returns
/// * Null-terminated JSON string with file list, or null on error
/// * Caller must free the returned string with `processor_string_free`
///
/// # Safety
/// - `archive_path` must be a valid pointer to a null-terminated C string.
/// - The pointer must be non-null and remain valid for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn processor_list_archive_contents(
    archive_path: *const c_char,
) -> *mut c_char {
    let path_str = match CStr::from_ptr(archive_path).to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    match list_archive_contents_internal(path_str) {
        Ok(json) => match CString::new(json) {
            Ok(cstring) => cstring.into_raw(),
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Free a string allocated by this library.
///
/// # Arguments
/// * `s` - String pointer returned by other processor functions
///
/// # Safety
/// - `s` must be a pointer previously returned by this library (e.g., from
///   `processor_list_archive_contents`).
/// - Call this function at most once for a given pointer; using it after free
///   is undefined behavior.
#[no_mangle]
pub unsafe extern "C" fn processor_string_free(s: *mut c_char) {
    if !s.is_null() {
        let _ = CString::from_raw(s);
    }
}

// Internal helper function
fn list_archive_contents_internal(path: &str) -> anyhow::Result<String> {
    use std::fs::File;
    use zip::ZipArchive;

    let file = File::open(path)?;
    let archive = ZipArchive::new(file)?;

    let files: Vec<String> = archive.file_names().map(|s| s.to_string()).collect();
    Ok(serde_json::to_string(&files)?)
}
