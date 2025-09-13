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

#[test]
fn audio_duration_messenger_mislabeled_wav_fixture() {
    // File extension is .wav but container is MP4/AAC; parser must sniff.
    let path: PathBuf = [
        env!("CARGO_MANIFEST_DIR"),
        "tests",
        "test-audio",
        "messenger",
        "audio_clip_824795835818430.wav",
    ]
    .iter()
    .collect();

    let data = std::fs::read(&path).expect("read mislabeled wav fixture");
    let mut cursor = std::io::Cursor::new(data);
    let dur = processor::utils::audio::detect_duration_seconds("file.bin", &mut cursor)
        .expect("duration for mislabeled wav fixture");
    // ffprobe reports 16.73s; our parser should round near 17
    assert!(
        (16..=18).contains(&dur),
        "expected ~17s (rounded), got {} (path {:?})",
        dur,
        path
    );
}
