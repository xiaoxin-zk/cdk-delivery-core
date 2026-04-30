import crypto from "node:crypto";
import { requireSecret } from "@/lib/env";

const PREFIX = "enc:v1:";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function encryptText(value: string) {
  if (!value) return "";
  const key = crypto.createHash("sha256").update(requireSecret("APP_SECRET")).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(value: string) {
  if (!value || !value.startsWith(PREFIX)) return value;
  const [, payload] = value.split(PREFIX);
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  const key = crypto.createHash("sha256").update(requireSecret("APP_SECRET")).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
