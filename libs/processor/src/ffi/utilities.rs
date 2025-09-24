use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use anyhow::Result;
use zip::ZipArchive;

/// List contents of a ZIP archive.
///
/// # Safety
/// - `archive_path` must point to a valid null-terminated C string.
/// - Caller owns the argument pointer.
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
/// # Safety
/// - `s` must be a pointer previously returned by this library.
#[no_mangle]
pub unsafe extern "C" fn processor_string_free(s: *mut c_char) {
    if !s.is_null() {
        let _ = CString::from_raw(s);
    }
}

fn list_archive_contents_internal(path: &str) -> Result<String> {
    use std::fs::File;

    let file = File::open(path)?;
    let archive = ZipArchive::new(file)?;

    let files: Vec<String> = archive.file_names().map(|s| s.to_string()).collect();
    Ok(serde_json::to_string(&files)?)
}
