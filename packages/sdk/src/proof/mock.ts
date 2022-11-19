/* eslint-disable */
import {
  Spend2Inputs,
  Spend2ProofWithPublicSignals,
  Spend2Prover,
} from "./spend2";

export class MockSpend2Prover implements Spend2Prover {
  async proveSpend2(
    inputs: Spend2Inputs,
    wasmPath?: string | undefined,
    zkeyPath?: string | undefined
  ): Promise<Spend2ProofWithPublicSignals> {
    return {
      proof: {
        pi_a: [
          4625618875644840598028618709964737071286323400035166515439999382907260759149n,
          17311032563331855279445872303264485039998633247887608441088500649081148079946n,
          1n,
        ],
        pi_b: [
          [
            13007885783730414158143984568183321745689009973858290719017290684321521768443n,
            15187630932898581824766028072298509985745514095907718376153248118195922121465n,
          ],
          [
            19982514269577669084161742435664771034313802853778646902466014202600961278963n,
            19575086494256626956571781527451095236278831092611242037553148298417399856249n,
          ],
          [1n, 0n],
        ],
        pi_c: [
          6816063603942979089072353289282218712969038145805634233931162093973057523782n,
          1157455506355460374427767631046449627653083706398878264038471689135201457352n,
          1,
        ],
        protocol: "groth16",
        curve: "bn128",
      },
      publicSignals: [
        14004181798418989328613722247011874689459645890667748560829877407283949597397n,
        9542032276307073637223040869858109255812851392386867028973820839725323970450n,
        10n,
        5n,
        50n,
        13098195026410129504860098353964494825003627132306398337204478043612943076752n,
        12345n,
      ],
    };
  }

  async verifySpend2Proof(
    { proof, publicSignals }: Spend2ProofWithPublicSignals,
    vkeyPath?: string | undefined
  ): Promise<boolean> {
    return true;
  }
}
