import { randomUUID } from "crypto";
import { Job } from "./types";

export function jobDataToJob<T>(jobData: T): Job<T> {
  const id = randomUUID();
  return {
    id,
    data: jobData,
  };
}
