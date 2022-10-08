import { proveSpend2, NoteInput, Spend2Inputs } from "./spend2";

test("it builds properly", async () => {
  const oldNote: NoteInput = {
    owner: {
      h1X: 0n,
      h1Y: 0n,
      h2X: 0n,
      h2Y: 0n,
      h3X: 0n,
      h3Y: 0n,
    },
    nonce: 0n,
    type: 0n,
    id: 0n,
    value: 0n,
  };

  const newNote: NoteInput = {
    owner: {
      h1X: 0n,
      h1Y: 0n,
      h2X: 0n,
      h2Y: 0n,
      h3X: 0n,
      h3Y: 0n,
    },
    nonce: 0n,
    type: 0n,
    id: 0n,
    value: 0n,
  };

  const vk = 0n;
  const operationDigest = 0n;
  const c = 0n;
  const z = 0n;

  const merkleProof = {
    path: new Array(32).fill(0n),
    siblings: new Array(32).fill(0n),
  };

  const inputs: Spend2Inputs = {
    vk,
    operationDigest,
    c,
    z,
    oldNote,
    newNote,
    merkleProof,
  };

  await proveSpend2(inputs);
});
