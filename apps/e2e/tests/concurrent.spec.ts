import { expect, test } from "@playwright/test";
import { expectSameList, pairFor, uniqueEmail } from "../support/kirk";

test("concurrent edits end on the same state in both tabs", async ({
  browser,
}) => {
  const { a, b } = await pairFor(browser, uniqueEmail());
  await a.add("shared");
  await expectSameList(a, b, ["shared"]);

  // Both check the same todo at the same moment.
  await Promise.all([a.toggleNow("shared"), b.toggleNow("shared")]);
  await expect(a.page.getByLabel("Done: shared")).toBeChecked();
  await expect(b.page.getByLabel("Done: shared")).toBeChecked();

  // Both rename it at the same moment. Either name may win.
  // The two tabs must agree on the winner.
  await Promise.all([
    a.rename("shared", "name a"),
    b.rename("shared", "name b"),
  ]);
  await expect
    .poll(async () => {
      const [left, right] = await Promise.all([
        a.titles.allTextContents(),
        b.titles.allTextContents(),
      ]);
      return left.join() === right.join() && left.length === 1 ? left[0] : null;
    })
    .toMatch(/^name [ab]$/);

  // Both add a todo at the same moment. Both must appear, in one order.
  await Promise.all([a.add("from a"), b.add("from b")]);
  await expect(a.titles).toHaveCount(3);
  await expect(b.titles).toHaveCount(3);
  await expectSameList(a, b);
  const list = await a.titles.allTextContents();
  expect(list).toContain("from a");
  expect(list).toContain("from b");

  await a.context.close();
  await b.context.close();
});
