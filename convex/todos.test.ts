import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.*s", "!./**/*.test.ts"]);

async function setup() {
  const t = convexTest(schema, modules);
  const aliceId = await t.run((ctx) => ctx.db.insert("users", {}));
  const bobId = await t.run((ctx) => ctx.db.insert("users", {}));
  return {
    t,
    alice: t.withIdentity({ subject: `${aliceId}|session1` }),
    bob: t.withIdentity({ subject: `${bobId}|session2` }),
    aliceId,
    bobId,
  };
}


describe("todos auth", () => {
  it("rejects every function when nobody is signed in", async () => {
    const { t, alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "x" });
    await expect(t.query(api.todos.list, {})).rejects.toThrow();
    await expect(t.mutation(api.todos.add, { title: "y" })).rejects.toThrow();
    await expect(
      t.mutation(api.todos.rename, { id, title: "y" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.todos.setDone, { id, done: true }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.todos.move, { id, afterId: null }),
    ).rejects.toThrow();
    await expect(t.mutation(api.todos.remove, { id })).rejects.toThrow();
  });

  it("hides and protects todos from other people", async () => {
    const { alice, bob } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "private" });
    const other = await bob.mutation(api.todos.add, { title: "bobs" });
    expect(await bob.query(api.todos.list, {})).toHaveLength(1);
    await expect(
      bob.mutation(api.todos.rename, { id, title: "hacked" }),
    ).rejects.toThrow();
    await expect(
      bob.mutation(api.todos.setDone, { id, done: true }),
    ).rejects.toThrow();
    await expect(bob.mutation(api.todos.remove, { id })).rejects.toThrow();
    await expect(
      bob.mutation(api.todos.move, { id, afterId: null }),
    ).rejects.toThrow();
    await expect(
      bob.mutation(api.todos.move, { id: other, afterId: id }),
    ).rejects.toThrow();
    const [todo] = await alice.query(api.todos.list, {});
    expect(todo.title).toBe("private");
    expect(todo.done).toBe(false);
  });
});

describe("todos", () => {
  it("adds todos to the end, owned by the caller", async () => {
    const { alice, aliceId } = await setup();
    await alice.mutation(api.todos.add, { title: "  one " });
    await alice.mutation(api.todos.add, { title: "two" });
    await alice.mutation(api.todos.add, { title: "three" });
    const list = await alice.query(api.todos.list, {});
    expect(list.map((t) => t.title)).toEqual(["one", "two", "three"]);
    expect(list.every((t) => t.ownerId === aliceId && !t.done)).toBe(true);
  });

  it("rejects empty and long titles", async () => {
    const { alice } = await setup();
    await expect(alice.mutation(api.todos.add, { title: "  " })).rejects.toThrow();
    await expect(
      alice.mutation(api.todos.add, { title: "x".repeat(501) }),
    ).rejects.toThrow();
    const id = await alice.mutation(api.todos.add, { title: "ok" });
    await expect(
      alice.mutation(api.todos.rename, { id, title: "" }),
    ).rejects.toThrow();
  });

  it("renames", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "old" });
    await alice.mutation(api.todos.rename, { id, title: "new" });
    expect((await alice.query(api.todos.list, {}))[0].title).toBe("new");
  });

  it("sets done and never toggles", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.setDone, { id, done: true });
    await alice.mutation(api.todos.setDone, { id, done: true });
    expect((await alice.query(api.todos.list, {}))[0].done).toBe(true);
    await alice.mutation(api.todos.setDone, { id, done: false });
    await alice.mutation(api.todos.setDone, { id, done: false });
    expect((await alice.query(api.todos.list, {}))[0].done).toBe(false);
  });

  it("removes", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.remove, { id });
    expect(await alice.query(api.todos.list, {})).toHaveLength(0);
    await expect(alice.mutation(api.todos.remove, { id })).rejects.toThrow();
  });

  it("moves with one row write", async () => {
    const { t, alice } = await setup();
    const a = await alice.mutation(api.todos.add, { title: "a" });
    const b = await alice.mutation(api.todos.add, { title: "b" });
    const c = await alice.mutation(api.todos.add, { title: "c" });
    const d = await alice.mutation(api.todos.add, { title: "d" });
    const names = async () =>
      (await alice.query(api.todos.list, {})).map((x) => x.title).join("");
    const orders = async () =>
      t.run(async (ctx) => (await ctx.db.query("todos").collect()).map((x) => x.order));

    const before = await orders();
    await alice.mutation(api.todos.move, { id: d, afterId: a });
    expect(await names()).toBe("adbc");
    const after = await orders();
    expect(after.filter((o, i) => o !== before[i])).toHaveLength(1);

    await alice.mutation(api.todos.move, { id: c, afterId: null });
    expect(await names()).toBe("cadb");
    await alice.mutation(api.todos.move, { id: c, afterId: b });
    expect(await names()).toBe("adbc");
    await alice.mutation(api.todos.move, { id: a, afterId: c });
    expect(await names()).toBe("dbca");
    // Same place again changes nothing visible.
    await alice.mutation(api.todos.move, { id: a, afterId: c });
    expect(await names()).toBe("dbca");
    await expect(
      alice.mutation(api.todos.move, { id: a, afterId: a }),
    ).rejects.toThrow();
    void b;
  });

  it("keeps order after many moves to the same gap", async () => {
    const { alice } = await setup();
    const a = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.add, { title: "b" });
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      ids.push(await alice.mutation(api.todos.add, { title: `n${i}` }));
    }
    for (const id of ids) {
      await alice.mutation(api.todos.move, { id: id as typeof a, afterId: a });
    }
    const list = await alice.query(api.todos.list, {});
    expect(list[0].title).toBe("a");
    expect(list[1].title).toBe("n29");
    expect(list.at(-1)!.title).toBe("b");
  });
});
