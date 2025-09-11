use crate::adapters::messenger::export::facebook::json::FacebookExportRoot;

/// Interpret a Unicode string as if each character were a single ISO-8859-1 byte,
/// then decode those bytes as UTF-8. This reverses typical "Ã©"-style mojibake.
fn fix_latin1_mojibake(s: &str) -> String {
    // Map each Unicode scalar's lower 8 bits to a byte, similar to Node's Buffer(..., 'latin1').
    let bytes: Vec<u8> = s.chars().map(|ch| (ch as u32) as u8).collect();
    match String::from_utf8(bytes) {
        Ok(utf8) => utf8,
        Err(_) => s.to_string(),
    }
}

/// Recursively fix mojibake across the parsed Messenger structures.
pub fn fix_messenger_encoding(mut root: FacebookExportRoot) -> FacebookExportRoot {
    // Top-level fields
    root.title = fix_latin1_mojibake(&root.title);
    root.thread_path = fix_latin1_mojibake(&root.thread_path);

    if let Some(img) = root.image.as_mut() {
        img.uri = fix_latin1_mojibake(&img.uri);
    }
    if let Some(jm) = root.joinable_mode.as_mut() {
        jm.link = fix_latin1_mojibake(&jm.link);
    }

    for p in root.participants.iter_mut() {
        p.name = fix_latin1_mojibake(&p.name);
    }

    for m in root.messages.iter_mut() {
        m.sender_name = fix_latin1_mojibake(&m.sender_name);
        if let Some(ref content) = m.content {
            m.content = Some(fix_latin1_mojibake(content));
        }

        if let Some(ref mut afs) = m.audio_files {
            for a in afs.iter_mut() {
                a.uri = fix_latin1_mojibake(&a.uri);
            }
        }

        if let Some(ref mut rs) = m.reactions {
            for r in rs.iter_mut() {
                r.reaction = fix_latin1_mojibake(&r.reaction);
                r.actor = fix_latin1_mojibake(&r.actor);
            }
        }

        if let Some(ref mut vs) = m.videos {
            for v in vs.iter_mut() {
                v.uri = fix_latin1_mojibake(&v.uri);
            }
        }

        if let Some(ref mut ps) = m.photos {
            for p in ps.iter_mut() {
                p.uri = fix_latin1_mojibake(&p.uri);
            }
        }

        if let Some(ref mut sh) = m.share {
            if let Some(ref link) = sh.link {
                sh.link = Some(fix_latin1_mojibake(link));
            }
            if let Some(ref text) = sh.share_text {
                sh.share_text = Some(fix_latin1_mojibake(text));
            }
        }

        if let Some(ref mut gs) = m.gifs {
            for g in gs.iter_mut() {
                g.uri = fix_latin1_mojibake(&g.uri);
            }
        }

        if let Some(ref mut st) = m.sticker {
            st.uri = fix_latin1_mojibake(&st.uri);
        }
    }

    root
}
