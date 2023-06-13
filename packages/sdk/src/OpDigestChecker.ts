import { OperationStatus } from "./primitives";
import { OperationStatusResponse } from "./request";
import * as JSON from "bigint-json-serialization";

export interface OpDigestChecker {
  operationIsInFlight(opDigest: bigint): Promise<boolean>;
}

export class BundlerOpDigestChecker implements OpDigestChecker {
  endpoint: string;

  constructor(bundlerEndpoint: string) {
    this.endpoint = bundlerEndpoint;
  }

  async operationIsInFlight(opDigest: bigint): Promise<boolean> {
    const res = await fetch(
      `${this.endpoint}/operation/${opDigest.toString()}`,
      {
        method: "GET",
      }
    );

    let response: OperationStatusResponse;
    try {
      const resJson = await res.json();
      response = JSON.parse(resJson);
    } catch (err) {
      throw new Error(`failed to parse bundler response: ${err}`);
    }

    return (
      response.status === OperationStatus.QUEUED ||
      response.status === OperationStatus.PRE_BATCH ||
      response.status === OperationStatus.IN_BATCH ||
      response.status === OperationStatus.IN_FLIGHT
    );
  }
}

export class MockOpDigestChecker implements OpDigestChecker {
  constructor() {}

  async operationIsInFlight(_opDigest: bigint): Promise<boolean> {
    return true;
  }
}
