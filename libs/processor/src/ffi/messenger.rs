use std::ffi::CStr;
use std::os::raw::c_char;
use std::path::{Path, PathBuf};

use crate::importers::messenger::import_messenger_exports;
use crate::progress;

const STATUS_SUCCESS: &CStr = unsafe { CStr::from_bytes_with_nul_unchecked(b"success\0") };
const STATUS_CANCELLED: &CStr = unsafe { CStr::from_bytes_with_nul_unchecked(b"cancelled\0") };
const STATUS_ERROR: &CStr = unsafe { CStr::from_bytes_with_nul_unchecked(b"error\0") };

#[inline]
fn status_ptr(status: &'static CStr) -> *const c_char {
    status.as_ptr()
}

/// Import a single Messenger export file (ZIP or JSON) into a SQLite database.
///
/// Returns a pointer to a static null-terminated status string:
/// - `"success"` once the import finishes
/// - `"cancelled"` if the host requested cancellation
/// - `"error"` when any other failure occurs
///
/// # Safety
/// - `file_path` and `db_path` must be valid pointers to null-terminated C strings.
/// - Pointers must remain valid for the duration of the call.
#[no_mangle]
pub unsafe extern "C" fn processor_import_messenger_file(
    file_path: *const c_char,
    db_path: *const c_char,
) -> *const c_char {
    let file_path = match CStr::from_ptr(file_path).to_str() {
        Ok(s) => s,
        Err(_) => return status_ptr(STATUS_ERROR),
    };

    let db_path = match CStr::from_ptr(db_path).to_str() {
        Ok(s) => s,
        Err(_) => return status_ptr(STATUS_ERROR),
    };

    progress::clear_cancel();
    let result = import_messenger_exports(vec![file_path.into()], Path::new(db_path));
    let cancelled = progress::cancellation_requested();
    if cancelled {
        progress::clear_cancel();
    }

    match result {
        Ok(_) => {
            progress::clear_cancel();
            status_ptr(STATUS_SUCCESS)
        }
        Err(_) if cancelled => {
            progress::clear_cancel();
            status_ptr(STATUS_CANCELLED)
        }
        Err(_) => {
            progress::clear_cancel();
            status_ptr(STATUS_ERROR)
        }
    }
}

/// Import multiple Messenger export files described by a JSON array.
///
/// The JSON string must decode to `Vec<String>` containing absolute file paths.
/// Returns the same status strings as [`processor_import_messenger_file`].
///
/// # Safety
/// - `file_list_json` and `db_path` must be valid pointers to null-terminated C strings.
/// - Callers retain ownership of the provided pointers.
#[no_mangle]
pub unsafe extern "C" fn processor_import_messenger_archives_json(
    file_list_json: *const c_char,
    db_path: *const c_char,
) -> *const c_char {
    let file_list_json = match CStr::from_ptr(file_list_json).to_str() {
        Ok(s) => s,
        Err(_) => return status_ptr(STATUS_ERROR),
    };

    let db_path = match CStr::from_ptr(db_path).to_str() {
        Ok(s) => s,
        Err(_) => return status_ptr(STATUS_ERROR),
    };

    let file_paths: Vec<String> = match serde_json::from_str(file_list_json) {
        Ok(paths) => paths,
        Err(_) => return status_ptr(STATUS_ERROR),
    };

    let path_bufs: Vec<PathBuf> = file_paths.into_iter().map(PathBuf::from).collect();

    progress::clear_cancel();
    let result = import_messenger_exports(path_bufs, Path::new(db_path));
    let cancelled = progress::cancellation_requested();
    if cancelled {
        progress::clear_cancel();
    }

    match result {
        Ok(_) => {
            progress::clear_cancel();
            status_ptr(STATUS_SUCCESS)
        }
        Err(_) if cancelled => {
            progress::clear_cancel();
            status_ptr(STATUS_CANCELLED)
        }
        Err(_) => {
            progress::clear_cancel();
            status_ptr(STATUS_ERROR)
        }
    }
}
