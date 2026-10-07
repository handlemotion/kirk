import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import {
  withAdded,
  withDone,
  withMoved,
  withRemoved,
  withTitle,
} from "./optimistic";
import { afterIdForIndex } from "./order";
import type { Todo, TodoId } from "./types";

// The signed-in person's todos, in order. Undefined while loading.
// Render this only after sign-in. The server rejects the query otherwise.
export function useTodos(): Todo[] | undefined {
  return useQuery(api.todos.list);
}

export type TodoActions = {
  add(title: string): Promise<unknown>;
  rename(id: TodoId, title: string): Promise<unknown>;
  setDone(id: TodoId, done: boolean): Promise<unknown>;
  // `toIndex` is where the todo should sit in the list after the move.
  move(id: TodoId, toIndex: number): Promise<unknown>;
  remove(id: TodoId): Promise<unknown>;
};

// Mutations with optimistic updates. The list redraws at once.
// Convex swaps in the server result when the mutation lands.
// `getTodos` reads the list the move was planned against.
export function useTodoActions(getTodos: () => readonly Todo[]): TodoActions {
  const add = useMutation(api.todos.add).withOptimisticUpdate((store, args) => {
    const list = store.getQuery(api.todos.list, {});
    if (list === undefined) return;
    store.setQuery(api.todos.list, {}, withAdded(list, args.title));
  });
  const rename = useMutation(api.todos.rename).withOptimisticUpdate(
    (store, args) => {
      const list = store.getQuery(api.todos.list, {});
      if (list === undefined) return;
      store.setQuery(api.todos.list, {}, withTitle(list, args.id, args.title));
    },
  );
  const setDone = useMutation(api.todos.setDone).withOptimisticUpdate(
    (store, args) => {
      const list = store.getQuery(api.todos.list, {});
      if (list === undefined) return;
      store.setQuery(api.todos.list, {}, withDone(list, args.id, args.done));
    },
  );
  const move = useMutation(api.todos.move).withOptimisticUpdate(
    (store, args) => {
      const list = store.getQuery(api.todos.list, {});
      if (list === undefined) return;
      store.setQuery(
        api.todos.list,
        {},
        withMoved(list, args.id, args.afterId),
      );
    },
  );
  const remove = useMutation(api.todos.remove).withOptimisticUpdate(
    (store, args) => {
      const list = store.getQuery(api.todos.list, {});
      if (list === undefined) return;
      store.setQuery(api.todos.list, {}, withRemoved(list, args.id));
    },
  );

  return useMemo(
    () => ({
      add: (title) => add({ title }),
      rename: (id, title) => rename({ id, title }),
      setDone: (id, done) => setDone({ id, done }),
      move: (id, toIndex) =>
        move({ id, afterId: afterIdForIndex(getTodos(), id, toIndex) }),
      remove: (id) => remove({ id }),
    }),
    [add, rename, setDone, move, remove, getTodos],
  );
}
