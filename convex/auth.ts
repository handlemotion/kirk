import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Provisional: the sign-in method is not decided yet.
// Password needs no external service. To change it, edit this list
// and the sign-in module in each app.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
