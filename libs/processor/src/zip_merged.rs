use std::collections::BTreeMap;
use std::fs::File;
use std::os::fd::OwnedFd;
use std::path::Path;

use ::zip::read::ZipArchive;

/// Simple tree node representing merged ZIP contents.
/// The fields are private; construct via `build_merged_tree_from_fds` and
/// render using `write_tree_debug` or `write_tree_to_path`.
#[derive(Default)]
pub struct Node {
    children: BTreeMap<String, Node>,
    is_file: bool,
}

impl Node {
    fn add_path(&mut self, path: &str, is_dir: bool) {
        let mut comps = path.split('/').filter(|c| !c.is_empty()).peekable();
        let mut cur = self;

        while let Some(part) = comps.next() {
            let is_last = comps.peek().is_none();
            let entry_is_dir = if is_last { is_dir } else { true };
            cur = cur.children.entry(part.to_string()).or_default();
            if is_last && !entry_is_dir {
                cur.is_file = true;
            }
        }
    }

    fn fmt_into(&self, buf: &mut String, prefix: &str, name: &str, is_last: bool) {
        if !name.is_empty() {
            buf.push_str(prefix);
            buf.push_str(if is_last { "└─ " } else { "├─ " });
            buf.push_str(name);
            buf.push('\n');
        }

        let child_prefix = if name.is_empty() {
            String::new()
        } else if is_last {
            format!("{}   ", prefix)
        } else {
            format!("{}│  ", prefix)
        };

        let len = self.children.len();
        for (idx, (child_name, child)) in self.children.iter().enumerate() {
            let last = idx + 1 == len;
            child.fmt_into(buf, &child_prefix, child_name, last);
        }
    }
}

/// Build and return the merged directory tree root node from multiple ZIP files.
pub fn build_merged_tree_from_fds(fds: Vec<OwnedFd>) -> Result<Node, String> {
    let mut root = Node::default();

    for (idx, owned_fd) in fds.into_iter().enumerate() {
        let file = File::from(owned_fd);
        let mut archive = ZipArchive::new(file)
            .map_err(|e| format!("ZIP {}: failed to open archive: {}", idx, e))?;

        for i in 0..archive.len() {
            let entry = archive
                .by_index(i)
                .map_err(|e| format!("ZIP {}: failed to read entry {}: {}", idx, i, e))?;

            let name = entry.name().to_string();
            let is_dir = entry.is_dir() || name.ends_with('/') || name.is_empty();
            root.add_path(&name, is_dir);
        }
    }

    Ok(root)
}

fn render_tree_text(root: &Node) -> String {
    let mut out = String::new();
    out.push_str("Merged ZIP Tree\n");
    out.push_str("================\n");
    if root.children.is_empty() {
        out.push_str("(empty)\n");
    } else {
        let len = root.children.len();
        for (idx, (name, child)) in root.children.iter().enumerate() {
            let last = idx + 1 == len;
            child.fmt_into(&mut out, "", name, last);
        }
    }
    out
}

/// Convenience: write the provided root tree to "debug.txt" in CWD.
pub fn write_tree_debug(root: &Node) -> Result<(), String> {
    let output_path = "debug.txt";

    let out = render_tree_text(root);
    std::fs::write(&output_path, out).map_err(|e| format!("Failed to write {}: {}", output_path, e))
}
