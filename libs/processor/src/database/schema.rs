use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OpenFlags, Transaction};
use serde::{Deserialize, Serialize};

/// Thin wrapper around a `rusqlite` connection for message database access.
pub struct MessageDb {
    path: PathBuf,
    conn: Connection,
}

/// Transactional writer (RAII). Commit via `commit(self)`; rolls back on drop if not committed.
pub struct WriteBatch<'c> {
    tx: Option<Transaction<'c>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum ConversationType {
    #[serde(rename = "dm")]
    DM,
    #[serde(rename = "group")]
    Group,
}

impl ConversationType {
    fn as_str(self) -> &'static str {
        match self {
            ConversationType::DM => "dm",
            ConversationType::Group => "group",
        }
    }
}

impl MessageDb {
    /// Open an existing SQLite database at `db_path` and configure connection pragmas.
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self> {
        let path = db_path.as_ref().to_path_buf();

        if !path.exists() {
            bail!("database file does not exist at {}", path.display());
        }

        let conn = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_WRITE)
            .with_context(|| format!("opening sqlite db at {}", path.display()))?;

        // Pragmas tuned for on-device analytics: many reads, occasional writes.
        conn.pragma_update(None, "journal_mode", "WAL")
            .context("setting PRAGMA journal_mode=WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")
            .context("setting PRAGMA synchronous=NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .context("enabling foreign_keys")?;
        conn.pragma_update(None, "busy_timeout", 5000_i64)
            .context("setting PRAGMA busy_timeout=5000")?;

        Ok(Self { path, conn })
    }

    /// Start a write batch (single transaction). Commit with `commit(self)`.
    pub fn begin_write(&mut self) -> Result<WriteBatch<'_>> {
        let tx = self.conn.transaction()?;
        Ok(WriteBatch { tx: Some(tx) })
    }

    /// Borrow the inner connection for ad-hoc work (autocommit mode).
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Path to the underlying database file.
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl<'c> WriteBatch<'c> {
    /// Commit the transaction. After this, the batch can't be used.
    pub fn commit(mut self) -> Result<()> {
        if let Some(tx) = self.tx.take() {
            tx.commit()?;
        }
        Ok(())
    }

    // -----------------------------
    // Insert helpers (epoch seconds in)
    // -----------------------------

    pub fn insert_export(
        &mut self,
        source: &str,
        checksum: Option<&str>,
        meta_json: Option<&str>,
    ) -> Result<i64> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt = tx.prepare_cached(
            "INSERT INTO export(source, checksum, meta_json) VALUES (?1, ?2, ?3)",
        )?;
        stmt.execute(params![source, checksum, meta_json])?;
        Ok(tx.last_insert_rowid())
    }

    pub fn insert_canonical_person(
        &mut self,
        display_name: Option<&str>,
        avatar_uri: Option<&str>,
    ) -> Result<i64> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt = tx.prepare_cached(
            "INSERT INTO canonical_person(display_name, avatar_uri) VALUES (?1, ?2)",
        )?;
        stmt.execute(params![display_name, avatar_uri])?;
        Ok(tx.last_insert_rowid())
    }

    pub fn insert_canonical_conversation(
        &mut self,
        ctype: ConversationType,
        name: Option<&str>,
    ) -> Result<i64> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt =
            tx.prepare_cached("INSERT INTO canonical_conversation(type, name) VALUES (?1, ?2)")?;
        stmt.execute(params![ctype.as_str(), name])?;
        Ok(tx.last_insert_rowid())
    }

    /// Insert a conversation instance.
    pub fn insert_conversation(
        &mut self,
        ctype: ConversationType,
        image_uri: Option<&str>,
        name: Option<&str>,
        export_id: i64,
        canonical_conversation_id: i64,
    ) -> Result<i64> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt = tx.prepare_cached(
            "INSERT INTO conversation(type, image_uri, name, export_id, canonical_conversation_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        stmt.execute(params![
            ctype.as_str(),
            image_uri,
            name,
            export_id,
            canonical_conversation_id
        ])?;
        Ok(tx.last_insert_rowid())
    }

    /// Insert a person bound to a conversation and canonical person.
    pub fn insert_person(
        &mut self,
        conversation_id: i64,
        name: Option<&str>,
        avatar_uri: Option<&str>,
        canonical_person_id: i64,
    ) -> Result<i64> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt = tx.prepare_cached(
            "INSERT INTO person(conversation_id, name, avatar_uri, canonical_person_id)
             VALUES (?1, ?2, ?3, ?4)",
        )?;
        stmt.execute(params![
            conversation_id,
            name,
            avatar_uri,
            canonical_person_id
        ])?;
        Ok(tx.last_insert_rowid())
    }

    /// Insert a message (unsent stored as TRUE/FALSE integer literal).
    pub fn insert_message(
        &mut self,
        sender_id: i64,
        sent_at_epoch: i64,
        unsent: bool,
    ) -> Result<i64> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt =
            tx.prepare_cached("INSERT INTO message(sender, sent_at, unsent) VALUES (?1, ?2, ?3)")?;
        stmt.execute(params![
            sender_id,
            sent_at_epoch,
            if unsent { 1 } else { 0 }
        ])?;
        Ok(tx.last_insert_rowid())
    }

    /// Add text content to an existing message.
    pub fn add_message_text(&mut self, message_id: i64, text: &str) -> Result<()> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt =
            tx.prepare_cached("INSERT INTO message_text(message_id, text) VALUES (?1, ?2)")?;
        stmt.execute(params![message_id, text])?;
        Ok(())
    }

    /// Add an image attachment to an existing message.
    pub fn add_message_image(&mut self, message_id: i64, image_uri: &str) -> Result<()> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt =
            tx.prepare_cached("INSERT INTO message_image(message_id, image_uri) VALUES (?1, ?2)")?;
        stmt.execute(params![message_id, image_uri])?;
        Ok(())
    }

    /// Add a video attachment to an existing message.
    pub fn add_message_video(&mut self, message_id: i64, video_uri: &str) -> Result<()> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt =
            tx.prepare_cached("INSERT INTO message_video(message_id, video_uri) VALUES (?1, ?2)")?;
        stmt.execute(params![message_id, video_uri])?;
        Ok(())
    }

    /// Add a GIF attachment to an existing message.
    pub fn add_message_gif(&mut self, message_id: i64, gif_uri: &str) -> Result<()> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt =
            tx.prepare_cached("INSERT INTO message_gif(message_id, gif_uri) VALUES (?1, ?2)")?;
        stmt.execute(params![message_id, gif_uri])?;
        Ok(())
    }

    /// Add an audio attachment to an existing message.
    pub fn add_message_audio(
        &mut self,
        message_id: i64,
        audio_uri: &str,
        length_seconds: Option<i64>,
    ) -> Result<()> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt = tx.prepare_cached(
            "INSERT INTO message_audio(message_id, audio_uri, length_seconds)
             VALUES (?1, ?2, ?3)",
        )?;
        stmt.execute(params![message_id, audio_uri, length_seconds])?;
        Ok(())
    }

    /// Insert a reaction.
    pub fn insert_reaction(
        &mut self,
        reactor_id: i64,
        message_id: i64,
        reaction: &str,
    ) -> Result<()> {
        let tx = self.tx.as_mut().unwrap();
        let mut stmt = tx.prepare_cached(
            "INSERT INTO reaction(reactor_id, message_id, reaction)
             VALUES (?1, ?2, ?3)",
        )?;
        stmt.execute(params![reactor_id, message_id, reaction])?;
        Ok(())
    }
}

impl Drop for WriteBatch<'_> {
    fn drop(&mut self) {
        if let Some(tx) = self.tx.take() {
            let _ = tx.rollback();
        }
    }
}
