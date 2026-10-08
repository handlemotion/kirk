import { expect, test } from "@playwright/test";
import { expectSameList, pairFor, uniqueEmail } from "../support/kirk";

test("every change in one tab shows in the other, in order", async ({
  browser,
}) => {
  const { a, b } = await pairFor(browser, uniqueEmail());

  // Runs an action in A and waits for B to show the result.
  // The latency is logged, never asserted. CI machines are too noisy.
  const latencies: string[] = [];
  const step = async (
    label: string,
    action: () => Promise<unknown>,
    seenInB: () => Promise<unknown>,
  ) => {
    const start = Date.now();
    await action();
    await seenInB();
    latencies.push(`${label}: ${Date.now() - start} ms`);
  };

  await step(
    "add",
    async () => {
      await a.add("alpha");
      await a.add("beta");
      await a.add("gamma");
    },
    () => b.expectTitles(["alpha", "beta", "gamma"]),
  );

  await step(
    "check",
    () => a.check("beta"),
    () => expect(b.page.getByLabel("Done: beta")).toBeChecked(),
  );
  await step(
    "uncheck",
    () => a.check("beta", false),
    () => expect(b.page.getByLabel("Done: beta")).not.toBeChecked(),
  );
  await step(
    "rename",
    () => a.rename("gamma", "gamma two"),
    () => b.expectTitles(["alpha", "beta", "gamma two"]),
  );
  await step(
    "move",
    () => a.move("gamma two", "up"),
    () => b.expectTitles(["alpha", "gamma two", "beta"]),
  );
  await step(
    "move",
    () => a.move("alpha", "down"),
    () => b.expectTitles(["gamma two", "alpha", "beta"]),
  );
  await step(
    "delete",
    () => a.remove("alpha"),
    () => b.expectTitles(["gamma two", "beta"]),
  );

  await expectSameList(a, b, ["gamma two", "beta"]);

  // And back the other way.
  await b.add("from b");
  await expectSameList(a, b, ["gamma two", "beta", "from b"]);

  console.log(
    `latency (one machine, not asserted)\n  ${latencies.join("\n  ")}`,
  );
  test.info().annotations.push({
    type: "latency",
    description: latencies.join(", "),
  });

  await a.context.close();
  await b.context.close();
});
