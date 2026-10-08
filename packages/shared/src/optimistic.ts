import type { Id } from "../../../convex/_generated/dataModel";
import { orderAtEnd, orderForMove, sortTodos } from "./order";
import type { Todo, TodoId } from "./types";

// Pure list updates for optimistic mutations.
// Each one returns a new list and leaves the input alone.

let tempCounter = 0;

export function tempId(): TodoId {
  tempCounter += 1;
  return `optimistic-${tempCounter}` as TodoId;
}

export function withAdded(todos: readonly Todo[], title: string, id = tempId()) {
  const temp: Todo = {
    _id: id,
    _creationTime: Date.now(),
    // The server sets the real owner. The app never reads this field.
    ownerId: "" as Id<"users">,
    title: title.trim(),
    done: false,
    order: orderAtEnd(todos),
  };
  return [...todos, temp];
}

export function withTitle(todos: readonly Todo[], id: TodoId, title: string) {
  return todos.map((t) => (t._id === id ? { ...t, title: title.trim() } : t));
}

export function withDone(todos: readonly Todo[], id: TodoId, done: boolean) {
  return todos.map((t) => (t._id === id ? { ...t, done } : t));
}

export function withMoved(
  todos: readonly Todo[],
  id: TodoId,
  afterId: TodoId | null,
) {
  if (!todos.some((t) => t._id === id)) return [...todos];
  const order = orderForMove(todos, id, afterId);
  return sortTodos(todos.map((t) => (t._id === id ? { ...t, order } : t)));
}

export function withRemoved(todos: readonly Todo[], id: TodoId) {
  return todos.filter((t) => t._id !== id);
}
