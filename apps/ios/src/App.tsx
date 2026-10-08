import {
  AuthLoading,
  Authenticated,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, SignInScreen } from "./auth";
import { TodoScreen } from "./TodoScreen";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) {
  throw new Error("Set EXPO_PUBLIC_CONVEX_URL. See apps/ios/.env.example.");
}

// React Native has no window events, so turn off the unsaved changes warning.
const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider client={convex}>
        <SafeAreaView style={styles.root}>
          <AuthLoading>
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          </AuthLoading>
          <Unauthenticated>
            <SignInScreen />
          </Unauthenticated>
          <Authenticated>
            <TodoScreen />
          </Authenticated>
        </SafeAreaView>
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
