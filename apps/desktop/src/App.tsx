import {
  AuthLoading,
  Authenticated,
  ConvexReactClient,
  Unauthenticated,
} from "convex/react";
import { AuthProvider, SignInScreen } from "./auth";
import { TodoScreen } from "./TodoScreen";

const url = import.meta.env.VITE_CONVEX_URL;
if (!url) {
  throw new Error("Set VITE_CONVEX_URL. See apps/desktop/.env.example.");
}

const convex = new ConvexReactClient(url);

export function App() {
  return (
    <AuthProvider client={convex}>
      <AuthLoading>
        <p className="center">Loading</p>
      </AuthLoading>
      <Unauthenticated>
        <SignInScreen />
      </Unauthenticated>
      <Authenticated>
        <TodoScreen />
      </Authenticated>
    </AuthProvider>
  );
}
