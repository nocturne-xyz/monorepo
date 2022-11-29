/* eslint-disable */
import {
  JoinSplitProofWithPublicSignals,
  JoinSplitProver,
} from "./joinsplit";
import {
  Spend2ProofWithPublicSignals,
  Spend2Prover,
} from "./spend2";
import { SubtreeUpdateProofWithPublicSignals, SubtreeUpdateProver } from "./subtreeUpdate";

export const mockSpend2Prover: Spend2Prover = {
  prove: async (inputs, wasmPath, zkeyPath) => mockSpend2Proof,
  verify: async (proof, vkeyPath) => true,
}

export const mockJoinSplitProver: JoinSplitProver = {
  prove: async (inputs, wasmPath, zkeyPath) => mockJoinSplitProof,
  verify: async (proof, vkeyPath) => true,
}

export const mockSubtreeUpdateProver: SubtreeUpdateProver = {
  prove: async (inputs, wasmPath, zkeyPath) => mockSubtreeUpdateProof,
  verify: async ({ proof, publicSignals }, vkey) => true,
}

const mockSpend2Proof: Spend2ProofWithPublicSignals = {
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

const mockJoinSplitProof: JoinSplitProofWithPublicSignals = {
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
    0n,
    0n,
  ],
};

const mockSubtreeUpdateProof: SubtreeUpdateProofWithPublicSignals = {
  proof: {
    pi_a: [
      21088015562295919926803007890523568907362626291725881492664119321070036198844n,
      18570299120553316626792639026460482794951743347320028016548836843484744601335n,
      1n
    ],
    pi_b: [
      [
        18399076212437565331601882738293618999410619553961059546664055085420817858275n,
        661678711464783610447054290055633914866586497386275419245879093835853047122n
      ],
      [
        8762533967649298463154446960143798824114623972911546605629977597809947169997n,
        10802211552993792951695387914431138160620068296816508977496234075923402867880n
      ],
      [1n, 0n],
    ],
    pi_c: [
      13813928389981190258664125494752022882655825809087555555723631827909962395616n,
      15050355748469127923587844385785301278607126500738632263544898455939385976127n,
      1n,
    ],
    protocol: "groth16",
    curve:"bn128",
  },
  publicSignals: [
    21443572485391568159800782191812935835534334817699172242223315142338162256601n,
    5509827880219772731374375585669724524727973663155755687024864114523504664635n,
    0n,
    12722949430739793925828359129762327968511013213886745107919442221783126903327n
  ]
};
