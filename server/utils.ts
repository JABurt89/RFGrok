import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
const algorithm = "aes-256-cbc";

export function encrypt(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const [ivHex, encryptedHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
