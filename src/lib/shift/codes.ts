import { randomBytes } from "crypto";

const CODE_ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

export function makeShareCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function makeAdminKey(): string {
  return randomBytes(18).toString("base64url");
}

export function makeId(): string {
  return randomBytes(12).toString("hex");
}
