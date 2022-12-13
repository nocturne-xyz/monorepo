import { randomUUID } from "crypto";
import { Job } from "./types";

export function jobDataToJob<T>(jobData: T): Job<T> {
  const id = randomUUID();
  return {
    id,
    data: jobData,
  };
}

export function toJSON(object: any): string {
  return JSON.stringify(object, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}
