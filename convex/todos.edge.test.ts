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
  };
}

type Alice = Awaited<ReturnType<typeof setup>>["alice"];

async function titles(user: Alice) {
  return (await user.query(api.todos.list, {})).map((t) => t.title).join("");
}

describe("todos titles", () => {
  it("trims on rename", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.rename, { id, title: "  b  " });
    expect(await titles(alice)).toBe("b");
  });

  it("accepts 500 characters and counts them after trimming", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "x".repeat(500) });
    await alice.mutation(api.todos.rename, { id, title: ` ${"y".repeat(500)} ` });
    expect((await alice.query(api.todos.list, {}))[0].title).toBe(
      "y".repeat(500),
    );
    await expect(
      alice.mutation(api.todos.rename, { id, title: "z".repeat(501) }),
    ).rejects.toThrow();
  });

  it("keeps the old title when a rename is rejected", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "keep" });
    await expect(
      alice.mutation(api.todos.rename, { id, title: "   " }),
    ).rejects.toThrow();
    expect(await titles(alice)).toBe("keep");
  });
});

describe("todos after a delete", () => {
  // A second device can delete a todo while the first still shows it.
  it("rejects every mutation on a deleted todo", async () => {
    const { alice } = await setup();
    const id = await alice.mutation(api.todos.add, { title: "gone" });
    const other = await alice.mutation(api.todos.add, { title: "other" });
    await alice.mutation(api.todos.remove, { id });
    await expect(
      alice.mutation(api.todos.rename, { id, title: "x" }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.todos.setDone, { id, done: true }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.todos.move, { id, afterId: null }),
    ).rejects.toThrow();
    await expect(
      alice.mutation(api.todos.move, { id: other, afterId: id }),
    ).rejects.toThrow();
    expect(await titles(alice)).toBe("other");
  });
});

describe("todos move", () => {
  it("moves to the end and to the top of a short list", async () => {
    const { alice } = await setup();
    const a = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.add, { title: "b" });
    const c = await alice.mutation(api.todos.add, { title: "c" });
    await alice.mutation(api.todos.move, { id: a, afterId: c });
    expect(await titles(alice)).toBe("bca");
    await alice.mutation(api.todos.move, { id: a, afterId: null });
    expect(await titles(alice)).toBe("abc");
    await alice.mutation(api.todos.move, { id: c, afterId: null });
    expect(await titles(alice)).toBe("cab");
  });

  it("moves the only todo", async () => {
    const { alice } = await setup();
    const a = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.move, { id: a, afterId: null });
    expect(await titles(alice)).toBe("a");
  });

  it("changes only the order of the moved todo", async () => {
    const { alice } = await setup();
    const a = await alice.mutation(api.todos.add, { title: "a" });
    await alice.mutation(api.todos.add, { title: "b" });
    await alice.mutation(api.todos.setDone, { id: a, done: true });
    const [before] = await alice.query(api.todos.list, {});
    const c = await alice.mutation(api.todos.add, { title: "c" });
    await alice.mutation(api.todos.move, { id: a, afterId: c });
    const moved = (await alice.query(api.todos.list, {})).find(
      (t) => t._id === a,
    )!;
    expect(moved).toMatchObject({
      title: before.title,
      done: true,
      ownerId: before.ownerId,
      _creationTime: before._creationTime,
    });
    expect(moved.order).not.toBe(before.order);
  });

  it("adds new todos after the end even after a move to the top", async () => {
    const { alice } = await setup();
    await alice.mutation(api.todos.add, { title: "a" });
    const b = await alice.mutation(api.todos.add, { title: "b" });
    await alice.mutation(api.todos.move, { id: b, afterId: null });
    await alice.mutation(api.todos.add, { title: "c" });
    expect(await titles(alice)).toBe("bac");
  });

  it("breaks a tie between equal keys by creation time", async () => {
    const { t, alice } = await setup();
    const a = await alice.mutation(api.todos.add, { title: "a" });
    const b = await alice.mutation(api.todos.add, { title: "b" });
    await alice.mutation(api.todos.add, { title: "c" });
    // Concurrent writes should not do this. Check that the list copes.
    const shared = (await alice.query(api.todos.list, {}))[0].order;
    await t.run((ctx) => ctx.db.patch(b, { order: shared }));
    expect(await titles(alice)).toBe("abc");
    await alice.mutation(api.todos.move, { id: a, afterId: b });
    expect(await titles(alice)).toBe("bac");
  });
});

describe("todos lists of two people", () => {
  it("keeps each list in order when adds interleave", async () => {
    const { alice, bob } = await setup();
    await alice.mutation(api.todos.add, { title: "a1" });
    await bob.mutation(api.todos.add, { title: "b1" });
    await alice.mutation(api.todos.add, { title: "a2" });
    await bob.mutation(api.todos.add, { title: "b2" });
    expect(await titles(alice)).toBe("a1a2");
    expect(await titles(bob)).toBe("b1b2");
  });

  it("moves in one list without touching the other", async () => {
    const { alice, bob } = await setup();
    await alice.mutation(api.todos.add, { title: "a1" });
    const a2 = await alice.mutation(api.todos.add, { title: "a2" });
    await bob.mutation(api.todos.add, { title: "b1" });
    await bob.mutation(api.todos.add, { title: "b2" });
    const before = await bob.query(api.todos.list, {});
    await alice.mutation(api.todos.move, { id: a2, afterId: null });
    expect(await titles(alice)).toBe("a2a1");
    expect(await bob.query(api.todos.list, {})).toEqual(before);
  });
});
