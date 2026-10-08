import { describe, expect, it } from "vitest";
import {
  withAdded,
  withDone,
  withMoved,
  withRemoved,
  withTitle,
} from "./optimistic";
import {
  afterIdForIndex,
  orderAtEnd,
  orderBetween,
  orderForMove,
  sortTodos,
} from "./order";
import type { Todo, TodoId } from "./types";

function build(titles: string[]): Todo[] {
  let list: Todo[] = [];
  titles.forEach((title, i) => {
    list = withAdded(list, title, `id-${title}` as TodoId).map((t, j) =>
      j === list.length ? { ...t, _creationTime: i } : t,
    );
  });
  return list;
}
const names = (todos: readonly Todo[]) => todos.map((t) => t.title).join("");
const id = (name: string) => `id-${name}` as TodoId;

describe("orderBetween", () => {
  it("returns keys that sort between neighbours", () => {
    const a = orderBetween(null, null);
    const b = orderBetween(a, null);
    const mid = orderBetween(a, b);
    expect(a < mid && mid < b).toBe(true);
    expect(orderBetween(null, a) < a).toBe(true);
  });

  it("does not throw on equal or crossed keys", () => {
    const a = orderBetween(null, null);
    expect(orderBetween(a, a) > a).toBe(true);
    const b = orderBetween(a, null);
    expect(orderBetween(b, a) > b).toBe(true);
  });
});

describe("sortTodos", () => {
  it("breaks equal keys by creation time", () => {
    const base = build(["a", "b"]);
    const tied = [
      { ...base[1], order: "a0", _creationTime: 2 },
      { ...base[0], order: "a0", _creationTime: 1 },
    ];
    expect(names(sortTodos(tied))).toBe("ab");
  });
});

describe("move helpers", () => {
  it("keeps appended todos in order", () => {
    expect(names(build(["a", "b", "c"]))).toBe("abc");
    const list = build(["a", "b"]);
    expect(orderAtEnd(list) > list[1].order).toBe(true);
  });

  it("moves to the top, middle and end", () => {
    const list = build(["a", "b", "c", "d"]);
    expect(names(withMoved(list, id("d"), null))).toBe("dabc");
    expect(names(withMoved(list, id("a"), id("c")))).toBe("bcad");
    expect(names(withMoved(list, id("a"), id("d")))).toBe("bcda");
    expect(names(withMoved(list, id("b"), id("a")))).toBe("abcd");
  });

  it("changes one row only", () => {
    const list = build(["a", "b", "c"]);
    const moved = withMoved(list, id("a"), id("b"));
    const changed = moved.filter(
      (t) => t.order !== list.find((o) => o._id === t._id)!.order,
    );
    expect(changed.map((t) => t.title)).toEqual(["a"]);
  });

  it("does not change the input", () => {
    const list = build(["a", "b"]);
    const copy = JSON.stringify(list);
    withMoved(list, id("a"), id("b"));
    withDone(list, id("a"), true);
    withTitle(list, id("a"), "z");
    withRemoved(list, id("a"));
    expect(JSON.stringify(list)).toBe(copy);
  });

  it("ignores a move of an unknown todo and rejects an unknown anchor", () => {
    const list = build(["a", "b"]);
    expect(names(withMoved(list, id("zz"), null))).toBe("ab");
    expect(() => orderForMove(list, id("a"), id("zz"))).toThrow();
  });

  it("maps a drop index to afterId", () => {
    const list = build(["a", "b", "c", "d"]);
    // Move a to index 2: final order b c a d.
    expect(afterIdForIndex(list, id("a"), 2)).toBe(id("c"));
    expect(afterIdForIndex(list, id("d"), 0)).toBeNull();
    expect(afterIdForIndex(list, id("a"), 99)).toBe(id("d"));
    expect(afterIdForIndex(list, id("a"), -3)).toBeNull();
    const after = afterIdForIndex(list, id("a"), 2);
    expect(names(withMoved(list, id("a"), after))).toBe("bcad");
  });
});

describe("simple updates", () => {
  it("set values rather than toggle", () => {
    const list = build(["a"]);
    const once = withDone(list, id("a"), true);
    expect(withDone(once, id("a"), true)[0].done).toBe(true);
    expect(withDone(once, id("a"), false)[0].done).toBe(false);
  });

  it("renames, trims and removes", () => {
    const list = build(["a", "b"]);
    expect(withTitle(list, id("a"), "  x ")[0].title).toBe("x");
    expect(names(withRemoved(list, id("a")))).toBe("b");
  });
});
