import { act, cleanup, renderHook } from "@testing-library/react";
import { ConvexProvider } from "convex/react";
import { useCallback, useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { FakeSocket, newFakeClient } from "./fake-server";
import { useTodoActions, useTodos } from "./todos";
import type { Todo, TodoId } from "./types";

afterEach(cleanup);

function todo(n: number, extra: Partial<Todo> = {}): Todo {
  return {
    _id: `t${n}` as TodoId,
    _creationTime: n,
    ownerId: "u1" as Todo["ownerId"],
    title: `todo ${n}`,
    done: false,
    // Sorted keys: a0, a1, a2, a3.
    order: `a${n - 1}`,
    ...extra,
  };
}

const ids = (todos: readonly Todo[] | undefined) => todos?.map((t) => t._id);
const titles = (todos: readonly Todo[] | undefined) =>
  todos?.map((t) => t.title);

// Mounts the same wiring the screens use: the list, plus the actions
// with a getter for the latest list.
async function setup(
  initial: Todo[] | null = [todo(1), todo(2), todo(3), todo(4)],
) {
  const client = newFakeClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>{children}</ConvexProvider>
  );
  const view = renderHook(
    () => {
      const todos = useTodos();
      const latest = useRef<readonly Todo[]>([]);
      latest.current = todos ?? [];
      const getTodos = useCallback(() => latest.current, []);
      return { todos, actions: useTodoActions(getTodos) };
    },
    { wrapper },
  );
  const socket = FakeSocket.current;
  await act(async () => socket.open());
  if (initial !== null) {
    await act(async () => socket.setQuery("todos:list", initial));
  }
  return { client, view, socket };
}

describe("useTodoActions", () => {
  it("add shows a trimmed todo at the end and sends the title", async () => {
    const { view, socket } = await setup();
    await act(async () => {
      void view.result.current.actions.add("  buy milk ");
    });
    const todos = view.result.current.todos!;
    expect(titles(todos)).toEqual([
      "todo 1",
      "todo 2",
      "todo 3",
      "todo 4",
      "buy milk",
    ]);
    expect(todos.at(-1)).toMatchObject({ done: false });
    expect(todos.at(-1)!.order > todos.at(-2)!.order).toBe(true);
    const [sent] = socket.mutations("todos:add");
    expect(sent.args).toEqual([{ title: "  buy milk " }]);
  });

  it("rename changes only that title", async () => {
    const { view, socket } = await setup();
    await act(async () => {
      void view.result.current.actions.rename("t2" as TodoId, " renamed ");
    });
    expect(titles(view.result.current.todos)).toEqual([
      "todo 1",
      "renamed",
      "todo 3",
      "todo 4",
    ]);
    expect(socket.mutations("todos:rename")[0].args).toEqual([
      { id: "t2", title: " renamed " },
    ]);
  });

  it("setDone sets the value it is given and never toggles", async () => {
    const { view, socket } = await setup([todo(1), todo(2, { done: true })]);
    const { actions } = view.result.current;
    await act(async () => {
      void actions.setDone("t1" as TodoId, true);
      void actions.setDone("t2" as TodoId, false);
    });
    expect(view.result.current.todos!.map((t) => t.done)).toEqual([
      true,
      false,
    ]);
    // The same value again changes nothing.
    await act(async () => {
      void actions.setDone("t1" as TodoId, true);
    });
    expect(view.result.current.todos!.map((t) => t.done)).toEqual([
      true,
      false,
    ]);
    expect(socket.mutations("todos:setDone").map((m) => m.args)).toEqual([
      [{ id: "t1", done: true }],
      [{ id: "t2", done: false }],
      [{ id: "t1", done: true }],
    ]);
  });

  it("remove drops that todo", async () => {
    const { view, socket } = await setup();
    await act(async () => {
      void view.result.current.actions.remove("t2" as TodoId);
    });
    expect(ids(view.result.current.todos)).toEqual(["t1", "t3", "t4"]);
    expect(socket.mutations("todos:remove")[0].args).toEqual([{ id: "t2" }]);
  });

  describe("move", () => {
    // [from id, toIndex, afterId on the wire, list after the move]
    const cases: [string, number, string | null, string[]][] = [
      ["t1", 2, "t3", ["t2", "t3", "t1", "t4"]],
      ["t1", 3, "t4", ["t2", "t3", "t4", "t1"]],
      ["t1", 1, "t2", ["t2", "t1", "t3", "t4"]],
      ["t1", 0, null, ["t1", "t2", "t3", "t4"]],
      ["t4", 0, null, ["t4", "t1", "t2", "t3"]],
      ["t4", 1, "t1", ["t1", "t4", "t2", "t3"]],
      ["t3", 1, "t1", ["t1", "t3", "t2", "t4"]],
      ["t3", 3, "t4", ["t1", "t2", "t4", "t3"]],
    ];

    it.each(cases)(
      "moves %s to index %i, after %s",
      async (id, toIndex, afterId, expected) => {
        const { view, socket } = await setup();
        await act(async () => {
          void view.result.current.actions.move(id as TodoId, toIndex);
        });
        expect(socket.mutations("todos:move")[0].args).toEqual([
          { id, afterId },
        ]);
        expect(ids(view.result.current.todos)).toEqual(expected);
      },
    );

    it("clamps an index past the end to the end", async () => {
      const { view, socket } = await setup();
      await act(async () => {
        void view.result.current.actions.move("t1" as TodoId, 99);
      });
      expect(socket.mutations("todos:move")[0].args).toEqual([
        { id: "t1", afterId: "t4" },
      ]);
      expect(ids(view.result.current.todos)).toEqual(["t2", "t3", "t4", "t1"]);
    });

    it("clamps a negative index to the top", async () => {
      const { view, socket } = await setup();
      await act(async () => {
        void view.result.current.actions.move("t3" as TodoId, -5);
      });
      expect(socket.mutations("todos:move")[0].args).toEqual([
        { id: "t3", afterId: null },
      ]);
      expect(ids(view.result.current.todos)).toEqual(["t3", "t1", "t2", "t4"]);
    });

    it("writes one new key, between the neighbours", async () => {
      const { view } = await setup();
      await act(async () => {
        void view.result.current.actions.move("t1" as TodoId, 2);
      });
      const todos = view.result.current.todos!;
      const moved = todos.find((t) => t._id === "t1")!;
      expect(moved.order > "a2" && moved.order < "a3").toBe(true);
      // The other rows keep their keys.
      expect(todos.filter((t) => t._id !== "t1").map((t) => t.order)).toEqual([
        "a1",
        "a2",
        "a3",
      ]);
    });

    it("plans against the latest list, not the first render", async () => {
      const { view, socket } = await setup();
      const { actions } = view.result.current;
      // Another device removes t2. The list on screen changes.
      await act(async () =>
        socket.setQuery("todos:list", [todo(1), todo(3), todo(4)]),
      );
      await act(async () => {
        void actions.move("t4" as TodoId, 1);
      });
      expect(socket.mutations("todos:move")[0].args).toEqual([
        { id: "t4", afterId: "t1" },
      ]);
      expect(ids(view.result.current.todos)).toEqual(["t1", "t4", "t3"]);
    });
  });

  it("drops the optimistic change when the server rejects it", async () => {
    const { view, socket } = await setup();
    let result: Promise<unknown>;
    await act(async () => {
      result = view.result.current.actions.remove("t2" as TodoId);
      result.catch(() => {});
    });
    expect(ids(view.result.current.todos)).toEqual(["t1", "t3", "t4"]);
    await act(async () => {
      socket.failMutation(socket.mutations("todos:remove")[0].requestId, "no");
      await result.catch(() => {});
    });
    expect(ids(view.result.current.todos)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("does nothing to the list before it loads", async () => {
    const { view, socket } = await setup(null);
    expect(view.result.current.todos).toBeUndefined();
    await act(async () => {
      void view.result.current.actions.add("x");
      void view.result.current.actions.rename("t1" as TodoId, "x");
      void view.result.current.actions.setDone("t1" as TodoId, true);
      void view.result.current.actions.move("t1" as TodoId, 1);
      void view.result.current.actions.remove("t1" as TodoId);
    });
    expect(view.result.current.todos).toBeUndefined();
    // The calls still go to the server.
    expect(socket.sent.filter((m) => m.type === "Mutation")).toHaveLength(5);
  });
});
