import { generateKeyBetween } from "fractional-indexing";
import type { Todo, TodoId } from "./types";

// Key between two neighbours. Mirrors the server in convex/todos.ts.
// Equal or crossed keys should not happen. Fall back to the end of the gap.
export function orderBetween(prev: string | null, next: string | null): string {
  if (prev !== null && next !== null && prev >= next) {
    return generateKeyBetween(prev, null);
  }
  return generateKeyBetween(prev, next);
}

// Same order as the server index: key first, creation time on a tie.
export function sortTodos<T extends Pick<Todo, "order" | "_creationTime">>(
  todos: readonly T[],
): T[] {
  return [...todos].sort((a, b) =>
    a.order < b.order
      ? -1
      : a.order > b.order
        ? 1
        : a._creationTime - b._creationTime,
  );
}

export function orderAtEnd(todos: readonly Todo[]): string {
  return generateKeyBetween(todos.at(-1)?.order ?? null, null);
}

// The key the server will pick when `id` moves to sit after `afterId`.
export function orderForMove(
  todos: readonly Todo[],
  id: TodoId,
  afterId: TodoId | null,
): string {
  const rest = todos.filter((t) => t._id !== id);
  const afterIndex =
    afterId === null ? -1 : rest.findIndex((t) => t._id === afterId);
  if (afterId !== null && afterIndex === -1) {
    throw new Error("Unknown todo to move after.");
  }
  const prev = afterIndex === -1 ? null : rest[afterIndex].order;
  const next = rest[afterIndex + 1]?.order ?? null;
  return orderBetween(prev, next);
}

// Turns a drop position into the `afterId` that todos.move expects.
// `toIndex` is where the todo should sit in the list after the move.
export function afterIdForIndex(
  todos: readonly Todo[],
  id: TodoId,
  toIndex: number,
): TodoId | null {
  const rest = todos.filter((t) => t._id !== id);
  const clamped = Math.max(0, Math.min(toIndex, rest.length));
  return clamped === 0 ? null : rest[clamped - 1]._id;
}
