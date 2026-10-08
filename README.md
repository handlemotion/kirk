# Kirk

Kirk is a realtime todo list for iOS, macOS and Windows. The backend is Convex. Every signed-in device sees changes live.

v1 is online only. When the connection drops, the apps show a banner and block edits.

## Layout

| Path | What it is |
| --- | --- |
| `convex/` | Schema, auth and the five todo functions. Tests sit next to them. |
| `packages/shared/` | Convex hooks, types, optimistic list updates and reorder logic. |
| `apps/ios/` | Expo (React Native) iOS app. |
| `apps/desktop/` | Tauri 2 app for macOS and Windows. React and Vite UI. |
| `scripts/generate-keys.mjs` | Prints the two keys Convex Auth needs. |

Both apps import `@kirk/shared`. Each app keeps all sign-in code in one file: `src/auth.tsx`.

## Data model

`todos` has `ownerId`, `title`, `done` and `order`. The `by_owner_order` index covers `ownerId` then `order`. Convex Auth manages `users`.

- Functions: `todos.list` (query), `todos.add`, `todos.rename`, `todos.setDone`, `todos.move`, `todos.remove` (mutations).
- Every function rejects a call with no signed-in person.
- Mutations also check that the todo belongs to the caller.
- `ownerId` and `order` are set on the server. The app never sends them.
- `setDone` takes `true` or `false`. It never toggles.
- `move` takes the id of the todo to sit after (`null` for the top). The server reads the neighbours and writes one row.
- Deletes are hard deletes.

## First-time setup

You need Node 20 or later and pnpm.

```sh
pnpm install
```

### 1. Create the Convex deployment

```sh
npx convex dev
```

This asks you to log in and create a project. It writes `.env.local` (git-ignored) and prints your deployment URL. It also regenerates `convex/_generated`.

`convex/_generated` in this repo was written by hand from the Convex codegen templates, because the build box could not log in. Running `npx convex dev` replaces it. Commit any diff it makes.

### 2. Set the auth environment variables

Convex Auth needs two keys on the deployment. Generate them:

```sh
node scripts/generate-keys.mjs
```

Copy the two lines it prints into the Convex dashboard. Open your deployment, go to Settings, then Environment Variables, and add:

| Name | Value |
| --- | --- |
| `JWT_PRIVATE_KEY` | The `JWT_PRIVATE_KEY` value from the script. |
| `JWKS` | The `JWKS` value from the script. |

`CONVEX_SITE_URL` is set by Convex. `SITE_URL` is only needed for redirect-based sign-in. The password method does not need it.

Do not commit these values. Set them again, with new keys, on the production deployment.

### 3. Point the apps at Convex

```sh
cp apps/ios/.env.example apps/ios/.env.local
cp apps/desktop/.env.example apps/desktop/.env.local
```

Set `EXPO_PUBLIC_CONVEX_URL` and `VITE_CONVEX_URL` to the URL from step 1. Both are public values.

## Run

Keep `npx convex dev` running in one terminal.

```sh
# iOS. Needs a Mac with Xcode.
pnpm --filter @kirk/ios ios

# Desktop. Needs Rust and the Tauri prerequisites for your OS.
pnpm --filter @kirk/desktop tauri dev
```

Desktop prerequisites are listed at https://tauri.app/start/prerequisites/.

For a quick look at the desktop UI in a browser, run `pnpm --filter @kirk/desktop dev` and open http://localhost:5173.

## Checks

```sh
pnpm check
```

This runs typecheck, lint (oxlint), a format check (oxfmt) and tests. Run `pnpm format` to fix formatting. Vitest has three projects:

- `convex`: the Convex functions, with `convex-test`.
- `shared`: the reorder logic, and the hooks in `packages/shared`. The hook tests use a real `ConvexReactClient` on a fake WebSocket (`src/fake-server.ts`), so the optimistic updates run as they do in the apps.
- `desktop`: the desktop `TodoScreen`, with the shared hooks mocked. Runs in jsdom.

The iOS screen has no component tests.

## TypeScript 7

The repo uses TypeScript 7, the native compiler. `tsc` is a Go binary. The `typescript` package has no compiler API in 7.0, so a tool that imports `typescript` at runtime cannot use it. Nothing in Kirk does. If you add such a tool, such as typescript-eslint, alias a 6.x copy for it. See https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/.

Expo SDK 57 lists TypeScript 6 as its expected version. `apps/ios/package.json` sets `expo.install.exclude` so `expo install --check` and `expo start` do not warn about TypeScript 7.

## Sign-in is provisional

The sign-in method is not decided. v1 uses the Convex Auth Password provider because it needs no external service.

- Server: `convex/auth.ts`, the `providers` list.
- iOS: `apps/ios/src/auth.tsx`.
- Desktop: `apps/desktop/src/auth.tsx`.

Convex Auth is in beta. Check its docs before you upgrade: https://labs.convex.dev/auth.

There is no password reset or email verification in v1. Those need an email provider.

## Known web view notes

These come from the Tauri docs. None of it has been run in a real Tauri window yet. Manual test D covers it.

- **Token storage.** The desktop app keeps the Convex Auth tokens in `localStorage` (`apps/desktop/src/auth.tsx`). The web view is WebView2 on Windows and WKWebView on macOS. https://v2.tauri.app/reference/webview-versions/
- **Origin.** The app loads from `tauri://localhost` on macOS and Linux. On Windows it loads from `http://tauri.localhost`. `localStorage` belongs to the origin, so a change of origin loses the signed-in session. https://v2.tauri.app/reference/config/ (see `useHttpsScheme`)
- **Pin the Windows origin before the first release.** The window option `useHttpsScheme` is `false` by default. Docs: "Changing this value between releases will change the IndexedDB, cookies and localstorage location". Tauri 1 used `https://tauri.localhost`. Tauri 2 resets storage on that move: https://v2.tauri.app/start/migrate/from-tauri-1/. Kirk does not set the option. Choose a value now and never flip it after users sign in. The `https` origin also blocks mixed content, which does not matter here because Convex uses `https` and `wss`.
- **CSP.** Tauri adds nonces and hashes to local scripts and styles at build time, and only when a policy is set in `tauri.conf.json`. https://v2.tauri.app/security/csp/. Kirk's policy allows `https://*.convex.cloud` and `wss://*.convex.cloud` in `connect-src`. `ipc:` and `http://ipc.localhost` are Tauri's own IPC channels.
- **Custom Convex domain.** A domain outside `*.convex.cloud` is blocked by `connect-src`. Add both its `https://` and `wss://` forms. The same goes for the Convex HTTP actions host if you add one.
- **Redirect sign-in.** OAuth and magic links return to the app through a URL. That needs a deep link or a local server inside Tauri. It is not tested. Password sign-in avoids the problem.

## Desktop CI

`.github/workflows/desktop-build.yml` builds the desktop app, unsigned, on macOS, Windows and Linux. It runs on pull requests and pushes that touch `apps/desktop`, `packages/shared` or `convex`. It uses a dummy `VITE_CONVEX_URL`, has no signing steps and does not publish anything.

## Offline behavior

Both apps read the Convex WebSocket state. When it is closed, the app shows a banner and disables every edit control. Kirk stores nothing offline and has no write queue of its own.

The Convex client keeps its own in-memory list of mutations that are already in flight. If the connection drops in the instant after a tap, that one mutation can still be sent on reconnect. The apps never add to that list while offline.

## Manual tests

These need real devices. Run them before you ship.

### A. Two-device latency

Target: a change on one device shows on another in under 500 ms on a normal connection.

1. Sign in with the same account on two devices. Use any pair: iOS and Mac, Mac and Windows, and so on.
2. Put both screens in one camera frame. Use a phone camera at 120 or 240 fps.
3. On device 1, check off a todo. Note the video frame of the tap.
4. Note the frame where device 2 redraws. The gap is the latency.
5. Repeat 10 times for each action: add, check, rename, move, delete.
6. Pass: the median gap is under 500 ms and no run is over 1 s.
7. Check that the acting device does not flicker or reorder when the server result arrives.

Also check:

- Two devices check the same todo at the same moment. Both end on the same state.
- Two devices add a todo at the same moment. Both todos appear, in the same order on both devices.
- Two devices move different todos at once. Both lists match afterward.

### B. iOS background and reopen

1. Sign in on the iPhone. Add three todos.
2. Press Home. The app goes to the background.
3. On a second device, add one todo, rename one and delete one.
4. Wait 60 seconds. Open the app again.
5. Pass: the list matches the other device within 2 seconds. No relaunch, no sign-in screen, no duplicates.
6. Repeat after 10 minutes in the background.
7. Repeat after you force-quit and reopen. Pass: you are still signed in.

### C. Offline banner

1. On each app, turn on airplane mode, or disconnect from the network.
2. Pass: the banner shows within a few seconds. Add, check, rename, move and delete are disabled.
3. Turn the network back on.
4. Pass: the banner clears and the list matches the server. Changes made on another device while offline appear.

### D. Sign-in on each platform

Run these on iOS, macOS and Windows.

1. Sign up with a new email and an 8 character password. Pass: you land on the empty list.
2. Quit the app and open it again. Pass: you are still signed in. This checks token storage. On desktop it checks that the web view keeps `localStorage`.
3. Sign out. Pass: the sign-in screen shows and the list is gone.
4. Sign in with a wrong password. Pass: an error shows.
5. Sign in as a second account. Pass: it sees none of the first account's todos.

The desktop checks matter most. Sign-in inside a Tauri web view has not been tested yet. The password method makes no redirect, so it should be safe. If a redirect-based method replaces it, test that flow on both desktop systems first.

### E. iOS drag to reorder

The gesture has not been run on a device or simulator. This test is the first check.

1. Add five todos. Tap Reorder. A ☰ handle shows on each row, and tap-to-edit is off.
2. Touch and hold a handle, then drag the row to a new place. Pass: other rows slide out of the way. On release the row stays put.
3. Pass: a second device shows the new order within 500 ms. The dragged row does not jump back and forth on the first device.
4. Drag a row to the top, to the bottom, and to its own place. Pass: each ends right. Dropping in place changes nothing.
5. Add 20 todos. Drag a row to the edge of the screen. Pass: the list scrolls on its own.
6. Scroll the list with a finger when Reorder is on. Pass: it scrolls and no row lifts.
7. Turn on airplane mode. Pass: handles are dimmed and a hold on a handle lifts nothing.
8. Turn on VoiceOver. Focus a handle and open the actions rotor. Pass: Move up and Move down work, and the list matches on the second device.
9. Tap Done. Pass: handles are gone and tap-to-edit works again.

## Ship steps

Do not run these until the manual tests pass. They need your accounts and certificates.

### Production Convex

```sh
npx convex deploy
```

Set `JWT_PRIVATE_KEY` and `JWKS` on the production deployment. Use freshly generated keys. Note the production URL.

If the production URL is not on `*.convex.cloud`, add it to `connect-src` in `apps/desktop/src-tauri/tauri.conf.json`.

### iOS: TestFlight

Needs an Apple Developer Program account and a Mac or EAS.

1. Change `ios.bundleIdentifier` in `apps/ios/app.json`. The current value, `app.kirk.todo`, is a placeholder.
2. Create the app in App Store Connect with the same bundle id.
3. Set `EXPO_PUBLIC_CONVEX_URL` to the production URL for the build.
4. Build and submit with EAS:

```sh
cd apps/ios
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

   Or run `npx expo prebuild --platform ios`, then archive in Xcode and upload to App Store Connect.
5. In App Store Connect, add testers under TestFlight.

### macOS: signed and notarized installer

Needs an Apple Developer ID Application certificate. Run on a Mac.

1. Install both targets: `rustup target add aarch64-apple-darwin x86_64-apple-darwin`.
2. Set `VITE_CONVEX_URL` to the production URL.
3. Set the signing variables Tauri reads: `APPLE_SIGNING_IDENTITY`, and for notarization either `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` or an App Store Connect API key. In CI, also `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD`.
4. Build:

```sh
pnpm --filter @kirk/desktop tauri build --target universal-apple-darwin
```

The `.dmg` is under `apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/`.

### Windows: signed installer

Needs a code signing certificate. Run on Windows.

1. Set `VITE_CONVEX_URL` to the production URL.
2. Configure signing in `apps/desktop/src-tauri/tauri.conf.json` under `bundle.windows`, with `certificateThumbprint` or `signCommand`.
3. Build:

```sh
pnpm --filter @kirk/desktop tauri build
```

The installers are under `apps/desktop/src-tauri/target/release/bundle/`. Check the current Tauri signing guide before you start: https://tauri.app/distribute/.

## Not done

- No offline editing, multiple lists, sharing, tags or due dates.
- No push notifications or background refresh.
- The desktop app icon is a placeholder. Replace `apps/desktop/src-tauri/icons` with `pnpm --filter @kirk/desktop tauri icon <png>`.
- `Cargo.lock` is not committed. The first `tauri dev` creates it. Commit it then.
