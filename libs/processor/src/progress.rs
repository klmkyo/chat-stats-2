use once_cell::sync::Lazy;
use std::sync::Mutex;

pub type ProgressCallback = unsafe extern "C" fn(processed: u32, total: u32);

static PROGRESS_CALLBACK: Lazy<Mutex<Option<ProgressCallback>>> = Lazy::new(|| Mutex::new(None));

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
