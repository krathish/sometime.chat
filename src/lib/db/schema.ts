import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  code: text("code").unique(),
  name: text("name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const links = sqliteTable("links", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  personName: text("person_name").notNull(),
  platform: text("platform").notNull().default("unknown"),
  timezone: text("timezone"),
  availabilityJson: text("availability_json"),
  busyJson: text("busy_json"),
  parseError: text("parse_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  status: text("status").notNull().default("sent"),
  sentAt: integer("sent_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  openedAt: integer("opened_at", { mode: "timestamp" }),
  joinedAt: integer("joined_at", { mode: "timestamp" }),
});

export const calendarAccounts = sqliteTable("calendar_accounts", {
  id: text("id").primaryKey(),
  linkId: text("link_id")
    .notNull()
    .references(() => links.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("google"),
  email: text("email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
