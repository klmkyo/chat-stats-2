use once_cell::sync::Lazy;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};

pub type ProgressCallback = unsafe extern "C" fn(processed: u32, total: u32);

static PROGRESS_CALLBACK: Lazy<Mutex<Option<ProgressCallback>>> = Lazy::new(|| Mutex::new(None));
static CANCEL_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn set_progress_callback(callback: Option<ProgressCallback>) {
    let mut guard = PROGRESS_CALLBACK
        .lock()
        .expect("progress callback mutex poisoned");
    *guard = callback;
}

fn with_callback<F>(f: F)
where
    F: FnOnce(ProgressCallback),
{
    let callback_opt = {
        let guard = PROGRESS_CALLBACK
            .lock()
            .expect("progress callback mutex poisoned");
        *guard
    };

    if let Some(cb) = callback_opt {
        f(cb);
    }
}

pub fn report_progress(processed: u32, total: u32) {
    with_callback(|cb| unsafe {
        cb(processed, total);
    });
}

/// Signal that the current import should cancel as soon as possible.
pub fn request_cancel() {
    CANCEL_REQUESTED.store(true, Ordering::SeqCst);
}

/// Clear any pending cancellation signal - typically called before a new import.
pub fn clear_cancel() {
    CANCEL_REQUESTED.store(false, Ordering::SeqCst);
}

/// Returns true if a cancellation was requested by the host application.
pub fn cancellation_requested() -> bool {
    CANCEL_REQUESTED.load(Ordering::SeqCst)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ImportCancelled;

impl std::fmt::Display for ImportCancelled {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "import cancelled")
    }
}

impl std::error::Error for ImportCancelled {}

/// Helper to bail out early when a cancellation has been requested.
pub fn ensure_not_cancelled() -> Result<(), ImportCancelled> {
    if cancellation_requested() {
        Err(ImportCancelled)
    } else {
        Ok(())
    }
}

#[derive(Debug, Default)]
pub struct ImportProgressTracker {
    processed: u32,
    total: u32,
}

impl ImportProgressTracker {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self) {
        self.processed = 0;
        self.total = 0;
        report_progress(0, 0);
    }

    pub fn add_total(&mut self, additional: u32) {
        if additional == 0 {
            return;
        }
        self.total = self.total.saturating_add(additional);
        report_progress(self.processed, self.total);
    }

    pub fn advance(&mut self, delta: u32) {
        if delta == 0 {
            return;
        }
        self.processed = self.processed.saturating_add(delta);
        report_progress(self.processed, self.total);
    }
}
