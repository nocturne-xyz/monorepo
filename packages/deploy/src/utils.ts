export type Address = string;

export function assertOrErr(condition: boolean, error?: string): void {
  if (!condition) {
    throw new Error(error);
  }
}
