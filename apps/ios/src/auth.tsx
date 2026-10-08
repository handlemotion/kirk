// All sign-in code for this app lives here.
// To change the sign-in method, edit this file and convex/auth.ts only.
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// Tokens go in the iOS keychain through SecureStore.
// Convex Auth strips odd characters from keys, which SecureStore requires.
const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export function AuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  return (
    <ConvexAuthProvider client={client} storage={storage}>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow });
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
    <View style={styles.container}>
      <Text style={styles.title}>Kirk</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete={flow === "signIn" ? "current-password" : "new-password"}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.button, busy && styles.disabled]}
        disabled={busy}
        onPress={submit}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {flow === "signIn" ? "Sign in" : "Sign up"}
          </Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
        accessibilityRole="button"
      >
        <Text style={styles.link}>
          {flow === "signIn" ? "Create an account" : "I have an account"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#888",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  error: { color: "#c0392b" },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#2563eb", textAlign: "center", padding: 8 },
});
