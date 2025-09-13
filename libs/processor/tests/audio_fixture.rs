use std::path::PathBuf;

#[test]
fn audio_duration_messenger_mp4_fixture() {
    // Known messenger audio clip (approx 3.51s -> rounds to 4s)
    let path: PathBuf = [
        env!("CARGO_MANIFEST_DIR"),
        "tests",
        "test-audio",
        "messenger",
        "audioclip15773984540003506_573016540158892.mp4",
    ]
    .iter()
    .collect();

    let mut f = std::fs::File::open(&path).expect("open messenger mp4 fixture");
    let dur = processor::utils::audio::detect_duration_seconds(path.to_str().unwrap(), &mut f)
        .expect("duration for messenger mp4 fixture");
    assert!(
        (3..=5).contains(&dur),
        "expected ~4s (rounded), got {} (path {:?})",
        dur,
        path
    );
}

