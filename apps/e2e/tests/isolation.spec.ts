import { expect, test } from "@playwright/test";
import { Client, uniqueEmail } from "../support/kirk";

test("two accounts do not see each other's todos", async ({ browser }) => {
  const one = await Client.open(browser);
  const two = await Client.open(browser);
  await one.signUp(uniqueEmail());
  await two.signUp(uniqueEmail());

  await one.add("only for one");
  await two.add("only for two");
  await one.expectTitles(["only for one"]);
  await two.expectTitles(["only for two"]);

  // A change by one must not leak to the other. Give a leak time to arrive.
  await one.check("only for one");
  await one.rename("only for one", "one renamed");
  await one.expectTitles(["one renamed"]);
  await two.page.waitForTimeout(500);
  await two.expectTitles(["only for two"]);
  await expect(two.page.getByLabel("Done: only for two")).not.toBeChecked();

  await one.context.close();
  await two.context.close();
});
