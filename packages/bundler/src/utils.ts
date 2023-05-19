import { ActorHandle } from "@nocturne-xyz/offchain-utils";

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
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
