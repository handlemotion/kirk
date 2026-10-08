import { expect, test } from "@playwright/test";
import { Client, PASSWORD, uniqueEmail } from "../support/kirk";

test("sign up, reload, sign out, sign in, wrong password", async ({
  browser,
}) => {
  const email = uniqueEmail();
  const client = await Client.open(browser);
  const { page } = client;

  await client.signUp(email);
  await client.add("Persist me");
  await client.expectTitles(["Persist me"]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
  await client.expectTitles(["Persist me"]);

  await client.signOut();
  await expect(page.getByText("Persist me")).toHaveCount(0);

  await client.signIn(email, "not-the-password");
  await expect(page.getByText("Could not sign in")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kirk" })).toBeVisible();

  await client.signIn(email, PASSWORD);
  await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
  await client.expectTitles(["Persist me"]);

  await client.context.close();
});
