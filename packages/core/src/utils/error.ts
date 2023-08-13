export function assertOrErr(cond: boolean, msg?: string): void {
  if (!cond) throw new Error(msg);
}
