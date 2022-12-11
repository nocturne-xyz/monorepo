import { Job } from "bullmq";
import { OperationStatus, RelayJobData } from "./common";

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

export async function updateOperationStatus(
  job: Job<RelayJobData>,
  status: OperationStatus
): Promise<void> {
  job.data.status = status;
  await job.update(job.data);
}
