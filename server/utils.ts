import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');

if (key.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
}

export function encrypt(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  if (typeof data !== 'string') {
    throw new Error('Data must be a string');
  }
  const [ivHex, encryptedHex] = data.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}