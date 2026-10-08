// All sign-in code for this app lives here.
// To change the sign-in method, edit this file and convex/auth.ts only.
//
// Password sign-in makes no redirect, so it does not depend on how the
// Tauri web view handles URLs. Tokens use localStorage, which the web view
// keeps between launches. An OAuth or magic link method would need a
// separate check inside Tauri before it ships.
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import type { ConvexReactClient } from "convex/react";
import { useState, type FormEvent, type ReactNode } from "react";

export function AuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  return (
    <ConvexAuthProvider
      client={client}
      storage={window.localStorage}
      // The password flow never puts a code in the URL.
      shouldHandleCode={false}
    >
      {children}
    </ConvexAuthProvider>
  );
}

export function useSignOut() {
  return useAuthActions().signOut;
}

// Provisional: email and password. The provider is set in convex/auth.ts.
export function SignInScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await signIn("password", form);
    } catch {
      setError(
        flow === "signIn"
          ? "Could not sign in. Check your email and password."
          : "Could not sign up. Use a new email and a password of 8 or more characters.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="signin" onSubmit={submit}>
      <h1>Kirk</h1>
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        autoComplete={flow === "signIn" ? "current-password" : "new-password"}
        required
      />
      <input name="flow" type="hidden" value={flow} />
      {error !== null && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>
        {flow === "signIn" ? "Sign in" : "Sign up"}
      </button>
      <button
        type="button"
        className="link"
        onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
      >
        {flow === "signIn" ? "Create an account" : "I have an account"}
      </button>
    </form>
  );
}
