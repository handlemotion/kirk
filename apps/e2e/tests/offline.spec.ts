import { expect, test } from "@playwright/test";
import { expectSameList, pairFor, uniqueEmail } from "../support/kirk";

test("offline tab shows the banner, blocks edits, then catches up", async ({
  browser,
}) => {
  const { a, b } = await pairFor(browser, uniqueEmail());
  await a.add("one");
  await a.add("two");
  await expectSameList(a, b, ["one", "two"]);
  await expect(b.banner).toHaveCount(0);

  const cutAt = Date.now();
  await b.setOffline(true);
  await expect(b.banner).toContainText("You are offline", {
    timeout: 5000,
  });
  console.log(`banner after ${Date.now() - cutAt} ms (not asserted)`);

  // Every edit control is disabled.
  const { page } = b;
  await expect(page.getByPlaceholder("Add a todo")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Done: one")).toBeDisabled();
  for (const name of ["Move up", "Move down", "Delete"]) {
    await expect(page.getByRole("button", { name }).first()).toBeDisabled();
  }

  // The other tab keeps working. The offline tab does not see it yet.
  await a.add("three");
  await a.rename("one", "one renamed");
  await a.remove("two");
  await a.expectTitles(["one renamed", "three"]);
  await b.expectTitles(["one", "two"]);

  await b.setOffline(false);
  await expect(b.banner).toHaveCount(0);
  await expectSameList(a, b, ["one renamed", "three"]);
  await expect(page.getByPlaceholder("Add a todo")).toBeEnabled();

  await a.context.close();
  await b.context.close();
});
