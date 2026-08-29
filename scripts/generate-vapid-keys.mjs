import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]).toString("base64url");

console.log("WEB_PUSH_VAPID_PUBLIC_KEY=" + publicKey);
console.log("WEB_PUSH_VAPID_PRIVATE_KEY=" + jwk.d);
console.log("WEB_PUSH_VAPID_SUBJECT=mailto:hallo@munich-bike-rental.de");
