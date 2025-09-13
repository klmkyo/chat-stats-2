use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::Command;

fn has_ffmpeg() -> bool {
    Command::new("ffmpeg").arg("-version").output().is_ok()
}

fn project_target_dir() -> PathBuf {
    // Put test artifacts inside the crate's target dir to stay within workspace writes.
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("target");
    p.push("test-audio");
    fs::create_dir_all(&p).ok();
    p
}

fn gen_wav(seconds: u32, name: &str) -> Option<PathBuf> {
    let out = project_target_dir().join(format!("{}.wav", name));
    let status = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=1000:duration={}", seconds),
            "-c:a",
            "pcm_s16le",
            "-ar",
            "44100",
            out.to_str().unwrap(),
        ])
        .status();
    match status {
        Ok(s) if s.success() => Some(out),
        _ => None,
    }
}

fn gen_m4a(seconds: u32, name: &str) -> Option<PathBuf> {
    let out = project_target_dir().join(format!("{}.m4a", name));
    let status = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=1000:duration={}", seconds),
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            out.to_str().unwrap(),
        ])
        .status();
    match status {
        Ok(s) if s.success() => Some(out),
        _ => None,
    }
}

fn gen_mp4(seconds: u32, name: &str) -> Option<PathBuf> {
    let out = project_target_dir().join(format!("{}.mp4", name));
    let status = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=1000:duration={}", seconds),
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            out.to_str().unwrap(),
        ])
        .status();
    match status {
        Ok(s) if s.success() => Some(out),
        _ => None,
    }
}

fn gen_aac(seconds: u32, name: &str) -> Option<PathBuf> {
    let out = project_target_dir().join(format!("{}.aac", name));
    let status = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=1000:duration={}", seconds),
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-f",
            "adts",
            out.to_str().unwrap(),
        ])
        .status();
    match status {
        Ok(s) if s.success() => Some(out),
        _ => None,
    }
}

fn gen_opus(seconds: u32, name: &str) -> Option<PathBuf> {
    let out = project_target_dir().join(format!("{}.opus", name));
    let status = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=1000:duration={}", seconds),
            "-c:a",
            "libopus",
            "-b:a",
            "64k",
            out.to_str().unwrap(),
        ])
        .status();
    match status {
        Ok(s) if s.success() => Some(out),
        _ => None,
    }
}

fn approx_eq_rounded_secs(val: i64, expected: i64, tol: i64) -> bool {
    (val - expected).abs() <= tol
}

#[test]
fn audio_duration_wav_ffmpeg() {
    if !has_ffmpeg() {
        eprintln!("ffmpeg not found; skipping wav test");
        return;
    }
    let path = match gen_wav(8, "test_tone_8s") {
        Some(p) => p,
        None => {
            eprintln!("failed to generate wav; skipping");
            return;
        }
    };
    let mut f = std::fs::File::open(&path).unwrap();
    let dur = processor::utils::audio::detect_duration_seconds(path.to_str().unwrap(), &mut f)
        .expect("duration for wav");
    assert!(
        approx_eq_rounded_secs(dur, 8, 1),
        "expected ~8s, got {} (path {:?})",
        dur,
        path
    );
}

#[test]
fn audio_duration_m4a_ffmpeg() {
    if !has_ffmpeg() {
        eprintln!("ffmpeg not found; skipping m4a test");
        return;
    }
    let path = match gen_m4a(8, "test_tone_8s") {
        Some(p) => p,
        None => {
            eprintln!("failed to generate m4a; skipping");
            return;
        }
    };
    let mut f = std::fs::File::open(&path).unwrap();
    let dur = processor::utils::audio::detect_duration_seconds(path.to_str().unwrap(), &mut f)
        .expect("duration for m4a");
    assert!(
        approx_eq_rounded_secs(dur, 8, 1),
        "expected ~8s, got {} (path {:?})",
        dur,
        path
    );
}

#[test]
fn audio_duration_mp4_ffmpeg() {
    if !has_ffmpeg() {
        eprintln!("ffmpeg not found; skipping mp4 test");
        return;
    }
    let path = match gen_mp4(8, "test_tone_8s_mp4") {
        Some(p) => p,
        None => {
            eprintln!("failed to generate mp4; skipping");
            return;
        }
    };
    let mut f = std::fs::File::open(&path).unwrap();
    let dur = processor::utils::audio::detect_duration_seconds(path.to_str().unwrap(), &mut f)
        .expect("duration for mp4");
    assert!(
        approx_eq_rounded_secs(dur, 8, 1),
        "expected ~8s, got {} (path {:?})",
        dur,
        path
    );
}

#[test]
fn audio_duration_opus_ffmpeg() {
    if !has_ffmpeg() {
        eprintln!("ffmpeg not found; skipping opus test");
        return;
    }
    let path = match gen_opus(8, "test_tone_8s_opus") {
        Some(p) => p,
        None => {
            eprintln!("failed to generate opus; skipping");
            return;
        }
    };
    let mut f = std::fs::File::open(&path).unwrap();
    let dur = processor::utils::audio::detect_duration_seconds(path.to_str().unwrap(), &mut f);
    // With lofty, Opus is now supported!
    assert!(dur.is_some(), "opus duration should be detected");
    let dur = dur.unwrap();
    assert!((7..=9).contains(&dur), "expected ~8s, got {}", dur);
}

#[test]
fn audio_duration_aac_ffmpeg() {
    if !has_ffmpeg() {
        eprintln!("ffmpeg not found; skipping aac test");
        return;
    }
    let path = match gen_aac(8, "test_tone_8s_aac") {
        Some(p) => p,
        None => {
            eprintln!("failed to generate aac; skipping");
            return;
        }
    };
    let mut f = std::fs::File::open(&path).unwrap();
    let dur = processor::utils::audio::detect_duration_seconds(path.to_str().unwrap(), &mut f)
        .expect("duration for aac");
    assert!(
        approx_eq_rounded_secs(dur, 8, 1),
        "expected ~8s, got {} (path {:?})",
        dur,
        path
    );
}

#[test]
fn audio_duration_sniff_mp4_header() {
    if !has_ffmpeg() {
        eprintln!("ffmpeg not found; skipping sniff test");
        return;
    }
    // Generate an m4a and pass a non-m4a hint to force header sniffing.
    let path = match gen_m4a(8, "test_tone_8s_sniff") {
        Some(p) => p,
        None => {
            eprintln!("failed to generate m4a; skipping");
            return;
        }
    };
    let mut buf = Vec::new();
    std::fs::File::open(&path)
        .unwrap()
        .read_to_end(&mut buf)
        .unwrap();
    let mut cursor = std::io::Cursor::new(buf);
    let dur = processor::utils::audio::detect_duration_seconds("file.bin", &mut cursor)
        .expect("duration via sniff");
    assert!(
        approx_eq_rounded_secs(dur, 8, 1),
        "expected ~8s, got {}",
        dur
    );
}
