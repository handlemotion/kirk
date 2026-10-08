import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type WebSocketRoute,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

export const PASSWORD = "correct-horse-battery";

// A new address per call, so reruns and parallel tests never collide.
export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

// One browser tab with its own context, so its own localStorage and its own
// WebSocket to Convex.
//
// Chromium keeps an open WebSocket alive after `context.setOffline(true)`, so
// the Convex socket goes through a Playwright route. The route forwards to
// the real backend. `setOffline` below closes both sides of it, which is what
// a dropped network does, and `context.setOffline` blocks the retries.
export class Client {
  private offline = false;
  private sockets = new Set<WebSocketRoute>();

  private constructor(
    readonly context: BrowserContext,
    readonly page: Page,
  ) {}

  static async open(browser: Browser): Promise<Client> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const client = new Client(context, page);
    await context.routeWebSocket(/\/api\/[^/]+\/sync$/, (page) => {
      if (client.offline) {
        void page.close();
        return;
      }
      const server = page.connectToServer();
      client.sockets.add(page);
      client.sockets.add(server);
    });
    await client.page.goto("/");
    return client;
  }

  async setOffline(offline: boolean) {
    this.offline = offline;
    await this.context.setOffline(offline);
    if (offline) {
      await Promise.all([...this.sockets].map((ws) => ws.close()));
      this.sockets.clear();
    }
  }

  get banner(): Locator {
    return this.page.getByRole("alert");
  }

  get titles(): Locator {
    return this.page.locator("li .title");
  }

  row(title: string): Locator {
    return this.page.locator("li").filter({ hasText: title });
  }

  async signUp(email: string, password = PASSWORD) {
    await this.page.getByRole("button", { name: "Create an account" }).click();
    await this.submit(email, password, "Sign up");
    await expect(
      this.page.getByRole("heading", { name: "Todos" }),
    ).toBeVisible();
  }

  async signIn(email: string, password = PASSWORD) {
    await this.submit(email, password, "Sign in");
  }

  async signOut() {
    await this.page.getByRole("button", { name: "Sign out" }).click();
    await expect(
      this.page.getByRole("heading", { name: "Kirk" }),
    ).toBeVisible();
  }

  private async submit(email: string, password: string, button: string) {
    await this.page.getByPlaceholder("Email").fill(email);
    await this.page.getByPlaceholder("Password").fill(password);
    await this.page.getByRole("button", { name: button, exact: true }).click();
  }

  async add(title: string) {
    await this.page.getByPlaceholder("Add a todo").fill(title);
    await this.page.getByRole("button", { name: "Add", exact: true }).click();
  }

  check(title: string, done = true) {
    return this.page.getByLabel(`Done: ${title}`).setChecked(done);
  }

  // Clicks the checkbox from inside the page. That skips Playwright's
  // actionability waits, so two tabs click within a millisecond or two.
  // A synced change cannot land between the check and the click.
  toggleNow(title: string) {
    return this.page
      .getByLabel(`Done: ${title}`)
      .evaluate((el: HTMLInputElement) => el.click());
  }

  async rename(from: string, to: string) {
    await this.row(from).locator(".title").dblclick();
    const input = this.page.locator("li .edit");
    await input.fill(to);
    await input.press("Enter");
  }

  move(title: string, direction: "up" | "down") {
    return this.row(title)
      .getByRole("button", { name: `Move ${direction}` })
      .click();
  }

  remove(title: string) {
    return this.row(title).getByRole("button", { name: "Delete" }).click();
  }

  // The list as the user sees it, top to bottom.
  async expectTitles(expected: string[]) {
    if (expected.length === 0) {
      await expect(this.page.getByText("Nothing to do.")).toBeVisible();
    } else {
      await expect(this.titles).toHaveText(expected);
    }
  }
}

// Two tabs signed in to one account.
export async function pairFor(browser: Browser, email: string) {
  const a = await Client.open(browser);
  await a.signUp(email);
  const b = await Client.open(browser);
  await b.signIn(email);
  await expect(b.page.getByRole("heading", { name: "Todos" })).toBeVisible();
  return { a, b };
}

// Both tabs must show the same list, in the same order.
export async function expectSameList(
  a: Client,
  b: Client,
  expected?: string[],
) {
  await expect
    .poll(async () => {
      const [left, right] = await Promise.all([
        a.titles.allTextContents(),
        b.titles.allTextContents(),
      ]);
      return left.join("|") === right.join("|") ? left : null;
    })
    .not.toBeNull();
  if (expected) await a.expectTitles(expected);
  if (expected) await b.expectTitles(expected);
}
