// Prints the two keys Convex Auth needs: JWT_PRIVATE_KEY and JWKS.
// Run it, then set both on your Convex deployment. See the README.
// Nothing is written to disk. Do not commit the output.
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey))
  .trimEnd()
  .replace(/\n/g, " ");
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

console.log(`JWT_PRIVATE_KEY=${privateKey}`);
console.log(`JWKS=${jwks}`);
