/**
 * The snap origin to use.
 * Will default to the local hosted snap if no value is provided in environment.
 */
export const SNAP_ID =
  process.env.NEXT_PUBLIC_SNAP_ORIGIN ??
  process.env.REACT_APP_SNAP_ORIGIN ??
  `local:http://localhost:8080`;
