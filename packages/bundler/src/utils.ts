import * as JSON from "bigint-json-serialization";

export interface ActorHandle {
  // promise that resolves when the service is done
  promise: Promise<void>;
  // function to teardown the service
  // this must return
  teardown: () => Promise<void>;
}

export function actorChain(...actors: ActorHandle[]): ActorHandle {
  const promise = (async () => {
    await Promise.all(actors.map((a) => a.promise));
  })();

  return {
    promise,
    teardown: async () => {
      for (const actor of actors) {
        await actor.teardown();
      }

      await promise;      
    }
  }
}

export function parseRequestBody(body: any): any {
  return JSON.parse(JSON.stringify(body));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
