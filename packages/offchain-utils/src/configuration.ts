/**
 * Get an unsigned integer value from an environment variable.
 * It will not throw if the environment variable is not set or is not a valid unsigned integer.
 *
 * @param envName string name of the environment variable
 */
export function intFromEnv(envName: string): number | null {
  const envValue = process.env[envName];
  if (envValue) {
    // check that it matches the regex for a positive integer
    if (!envValue.match(/^[1-9]\d*$/)) {
      return null;
    }
    return parseInt(envValue);
  }
  return null;
}
