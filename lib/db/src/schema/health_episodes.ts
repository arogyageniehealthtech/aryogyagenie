import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const healthEpisodesTable = pgTable("health_episodes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status", { enum: ["suggested", "confirmed", "resolved", "archived"] })
    .notNull()
    .default("suggested"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  summary: text("summary"),
  eventIds: jsonb("event_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type HealthEpisode = typeof healthEpisodesTable.$inferSelect;
export type NewHealthEpisode = typeof healthEpisodesTable.$inferInsert;
