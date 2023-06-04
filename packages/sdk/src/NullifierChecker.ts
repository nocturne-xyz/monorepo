export interface NullifierChecker {
  nullifierIsInFlight(nf: bigint): Promise<boolean>;
}

export class BundlerNullifierChecker implements NullifierChecker {
  endpoint: string;

  constructor(bundlerEndpoint: string) {
    this.endpoint = bundlerEndpoint;
  }

  async nullifierIsInFlight(nf: bigint): Promise<boolean> {
    const res = await fetch(`${this.endpoint}/nullifier/${nf.toString()}`, {
      method: "GET",
    });

    let exists;
    try {
      const resJson = await res.json();
      exists = resJson.exists;
    } catch (err) {
      throw new Error(`failed to parse bundler response: ${err}`);
    }

    return exists;
  }
}

export class MockNullifierChecker implements NullifierChecker {
  constructor() {}

  async nullifierIsInFlight(_nf: bigint): Promise<boolean> {
    return true;
  }
}
