//! Database layer for chat message storage and retrieval.
//!
//! This module handles SQLite database operations, schema management,
//! and provides a transactional API for importing chat data.

pub mod schema;

pub use schema::{ConversationType, MessageDb, WriteBatch};
