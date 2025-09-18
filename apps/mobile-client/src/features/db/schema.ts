import { getValues } from "@/common/helpers/object";
import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export enum EConversationType {
  DM = "dm",
  GROUP = "group",
}

const tsEnumToDrizzleEnum = <T extends Record<string, unknown>>(
  myEnum: T,
): [T[keyof T], ...T[keyof T][]] => {
  return getValues(myEnum).map((value: unknown) => `${value}`) as [T[keyof T], ...T[keyof T][]]
}

export const exportsTable = sqliteTable(
  "export",
  {
    id: integer("id").primaryKey(),
    source: text("source").notNull(),
    checksum: text("checksum"),
    importedAt: integer("imported_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch('now'))`),
    metaJson: text("meta_json"),
  }
);

export const canonicalPeople = sqliteTable(
  "canonical_person",
  {
    id: integer("id").primaryKey(),
    displayName: text("display_name"),
    avatarUri: text("avatar_uri"),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch('now'))`),
  }
);

export const canonicalConversations = sqliteTable(
  "canonical_conversation",
  {
    id: integer("id").primaryKey(),
    type: text("type", { enum: tsEnumToDrizzleEnum(EConversationType) }).notNull(),
    name: text("name"),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch('now'))`),
  },
  (t) => [
    check("ck_canonical_conversation_type", sql`${t.type} in ('dm','group')`),
  ]
);

export const conversations = sqliteTable(
  "conversation",
  {
    id: integer("id").primaryKey(),
    type: text("type", { enum: tsEnumToDrizzleEnum(EConversationType) }).notNull(),
    imageUri: text("image_uri"),
    name: text("name"),
    exportId: integer("export_id")
      .notNull()
      .references(() => exportsTable.id, { onDelete: "cascade" }),
    canonicalConversationId: integer("canonical_conversation_id")
      .notNull()
      .references(() => canonicalConversations.id),
  },
  (t) => [
    check("ck_conversation_type", sql`${t.type} in ('dm','group')`),
    index("idx_conversation_export").on(t.exportId),
    index("idx_conversation_canonical").on(t.canonicalConversationId),
  ]
);

export const people = sqliteTable(
  "person",
  {
    id: integer("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    name: text("name"),
    avatarUri: text("avatar_uri"),
    canonicalPersonId: integer("canonical_person_id")
      .notNull()
      .references(() => canonicalPeople.id),
  },
  (t) => [
    index("idx_person_conversation").on(t.conversationId, t.id),
    index("idx_person_canonical").on(t.canonicalPersonId),
  ]
);

export const messages = sqliteTable(
  "message",
  {
    id: integer("id").primaryKey(),
    senderId: integer("sender")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    sentAt: integer("sent_at", { mode: "number" }).notNull(), // epoch seconds
    unsent: integer("unsent", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("idx_message_sender_time").on(t.senderId, t.sentAt)]
);

export const messageTexts = sqliteTable("message_text", {
  id: integer("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  text: text("text"),
});

export const messageImages = sqliteTable("message_image", {
  id: integer("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  imageUri: text("image_uri"),
});

export const messageVideos = sqliteTable("message_video", {
  id: integer("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  videoUri: text("video_uri"),
});

export const messageGifs = sqliteTable("message_gif", {
  id: integer("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  gifUri: text("gif_uri"),
});

export const messageAudios = sqliteTable("message_audio", {
  id: integer("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  audioUri: text("audio_uri"),
  lengthSeconds: integer("length_seconds", { mode: "number" }),
});

export const reactions = sqliteTable(
  "reaction",
  {
    id: integer("id").primaryKey(),
    reactorId: integer("reactor_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    reaction: text("reaction"),
  },
  (t) => [index("idx_reaction_message").on(t.messageId)]
);


export const exportsRelations = relations(exportsTable, ({ many }) => ({
  conversations: many(conversations),
}));

export const canonicalPeopleRelations = relations(canonicalPeople, ({ many }) => ({
  people: many(people),
}));

export const canonicalConversationsRelations = relations(
  canonicalConversations,
  ({ many }) => ({
    conversations: many(conversations),
  })
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  export: one(exportsTable, {
    fields: [conversations.exportId],
    references: [exportsTable.id],
  }),
  canonical: one(canonicalConversations, {
    fields: [conversations.canonicalConversationId],
    references: [canonicalConversations.id],
  }),
  people: many(people),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [people.conversationId],
    references: [conversations.id],
  }),
  canonical: one(canonicalPeople, {
    fields: [people.canonicalPersonId],
    references: [canonicalPeople.id],
  }),
  messages: many(messages),
  reactions: many(reactions, { relationName: "personReactions" }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(people, {
    fields: [messages.senderId],
    references: [people.id],
  }),
  texts: many(messageTexts),
  images: many(messageImages),
  videos: many(messageVideos),
  gifs: many(messageGifs),
  audios: many(messageAudios),
  reactions: many(reactions),
}));

export const messageTextsRelations = relations(messageTexts, ({ one }) => ({
  message: one(messages, {
    fields: [messageTexts.messageId],
    references: [messages.id],
  }),
}));

export const messageImagesRelations = relations(messageImages, ({ one }) => ({
  message: one(messages, {
    fields: [messageImages.messageId],
    references: [messages.id],
  }),
}));

export const messageVideosRelations = relations(messageVideos, ({ one }) => ({
  message: one(messages, {
    fields: [messageVideos.messageId],
    references: [messages.id],
  }),
}));

export const messageGifsRelations = relations(messageGifs, ({ one }) => ({
  message: one(messages, {
    fields: [messageGifs.messageId],
    references: [messages.id],
  }),
}));

export const messageAudiosRelations = relations(messageAudios, ({ one }) => ({
  message: one(messages, {
    fields: [messageAudios.messageId],
    references: [messages.id],
  }),
}));

export const reactionsRelations = relations(
  reactions,
  ({ one }) => ({
    message: one(messages, {
      fields: [reactions.messageId],
      references: [messages.id],
    }),
    reactor: one(people, {
      fields: [reactions.reactorId],
      references: [people.id],
    }),
  })
);

export const schema = {
  exportsTable,
  canonicalPeople,
  canonicalConversations,
  conversations,
  people,
  messages,
  messageTexts,
  messageImages,
  messageVideos,
  messageGifs,
  messageAudios,
  reactions,
  exportsRelations,
  canonicalPeopleRelations,
  canonicalConversationsRelations,
  conversationsRelations,
  peopleRelations,
  messagesRelations,
  messageTextsRelations,
  messageImagesRelations,
  messageVideosRelations,
  messageGifsRelations,
  messageAudiosRelations,
  reactionsRelations,
}