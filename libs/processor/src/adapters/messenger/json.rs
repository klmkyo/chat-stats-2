use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Root {
    pub participants: Vec<Participant>,
    pub messages: Vec<Message>,
    pub title: String,
    pub is_still_participant: bool,
    pub thread_path: String,
    // pub magic_words: Vec<serde_json::Value>, // won't be used
    pub image: Option<Image>,
    pub joinable_mode: Option<JoinableMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub sender_name: String,
    pub timestamp_ms: i64,
    pub content: Option<String>,
    pub is_geoblocked_for_viewer: bool,
    pub is_unsent_image_by_messenger_kid_parent: Option<bool>,
    pub audio_files: Option<Vec<AudioFile>>,
    pub reactions: Option<Vec<Reaction>>,
    pub is_unsent: Option<bool>,
    pub videos: Option<Vec<Video>>,
    pub photos: Option<Vec<Photo>>,
    pub share: Option<Share>,
    pub gifs: Option<Vec<Gif>>,
    pub sticker: Option<Sticker>,
    pub call_duration: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioFile {
    pub uri: String,
    pub creation_timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub reaction: String,
    pub actor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    pub uri: String,
    pub creation_timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Photo {
    pub uri: String,
    pub creation_timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Share {
    pub link: Option<String>,
    pub share_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gif {
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sticker {
    pub uri: String,
    // pub ai_stickers: Vec<serde_json::Value>, // won't be used
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Image {
    pub uri: String,
    pub creation_timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinableMode {
    pub mode: i64,
    pub link: String,
}
