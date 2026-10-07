import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  todos: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    done: v.boolean(),
    // Sort key from fractional indexing.
    order: v.string(),
  }).index("by_owner_order", ["ownerId", "order"]),
});
