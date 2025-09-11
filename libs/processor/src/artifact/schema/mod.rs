use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rusqlite::{params, Connection, Transaction};
use rusqlite_migration::{Migrations, M};

/// Thin wrapper around a `rusqlite` connection that ensures schema is ready.
pub struct MessageDb {
    path: PathBuf,
    conn: Connection,
}

/// Transactional writer (RAII). Commit via `commit(self)`; rolls back on drop if not committed.
pub struct WriteBatch<'c> {
    tx: Option<Transaction<'c>>,
}

#[derive(Clone, Copy, Debug)]
pub enum ConversationType {
    Dm,
    Group,
}
impl ConversationType {
    fn as_str(self) -> &'static str {
        match self {
            ConversationType::Dm => "dm",
            ConversationType::Group => "group",
        }
    }
}

// Messages are now untyped; content lives in message_* tables referencing message(id).

impl MessageDb {
    /// Open (or create) a SQLite database at `db_path`, configure pragmas, and apply migrations.
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self> {
        let path = db_path.as_ref().to_path_buf();

        if let Some(dir) = path.parent() {
            if !dir.exists() {
                fs::create_dir_all(dir)
                    .with_context(|| format!("creating parent directory: {}", dir.display()))?;
            }
        }

        let mut conn = Connection::open(&path)
            .with_context(|| format!("opening sqlite db at {}", path.display()))?;

        // Pragmas tuned for on-device analytics: many reads, occasional writes.
        conn.pragma_update(None, "journal_mode", &"WAL")
            .context("setting PRAGMA journal_mode=WAL")?;
        conn.pragma_update(None, "synchronous", &"NORMAL")
            .context("setting PRAGMA synchronous=NORMAL")?;
        conn.pragma_update(None, "foreign_keys", &"ON")
            .context("enabling foreign_keys")?;
        conn.pragma_update(None, "busy_timeout", &5000_i64)
            .context("setting PRAGMA busy_timeout=5000")?;

        Self::apply_migrations(&mut conn).context("applying migrations")?;

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

    fn apply_migrations(conn: &mut Connection) -> Result<()> {
        // Tracked via SQLite PRAGMA user_version.
        let migrations = Migrations::new(vec![M::up(
            r#"
                PRAGMA foreign_keys=ON;

                CREATE TABLE IF NOT EXISTS user(
                  id INTEGER PRIMARY KEY,
                  name TEXT,
                  avatar_uri TEXT
                );

                CREATE TABLE IF NOT EXISTS conversation(
                  id INTEGER PRIMARY KEY,
                  type TEXT CHECK(type IN ('dm','group')) NOT NULL,
                  image_uri TEXT,
                  name TEXT
                );

                CREATE TABLE IF NOT EXISTS message(
                  id INTEGER PRIMARY KEY,
                  sender INTEGER NOT NULL REFERENCES user(id),
                  conversation INTEGER NOT NULL REFERENCES conversation(id),
                  sent_at INTEGER NOT NULL  -- epoch seconds
                );

                CREATE TABLE IF NOT EXISTS message_text(
                  id INTEGER PRIMARY KEY,
                  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
                  text TEXT
                );

                CREATE TABLE IF NOT EXISTS message_image(
                  id INTEGER PRIMARY KEY,
                  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
                  image_uri TEXT
                );

                CREATE TABLE IF NOT EXISTS message_video(
                  id INTEGER PRIMARY KEY,
                  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
                  video_uri TEXT
                );

                CREATE TABLE IF NOT EXISTS message_gif(
                  id INTEGER PRIMARY KEY,
                  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
                  gif_uri TEXT
                );

                CREATE TABLE IF NOT EXISTS message_audio(
                  id INTEGER PRIMARY KEY,
                  message_id INTEGER NOT NULL REFERENCES message(id) ON DELETE CASCADE,
                  audio_uri TEXT,
                  length_seconds INTEGER
                );

                CREATE TABLE IF NOT EXISTS reaction(
                  id INTEGER PRIMARY KEY,
                  reactor_id INTEGER NOT NULL REFERENCES user(id),
                  message_id INTEGER NOT NULL REFERENCES message(id),
                  reaction TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_message_conversation_time
                  ON message(conversation, sent_at);

                CREATE INDEX IF NOT EXISTS idx_reaction_message
                  ON reaction(message_id);
            "#,
        )]);
        migrations.to_latest(conn)?;
        Ok(())
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

    /// Insert a user. If you need a specific id, pass it and SQLite will honor it.
    pub fn insert_user(
        &mut self,
        id: Option<i64>,
        name: Option<&str>,
        avatar_uri: Option<&str>,
    ) -> Result<()> {
        match id {
            Some(id) => self.tx.as_ref().unwrap().execute(
                "INSERT INTO user(id, name, avatar_uri) VALUES (?1, ?2, ?3)",
                params![id, name, avatar_uri],
            )?,
            None => self.tx.as_ref().unwrap().execute(
                "INSERT INTO user(name, avatar_uri) VALUES (?1, ?2)",
                params![name, avatar_uri],
            )?,
        };
        Ok(())
    }

    /// Insert a conversation.
    pub fn insert_conversation(
        &mut self,
        id: i64,
        ctype: ConversationType,
        image_uri: Option<&str>,
        name: Option<&str>,
    ) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO conversation(id, type, image_uri, name) VALUES (?1, ?2, ?3, ?4)",
            params![id, ctype.as_str(), image_uri, name],
        )?;
        Ok(())
    }

    /// Insert base message row (no content-type).
    pub fn insert_message(&mut self, id: i64, sender_id: i64, conversation_id: i64, sent_at_epoch: i64) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message(id, sender, conversation, sent_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, sender_id, conversation_id, sent_at_epoch],
        )?;
        Ok(())
    }

    /// Add text content to an existing message.
    pub fn add_message_text(&mut self, message_id: i64, text: &str) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message_text(message_id, text) VALUES (?1, ?2)",
            params![message_id, text],
        )?;
        Ok(())
    }

    /// Add an image attachment to an existing message.
    pub fn add_message_image(&mut self, message_id: i64, image_uri: &str) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message_image(message_id, image_uri) VALUES (?1, ?2)",
            params![message_id, image_uri],
        )?;
        Ok(())
    }

    /// Add a video attachment to an existing message.
    pub fn add_message_video(&mut self, message_id: i64, video_uri: &str) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message_video(message_id, video_uri) VALUES (?1, ?2)",
            params![message_id, video_uri],
        )?;
        Ok(())
    }

    /// Add a GIF attachment to an existing message.
    pub fn add_message_gif(&mut self, message_id: i64, gif_uri: &str) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message_gif(message_id, gif_uri) VALUES (?1, ?2)",
            params![message_id, gif_uri],
        )?;
        Ok(())
    }

    /// Add an audio attachment to an existing message.
    pub fn add_message_audio(&mut self, message_id: i64, audio_uri: &str, length_seconds: Option<i64>) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message_audio(message_id, audio_uri, length_seconds)
             VALUES (?1, ?2, ?3)",
            params![message_id, audio_uri, length_seconds],
        )?;
        Ok(())
    }

    /// Insert a reaction.
    pub fn insert_reaction(
        &mut self,
        reactor_id: i64,
        message_id: i64,
        reaction: &str,
    ) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO reaction(reactor_id, message_id, reaction)
             VALUES (?1, ?2, ?3)",
            params![reactor_id, message_id, reaction],
        )?;
        Ok(())
    }

    // Optional: "now" (SQLite clock) helpers
    pub fn insert_message_now(&mut self, id: i64, sender_id: i64, conversation_id: i64) -> Result<()> {
        self.tx.as_ref().unwrap().execute(
            "INSERT INTO message(id, sender, conversation, sent_at)
             VALUES (?1, ?2, ?3, unixepoch('now'))",
            params![id, sender_id, conversation_id],
        )?;
        Ok(())
    }
}

impl Drop for WriteBatch<'_> {
    fn drop(&mut self) {
        if let Some(tx) = self.tx.take() {
            let _ = tx.rollback();
            eprintln!("Rolled back transaction");
        }
    }
}
