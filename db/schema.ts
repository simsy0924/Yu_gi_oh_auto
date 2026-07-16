import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userStores = sqliteTable("user_stores", {
  userEmail: text("user_email").primaryKey(),
  storeJson: text("store_json").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  previousStoreJson: text("previous_store_json"),
  previousUpdatedAt: text("previous_updated_at"),
});
