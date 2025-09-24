use crate::progress::{self, ProgressCallback};

/// Register a callback to receive import progress updates.
#[no_mangle]
pub unsafe extern "C" fn processor_set_progress_callback(callback: ProgressCallback) {
    progress::set_progress_callback(Some(callback));
}

/// Clear any registered progress callback.
#[no_mangle]
pub unsafe extern "C" fn processor_clear_progress_callback() {
    progress::set_progress_callback(None);
}

/// Signal that the in-flight import should cancel as soon as practical.
#[no_mangle]
pub unsafe extern "C" fn processor_request_cancel_import() {
    progress::request_cancel();
}
