use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct E2eExportRoot {
    pub participants: Vec<String>,
    #[serde(rename = "threadName")]
    pub thread_name: String,
    pub messages: Vec<Message>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    #[serde(rename = "isUnsent")]
    pub is_unsent: bool,
    pub media: Vec<Media>,
    pub reactions: Vec<Reaction>,
    #[serde(rename = "senderName")]
    pub sender_name: String,
    pub text: String,
    pub timestamp: i64,
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Media {
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub actor: String,
    pub reaction: String,
}
