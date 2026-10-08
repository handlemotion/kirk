import { expect, test } from "@playwright/test";

test("renders a page", async ({ page }) => {
  await page.setContent("<h1>Kirk</h1>");
  await expect(page.locator("h1")).toHaveText(process.env.EXPECT ?? "Kirk");
});
