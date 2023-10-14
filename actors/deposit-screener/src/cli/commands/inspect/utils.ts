import { createHash } from "crypto";

export function hashString(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
