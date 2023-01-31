/**
 * The bundler endpoint to use
 * Will default to the locally hosted bundler if no value is provided in environment.
 */
export const BUNDLER_ENDPOINT =
  process.env.REACT_APP_BUNDLER_ENDPOINT ?? "http://localhost:3000";
