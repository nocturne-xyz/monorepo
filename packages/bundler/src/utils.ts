export function extractRequestError(
  json: any,
  deserFn: (json: string) => any
): string | undefined {
  try {
    deserFn(json);
    return undefined;
  } catch (e) {
    return (e as Error).toString();
  }
}
