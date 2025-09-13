//! Audio duration detection without external dependencies.
//!
//! This module provides utilities for extracting audio duration from common formats
//! using byte-level parsing only (std). Supported formats include:
//! - WAV (RIFF/WAVE)
//! - MP4/M4A (ISO BMFF) via `mvhd`/`mdhd`
//! - MP3 (frames + optional Xing/Info/VBRI)
//! - Ogg Opus (granule position & pre-skip)

use std::io::Read;
///
/// # Arguments
/// - `path_hint`: File path or name used for extension hinting.
/// - `reader`: Input stream with audio bytes. Read fully into memory to allow seeking.
///
/// # Returns
/// - `Some(duration_seconds)` rounded to whole seconds
/// - `None` if format unsupported or parsing fails
///
/// # Example
/// ```rust,no_run
/// use std::fs::File;
/// use processor::utils::audio::detect_duration_seconds;
///
/// let mut file = File::open("audio.mp3").unwrap();
/// if let Some(duration) = detect_duration_seconds("audio.mp3", &mut file) {
///     println!("Duration: {} seconds", duration);
/// }
/// ```
pub fn detect_duration_seconds<R: Read>(path_hint: &str, reader: &mut R) -> Option<i64> {
    // Read the entire stream into memory (input may be non-seekable like zip entries)
    let mut buf = Vec::new();
    if reader.read_to_end(&mut buf).is_err() || buf.is_empty() {
        return None;
    }

    let ext = path_extension_lower(path_hint);

    // Try by extension first
    let mut seconds = match ext.as_deref() {
        Some("wav") => parse_wav_duration(&buf),
        Some("m4a") | Some("mp4") | Some("mov") => parse_mp4_duration(&buf),
        Some("mp3") => parse_mp3_duration(&buf),
        Some("opus") | Some("oga") | Some("ogg") => parse_ogg_opus_duration(&buf),
        _ => None,
    };

    // Fallback: sniff by header if extension didn't help
    if seconds.is_none() {
        seconds = sniff_and_parse(&buf);
    }

    seconds.map(|s| s.round() as i64).filter(|&s| s > 0)
}

/// Alternative function that takes a path and handles file opening internally.
///
/// This is a convenience wrapper around `detect_duration_seconds` for cases
/// where you have a file path rather than an open reader.
///
/// # Arguments
/// * `path` - Path to the audio file
///
/// # Returns
/// * `Some(duration_seconds)` - Duration in whole seconds (rounded)
/// * `None` - If the file cannot be opened or duration cannot be determined
pub fn detect_duration_from_path(path: &str) -> Option<i64> {
    match std::fs::File::open(path) {
        Ok(mut file) => detect_duration_seconds(path, &mut file),
        Err(e) => {
            eprintln!("Failed to open audio file '{}': {}", path, e);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_unsupported_format() {
        let data = b"not audio data";
        let mut cursor = Cursor::new(data);
        let result = detect_duration_seconds("test.bin", &mut cursor);
        assert_eq!(result, None);
    }

    #[test]
    fn test_empty_data() {
        let data = b"";
        let mut cursor = Cursor::new(data);
        let result = detect_duration_seconds("test.mp3", &mut cursor);
        assert_eq!(result, None);
    }
}

// ------------------
// Helpers & Parsers
// ------------------

fn path_extension_lower(path: &str) -> Option<String> {
    std::path::Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_ascii_lowercase())
}

fn sniff_and_parse(buf: &[u8]) -> Option<f64> {
    // OggS
    if buf.len() >= 4 && &buf[0..4] == b"OggS" {
        if let Some(s) = parse_ogg_opus_duration(buf) {
            return Some(s);
        }
    }
    // WAV RIFF/WAVE
    if buf.len() >= 12 && &buf[0..4] == b"RIFF" && &buf[8..12] == b"WAVE" {
        if let Some(s) = parse_wav_duration(buf) {
            return Some(s);
        }
    }
    // MP4: scan for 'ftyp' or 'moov'
    if let Some(s) = parse_mp4_duration(buf) {
        return Some(s);
    }
    // MP3: try frame parsing
    parse_mp3_duration(buf)
}

// WAV duration: parse RIFF/WAVE, fmt and data chunk
fn parse_wav_duration(buf: &[u8]) -> Option<f64> {
    if buf.len() < 44 {
        return None;
    }
    if &buf[0..4] != b"RIFF" || &buf[8..12] != b"WAVE" {
        return None;
    }

    let mut pos = 12usize; // after RIFF header
    let mut sample_rate: Option<u32> = None;
    let mut block_align: Option<u16> = None;
    let mut data_size: Option<u32> = None;

    while pos + 8 <= buf.len() {
        let id = &buf[pos..pos + 4];
        let size =
            u32::from_le_bytes([buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]]) as usize;
        pos += 8;
        if pos + size > buf.len() {
            break;
        }
        match id {
            b"fmt " => {
                if size >= 16 {
                    let audio_format = u16::from_le_bytes([buf[pos], buf[pos + 1]]);
                    let _channels = u16::from_le_bytes([buf[pos + 2], buf[pos + 3]]);
                    let sr = u32::from_le_bytes([
                        buf[pos + 4],
                        buf[pos + 5],
                        buf[pos + 6],
                        buf[pos + 7],
                    ]);
                    let _byte_rate = u32::from_le_bytes([
                        buf[pos + 8],
                        buf[pos + 9],
                        buf[pos + 10],
                        buf[pos + 11],
                    ]);
                    let ba = u16::from_le_bytes([buf[pos + 12], buf[pos + 13]]);
                    let _bits_per_sample = if size >= 16 {
                        u16::from_le_bytes([buf[pos + 14], buf[pos + 15]])
                    } else {
                        0
                    };
                    // We only support PCM/IEEE float via data-size method
                    if audio_format == 1 || audio_format == 3 {
                        sample_rate = Some(sr);
                        block_align = Some(ba);
                    }
                }
            }
            b"data" => {
                data_size = Some(size as u32);
            }
            _ => {}
        }
        // Chunks are word-aligned; sizes are even, but if odd, skip pad byte
        pos += size + (size & 1);
    }

    match (sample_rate, block_align, data_size) {
        (Some(sr), Some(ba), Some(ds)) if sr > 0 && ba > 0 => {
            let total_samples = (ds as u64) / (ba as u64);
            Some(total_samples as f64 / sr as f64)
        }
        _ => None,
    }
}

// MP4/M4A duration: find moov/mvhd or mdhd for audio track
fn parse_mp4_duration(buf: &[u8]) -> Option<f64> {
    // Top-level box scan
    let mut pos = 0usize;
    while pos + 8 <= buf.len() {
        let size = u32::from_be_bytes([buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]]) as u64;
        let typ = &buf[pos + 4..pos + 8];
        let mut box_size = size;
        let mut header = 8usize;
        if size == 1 {
            if pos + 16 > buf.len() {
                return None;
            }
            box_size = u64::from_be_bytes([
                buf[pos + 8],
                buf[pos + 9],
                buf[pos + 10],
                buf[pos + 11],
                buf[pos + 12],
                buf[pos + 13],
                buf[pos + 14],
                buf[pos + 15],
            ]);
            header = 16;
        } else if size == 0 {
            box_size = (buf.len() - pos) as u64;
        }
        if box_size < header as u64 {
            return None;
        }

        if typ == b"moov" {
            let start = pos + header;
            let end = (pos as u64 + box_size) as usize;
            if end > buf.len() {
                return None;
            }
            if let Some(s) = parse_moov_for_duration(&buf[start..end]) {
                return Some(s);
            } else {
                return None;
            }
        }

        pos = (pos as u64 + box_size) as usize;
    }
    None
}

fn parse_moov_for_duration(moov: &[u8]) -> Option<f64> {
    // First prefer mvhd
    let mut pos = 0usize;
    while pos + 8 <= moov.len() {
        let size =
            u32::from_be_bytes([moov[pos], moov[pos + 1], moov[pos + 2], moov[pos + 3]]) as u64;
        let typ = &moov[pos + 4..pos + 8];
        let mut box_size = size;
        let mut header = 8usize;
        if size == 1 {
            if pos + 16 > moov.len() {
                return None;
            }
            box_size = u64::from_be_bytes([
                moov[pos + 8],
                moov[pos + 9],
                moov[pos + 10],
                moov[pos + 11],
                moov[pos + 12],
                moov[pos + 13],
                moov[pos + 14],
                moov[pos + 15],
            ]);
            header = 16;
        } else if size == 0 {
            box_size = (moov.len() - pos) as u64;
        }
        if box_size < header as u64 || (pos as u64 + box_size) as usize > moov.len() {
            return None;
        }

        if typ == b"mvhd" {
            let body = &moov[pos + header..(pos as u64 + box_size) as usize];
            if let Some(s) = parse_mvhd(body) {
                return Some(s);
            }
        }

        pos = (pos as u64 + box_size) as usize;
    }

    // Fallback: find mdhd inside audio trak
    // Iterate traks
    pos = 0;
    while pos + 8 <= moov.len() {
        let size =
            u32::from_be_bytes([moov[pos], moov[pos + 1], moov[pos + 2], moov[pos + 3]]) as u64;
        let typ = &moov[pos + 4..pos + 8];
        let mut box_size = size;
        let mut header = 8usize;
        if size == 1 {
            if pos + 16 > moov.len() {
                return None;
            }
            box_size = u64::from_be_bytes([
                moov[pos + 8],
                moov[pos + 9],
                moov[pos + 10],
                moov[pos + 11],
                moov[pos + 12],
                moov[pos + 13],
                moov[pos + 14],
                moov[pos + 15],
            ]);
            header = 16;
        } else if size == 0 {
            box_size = (moov.len() - pos) as u64;
        }
        if box_size < header as u64 || (pos as u64 + box_size) as usize > moov.len() {
            return None;
        }
        if typ == b"trak" {
            let trak_body = &moov[pos + header..(pos as u64 + box_size) as usize];
            if let Some(s) = parse_trak_for_audio_mdhd(trak_body) {
                return Some(s);
            }
        }
        pos = (pos as u64 + box_size) as usize;
    }

    None
}

fn parse_mvhd(body: &[u8]) -> Option<f64> {
    if body.len() < 20 {
        return None;
    }
    let version = body[0];
    let (timescale, duration) = if version == 1 {
        if body.len() < 32 {
            return None;
        }
        let timescale = u32::from_be_bytes([body[20], body[21], body[22], body[23]]);
        let duration = u64::from_be_bytes([
            body[24], body[25], body[26], body[27], body[28], body[29], body[30], body[31],
        ]);
        (timescale, duration)
    } else {
        if body.len() < 16 {
            return None;
        }
        let timescale = u32::from_be_bytes([body[12], body[13], body[14], body[15]]);
        let duration = u32::from_be_bytes([body[16], body[17], body[18], body[19]]) as u64;
        (timescale, duration)
    };
    if timescale == 0 {
        return None;
    }
    Some(duration as f64 / timescale as f64)
}

fn parse_trak_for_audio_mdhd(trak: &[u8]) -> Option<f64> {
    // Find mdia
    let mut pos = 0usize;
    while pos + 8 <= trak.len() {
        let size =
            u32::from_be_bytes([trak[pos], trak[pos + 1], trak[pos + 2], trak[pos + 3]]) as u64;
        let typ = &trak[pos + 4..pos + 8];
        let mut box_size = size;
        let mut header = 8usize;
        if size == 1 {
            if pos + 16 > trak.len() {
                return None;
            }
            box_size = u64::from_be_bytes([
                trak[pos + 8],
                trak[pos + 9],
                trak[pos + 10],
                trak[pos + 11],
                trak[pos + 12],
                trak[pos + 13],
                trak[pos + 14],
                trak[pos + 15],
            ]);
            header = 16;
        } else if size == 0 {
            box_size = (trak.len() - pos) as u64;
        }
        if box_size < header as u64 || (pos as u64 + box_size) as usize > trak.len() {
            return None;
        }
        if typ == b"mdia" {
            let mdia = &trak[pos + header..(pos as u64 + box_size) as usize];
            return parse_mdia_for_audio_mdhd(mdia);
        }
        pos = (pos as u64 + box_size) as usize;
    }
    None
}

fn parse_mdia_for_audio_mdhd(mdia: &[u8]) -> Option<f64> {
    let mut pos = 0usize;
    let mut handler_is_audio = false;
    let mut mdhd_dur: Option<f64> = None;
    while pos + 8 <= mdia.len() {
        let size =
            u32::from_be_bytes([mdia[pos], mdia[pos + 1], mdia[pos + 2], mdia[pos + 3]]) as u64;
        let typ = &mdia[pos + 4..pos + 8];
        let mut box_size = size;
        let mut header = 8usize;
        if size == 1 {
            if pos + 16 > mdia.len() {
                return None;
            }
            box_size = u64::from_be_bytes([
                mdia[pos + 8],
                mdia[pos + 9],
                mdia[pos + 10],
                mdia[pos + 11],
                mdia[pos + 12],
                mdia[pos + 13],
                mdia[pos + 14],
                mdia[pos + 15],
            ]);
            header = 16;
        } else if size == 0 {
            box_size = (mdia.len() - pos) as u64;
        }
        if box_size < header as u64 || (pos as u64 + box_size) as usize > mdia.len() {
            return None;
        }
        if typ == b"hdlr" {
            let body = &mdia[pos + header..(pos as u64 + box_size) as usize];
            if body.len() >= 12 {
                // handler_type at offset 8
                let h = &body[8..12];
                if h == b"soun" {
                    handler_is_audio = true;
                }
            }
        } else if typ == b"mdhd" {
            let body = &mdia[pos + header..(pos as u64 + box_size) as usize];
            if let Some(s) = parse_mdhd(body) {
                mdhd_dur = Some(s);
            }
        }
        pos = (pos as u64 + box_size) as usize;
    }
    if handler_is_audio {
        mdhd_dur
    } else {
        None
    }
}

fn parse_mdhd(body: &[u8]) -> Option<f64> {
    if body.len() < 20 {
        return None;
    }
    let version = body[0];
    let (timescale, duration) = if version == 1 {
        if body.len() < 32 {
            return None;
        }
        let timescale = u32::from_be_bytes([body[20], body[21], body[22], body[23]]);
        let duration = u64::from_be_bytes([
            body[24], body[25], body[26], body[27], body[28], body[29], body[30], body[31],
        ]);
        (timescale, duration)
    } else {
        if body.len() < 16 {
            return None;
        }
        let timescale = u32::from_be_bytes([body[12], body[13], body[14], body[15]]);
        let duration = u32::from_be_bytes([body[16], body[17], body[18], body[19]]) as u64;
        (timescale, duration)
    };
    if timescale == 0 {
        return None;
    }
    Some(duration as f64 / timescale as f64)
}

// Ogg Opus duration: final granule - pre-skip at 48kHz
fn parse_ogg_opus_duration(buf: &[u8]) -> Option<f64> {
    let mut pos = 0usize;
    let mut pre_skip: u16 = 0;
    let mut have_preskip = false;
    let mut last_granule: Option<u64> = None;

    while pos + 27 <= buf.len() {
        if &buf[pos..pos + 4] != b"OggS" {
            return None;
        }
        let version = buf[pos + 4];
        if version != 0 {
            return None;
        }
        let header_type = buf[pos + 5];
        let granule = u64::from_le_bytes([
            buf[pos + 6],
            buf[pos + 7],
            buf[pos + 8],
            buf[pos + 9],
            buf[pos + 10],
            buf[pos + 11],
            buf[pos + 12],
            buf[pos + 13],
        ]);
        let page_segments = buf[pos + 26] as usize;
        let seg_table_start = pos + 27;
        if seg_table_start + page_segments > buf.len() {
            return None;
        }
        let payload_len: usize = buf[seg_table_start..seg_table_start + page_segments]
            .iter()
            .map(|&b| b as usize)
            .sum();
        let payload_start = seg_table_start + page_segments;
        let payload_end = payload_start + payload_len;
        if payload_end > buf.len() {
            return None;
        }

        if (header_type & 0x02) != 0 {
            // BOS
            // Expect OpusHead in first packet
            if payload_len >= 19 && &buf[payload_start..payload_start + 8] == b"OpusHead" {
                // pre-skip at bytes 10..12 (little endian)
                if payload_len >= 12 {
                    pre_skip =
                        u16::from_le_bytes([buf[payload_start + 10], buf[payload_start + 11]]);
                    have_preskip = true;
                }
            }
        }

        if (header_type & 0x04) != 0 {
            // EOS
            last_granule = Some(granule);
            // We can break; EOS page is final
            let g = last_granule?;
            let ps = if have_preskip { pre_skip as u64 } else { 0 };
            if g < ps {
                return None;
            }
            let samples = g - ps;
            return Some(samples as f64 / 48000.0);
        }

        // Not EOS: move to next page
        pos = payload_end;
        // Small resync: scan for next 'OggS' if alignment lost
        if pos + 4 <= buf.len() && &buf[pos..pos + 4] != b"OggS" {
            if let Some(next) = memmem(&buf[pos..], b"OggS").map(|o| pos + o) {
                pos = next;
            }
        }
        // Track granule in case EOS not flagged (shouldn't happen)
        last_granule = Some(granule);
    }

    // If we exited without EOS but have granule, compute anyway
    if let Some(g) = last_granule {
        let ps = pre_skip as u64;
        if g >= ps {
            return Some((g - ps) as f64 / 48000.0);
        }
    }
    None
}

// MP3 duration: parse frames; prefer Xing/Info/VBRI frame count, else count frames
fn parse_mp3_duration(buf: &[u8]) -> Option<f64> {
    let mut offset = 0usize;
    // Skip ID3v2 if present
    if buf.len() >= 10 && &buf[0..3] == b"ID3" {
        let flags = buf[5];
        let size = synchsafe_to_u32(&buf[6..10]) as usize;
        let mut skip = 10 + size;
        if (flags & 0x10) != 0 {
            // footer present
            skip += 10;
        }
        if skip < buf.len() {
            offset = skip;
        } else {
            return None;
        }
    }

    // Scan to first valid frame header
    let mut i = offset;
    let mut first_header = None;
    while i + 4 <= buf.len() {
        if let Some(h) = Mp3Header::parse(&buf[i..i + 4]) {
            first_header = Some((i, h));
            break;
        }
        i += 1;
    }
    let (first_pos, header) = first_header?;

    // Try Xing/Info or VBRI headers for total frames
    if let Some(frames) = parse_xing_info(buf, first_pos, &header) {
        let total_samples = frames as u64 * header.samples_per_frame() as u64;
        return Some(total_samples as f64 / header.sample_rate as f64);
    }
    if let Some(frames) = parse_vbri(buf, first_pos, &header) {
        let total_samples = frames as u64 * header.samples_per_frame() as u64;
        return Some(total_samples as f64 / header.sample_rate as f64);
    }

    // Fallback: count frames by iterating
    let mut pos = first_pos;
    let mut frames: u64 = 0;
    let mut last_valid = first_pos;
    while pos + 4 <= buf.len() {
        if let Some(h) = Mp3Header::parse(&buf[pos..pos + 4]) {
            let flen = h.frame_length()?;
            if flen < 4 {
                break;
            }
            frames += 1;
            last_valid = pos;
            pos = pos.saturating_add(flen);
        } else {
            // Possibly hit ID3v1 at end
            if buf.len() >= 128 && &buf[buf.len() - 128..buf.len() - 125] == b"TAG" {
                break;
            }
            // Resync: move forward a byte
            pos += 1;
        }
        // Safety: avoid infinite loops
        if frames > 1 && pos <= last_valid {
            break;
        }
    }
    if frames == 0 || header.sample_rate == 0 {
        return None;
    }
    let total_samples = frames * header.samples_per_frame() as u64;
    Some(total_samples as f64 / header.sample_rate as f64)
}

fn parse_xing_info(buf: &[u8], first_pos: usize, h: &Mp3Header) -> Option<u32> {
    // After header (+ CRC if present) + side info, check for 'Xing' or 'Info'
    let crc = if !h.protection_bit { 2 } else { 0 };
    let side = h.side_info_len();
    let start = first_pos + 4 + crc + side;
    if start + 12 > buf.len() {
        return None;
    }
    let tag = &buf[start..start + 4];
    if tag != b"Xing" && tag != b"Info" {
        return None;
    }
    let flags = u32::from_be_bytes([
        buf[start + 4],
        buf[start + 5],
        buf[start + 6],
        buf[start + 7],
    ]);
    if (flags & 0x1) == 0 {
        return None;
    }
    let frames = u32::from_be_bytes([
        buf[start + 8],
        buf[start + 9],
        buf[start + 10],
        buf[start + 11],
    ]);
    Some(frames)
}

fn parse_vbri(buf: &[u8], first_pos: usize, h: &Mp3Header) -> Option<u32> {
    // VBRI is located 32 bytes after header (common placement)
    let crc = if !h.protection_bit { 2 } else { 0 };
    let offset = first_pos + 4 + crc + 32;
    if offset + 26 > buf.len() {
        return None;
    }
    if &buf[offset..offset + 4] != b"VBRI" {
        return None;
    }
    // frames at offset 14 from 'VBRI'
    let frames_off = offset + 14;
    if frames_off + 4 > buf.len() {
        return None;
    }
    let frames = u32::from_be_bytes([
        buf[frames_off],
        buf[frames_off + 1],
        buf[frames_off + 2],
        buf[frames_off + 3],
    ]);
    Some(frames)
}

fn synchsafe_to_u32(b: &[u8]) -> u32 {
    ((b[0] as u32 & 0x7F) << 21)
        | ((b[1] as u32 & 0x7F) << 14)
        | ((b[2] as u32 & 0x7F) << 7)
        | (b[3] as u32 & 0x7F)
}

#[derive(Clone, Copy, Debug)]
struct Mp3Header {
    version_id: u8,       // 0=2.5, 1=reserved, 2=2, 3=1
    layer: u8,            // 1=III, 2=II, 3=I
    protection_bit: bool, // true => no CRC, false => CRC present
    bitrate_kbps: u16,
    sample_rate: u32,
    padding: bool,
    channel_mode: u8, // 3=mono
}

impl Mp3Header {
    fn parse(h: &[u8]) -> Option<Mp3Header> {
        if h.len() < 4 {
            return None;
        }
        let b0 = h[0];
        let b1 = h[1];
        let b2 = h[2];
        let b3 = h[3];
        if b0 != 0xFF || (b1 & 0xE0) != 0xE0 {
            return None;
        }
        let version_id = (b1 >> 3) & 0x03; // 00=2.5, 01=reserved,10=2,11=1
        let layer_bits = (b1 >> 1) & 0x03; // 01=III, 10=II, 11=I
        if version_id == 0x01 || layer_bits == 0x00 {
            return None;
        }
        let layer = match layer_bits {
            0b01 => 3,
            0b10 => 2,
            0b11 => 1,
            _ => return None,
        };
        let protection_bit = (b1 & 0x01) != 0x00; // 0 => CRC present
        let bitrate_index = (b2 >> 4) & 0x0F;
        let sample_rate_index = (b2 >> 2) & 0x03;
        if bitrate_index == 0 || bitrate_index == 0x0F || sample_rate_index == 0x03 {
            return None;
        }
        let padding = ((b2 >> 1) & 0x01) != 0;
        let channel_mode = (b3 >> 6) & 0x03;

        let sample_rate = match version_id {
            0b11 => [44100, 48000, 32000][sample_rate_index as usize], // MPEG1
            0b10 => [22050, 24000, 16000][sample_rate_index as usize], // MPEG2
            0b00 => [11025, 12000, 8000][sample_rate_index as usize],  // MPEG2.5
            _ => return None,
        } as u32;

        // Bitrate table by version+layer
        let bitrate_kbps = match (version_id, layer_bits) {
            (0b11, 0b01) => [
                0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
            ][bitrate_index as usize], // MPEG1 L3
            (0b10, 0b01) | (0b00, 0b01) => [
                0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
            ][bitrate_index as usize], // MPEG2/2.5 L3
            // For completeness, Layer I/II (not typical for .mp3)
            (0b11, 0b10) => [
                0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0,
            ][bitrate_index as usize],
            (0b10, 0b10) | (0b00, 0b10) => [
                0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
            ][bitrate_index as usize],
            (0b11, 0b11) => [
                0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0,
            ][bitrate_index as usize],
            (0b10, 0b11) | (0b00, 0b11) => [
                0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0,
            ][bitrate_index as usize],
            _ => 0,
        } as u16;
        if bitrate_kbps == 0 {
            return None;
        }

        Some(Mp3Header {
            version_id,
            layer,
            protection_bit,
            bitrate_kbps,
            sample_rate,
            padding,
            channel_mode,
        })
    }

    fn samples_per_frame(&self) -> u32 {
        match self.layer {
            1 => 384,  // Layer I
            2 => 1152, // Layer II
            3 => match self.version_id {
                0b11 => 1152,
                _ => 576,
            }, // Layer III
            _ => 0,
        }
    }

    fn side_info_len(&self) -> usize {
        // For Layer III only (common for MP3)
        if self.layer == 3 {
            // Layer III only
            let mono = self.channel_mode == 0b11;
            match self.version_id {
                0b11 => {
                    if mono {
                        17
                    } else {
                        32
                    }
                } // MPEG1
                _ => {
                    if mono {
                        9
                    } else {
                        17
                    }
                } // MPEG2/2.5
            }
        } else {
            0
        }
    }

    fn frame_length(&self) -> Option<usize> {
        let bps = (self.bitrate_kbps as u32) * 1000;
        let spf = self.samples_per_frame();
        if self.sample_rate == 0 {
            return None;
        }
        let base = (spf as u64 * bps as u64) / (8 * self.sample_rate as u64);
        let pad_units = if self.padding {
            if self.layer == 1 {
                4
            } else {
                1
            }
        } else {
            0
        };
        Some((base as usize) + pad_units)
    }
}

fn memmem(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() {
        return Some(0);
    }
    hay.windows(needle.len()).position(|w| w == needle)
}
