import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { generateKeyBetween } from "fractional-indexing";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const MAX_TITLE_LENGTH = 500;

async function requireUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Not signed in.");
  }
  return userId;
}

// Loads a todo and checks that the signed-in person owns it.
// A missing todo and someone else's todo give the same error.
async function requireOwnedTodo(
  ctx: MutationCtx,
  id: Id<"todos">,
): Promise<Doc<"todos">> {
  const userId = await requireUserId(ctx);
  const todo = await ctx.db.get(id);
  if (todo === null || todo.ownerId !== userId) {
    throw new ConvexError("Todo not found.");
  }
  return todo;
}

function cleanTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new ConvexError("Title is empty.");
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    throw new ConvexError("Title is too long.");
  }
  return trimmed;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("todos")
      .withIndex("by_owner_order", (q) => q.eq("ownerId", userId))
      .collect();
  },
});

// Adds a todo at the end of the list.
export const add = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const title = cleanTitle(args.title);
    const last = await ctx.db
      .query("todos")
      .withIndex("by_owner_order", (q) => q.eq("ownerId", userId))
      .order("desc")
      .first();
    return await ctx.db.insert("todos", {
      ownerId: userId,
      title,
      done: false,
      order: generateKeyBetween(last?.order ?? null, null),
    });
  },
});

export const rename = mutation({
  args: { id: v.id("todos"), title: v.string() },
  handler: async (ctx, args) => {
    await requireOwnedTodo(ctx, args.id);
    await ctx.db.patch(args.id, { title: cleanTitle(args.title) });
  },
});

// Sets the value. It never toggles, so a retry cannot flip it back.
export const setDone = mutation({
  args: { id: v.id("todos"), done: v.boolean() },
  handler: async (ctx, args) => {
    await requireOwnedTodo(ctx, args.id);
    await ctx.db.patch(args.id, { done: args.done });
  },
});

// Moves a todo to sit right after `afterId`. Null means the top of the list.
// The server reads the neighbours itself, so the order key is never
// taken from the app.
export const move = mutation({
  args: { id: v.id("todos"), afterId: v.union(v.id("todos"), v.null()) },
  handler: async (ctx, args) => {
    const todo = await requireOwnedTodo(ctx, args.id);
    if (args.afterId === args.id) {
      throw new ConvexError("A todo cannot follow itself.");
    }
    const after =
      args.afterId === null ? null : await requireOwnedTodo(ctx, args.afterId);

    const prevOrder = after?.order ?? null;
    // Two rows are enough to find the next one if the first is the moved todo.
    const following = await ctx.db
      .query("todos")
      .withIndex("by_owner_order", (q) =>
        prevOrder === null
          ? q.eq("ownerId", todo.ownerId)
          : q.eq("ownerId", todo.ownerId).gt("order", prevOrder),
      )
      .take(2);
    const next = following.find((t) => t._id !== todo._id)?.order ?? null;

    // Equal or crossed keys should not happen. Fall back to the end of the gap.
    const order =
      prevOrder !== null && next !== null && prevOrder >= next
        ? generateKeyBetween(prevOrder, null)
        : generateKeyBetween(prevOrder, next);
    await ctx.db.patch(todo._id, { order });
  },
});

export const remove = mutation({
  args: { id: v.id("todos") },
  handler: async (ctx, args) => {
    await requireOwnedTodo(ctx, args.id);
    await ctx.db.delete(args.id);
  },
});
