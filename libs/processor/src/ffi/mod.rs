//! Foreign Function Interface (FFI) layer for native bridge integration.
//!
//! Provides C-compatible functions for use with React Native, Swift, and other
//! native platforms. All functions use C calling conventions and handle
//! memory management safely.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::path::Path;

use crate::importers::messenger::{import_to_database, discover_conversations, ConversationMerge};

/// Import a chat export file (ZIP or JSON) into a SQLite database (legacy version).
/// 
/// This is the simple one-stage import for backward compatibility.
/// For new applications, consider using the two-stage process with 
/// `processor_discover_conversations` and `processor_import_with_merges`.
/// 
/// # Arguments
/// * `file_path` - Null-terminated C string path to the export file
/// * `db_path` - Null-terminated C string path to the SQLite database
/// 
/// # Returns
/// * `0` on success
/// * `-1` on error
#[no_mangle]
pub extern "C" fn processor_import_file(
    file_path: *const c_char, 
    db_path: *const c_char
) -> c_int {
    let file_path = match unsafe { CStr::from_ptr(file_path) }.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };
    
    let db_path = match unsafe { CStr::from_ptr(db_path) }.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    match import_to_database(vec![file_path.into()], Path::new(db_path), None) {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

/// Discover conversations from chat export files without importing (Stage 1).
/// 
/// Analyzes chat export files and returns JSON containing metadata about
/// discovered conversations. This allows the consumer to decide which
/// conversations should be merged before importing.
/// 
/// # Arguments
/// * `file_path` - Null-terminated C string path to the export file
/// 
/// # Returns
/// * Null-terminated JSON string with discovery results, or null on error
/// * Caller must free the returned string with `processor_string_free`
#[no_mangle]
pub extern "C" fn processor_discover_conversations(file_path: *const c_char) -> *mut c_char {
    let file_path = match unsafe { CStr::from_ptr(file_path) }.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    match discover_conversations(vec![file_path.into()]) {
        Ok(result) => match serde_json::to_string(&result) {
            Ok(json) => match CString::new(json) {
                Ok(cstring) => cstring.into_raw(),
                Err(_) => std::ptr::null_mut(),
            },
            Err(_) => std::ptr::null_mut(),
        },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Import chat export files with merge instructions (Stage 2).
/// 
/// Imports chat export files into a SQLite database, using the provided
/// merge instructions to combine overlapping conversations.
/// 
/// # Arguments
/// * `file_path` - Null-terminated C string path to the export file
/// * `db_path` - Null-terminated C string path to the SQLite database
/// * `merges_json` - Null-terminated JSON string with merge instructions, or null for no merges
/// 
/// # Returns
/// * `0` on success
/// * `-1` on error
#[no_mangle]
pub extern "C" fn processor_import_with_merges(
    file_path: *const c_char,
    db_path: *const c_char,
    merges_json: *const c_char,
) -> c_int {
    let file_path = match unsafe { CStr::from_ptr(file_path) }.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };
    
    let db_path = match unsafe { CStr::from_ptr(db_path) }.to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let merges = if merges_json.is_null() {
        None
    } else {
        let merges_str = match unsafe { CStr::from_ptr(merges_json) }.to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        };
        
        if merges_str.is_empty() {
            None
        } else {
            match serde_json::from_str::<Vec<ConversationMerge>>(merges_str) {
                Ok(parsed_merges) => Some(parsed_merges),
                Err(_) => return -1,
            }
        }
    };

    match import_to_database(vec![file_path.into()], Path::new(db_path), merges) {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

/// List contents of a ZIP archive.
/// 
/// # Arguments  
/// * `archive_path` - Null-terminated C string path to ZIP file
/// 
/// # Returns
/// * Null-terminated JSON string with file list, or null on error
/// * Caller must free the returned string with `processor_string_free`
#[no_mangle]
pub extern "C" fn processor_list_archive_contents(archive_path: *const c_char) -> *mut c_char {
    let path_str = match unsafe { CStr::from_ptr(archive_path) }.to_str() {
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
#[no_mangle]
pub extern "C" fn processor_string_free(s: *mut c_char) {
    if !s.is_null() {
        unsafe { 
            let _ = CString::from_raw(s);
        }
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
