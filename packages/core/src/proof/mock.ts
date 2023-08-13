/* eslint-disable */
import {
  JoinSplitInputs,
  JoinSplitProofWithPublicSignals,
  JoinSplitProver,
} from "./joinsplit";
import {
  SubtreeUpdateInputs,
  SubtreeUpdateProofWithPublicSignals,
  SubtreeUpdateProver,
} from "./subtreeUpdate";

export class MockJoinSplitProver implements JoinSplitProver {
  async proveJoinSplit(
    inputs: JoinSplitInputs
  ): Promise<JoinSplitProofWithPublicSignals> {
    return {
      proof: {
        pi_a: [
          10130731927764841454826422418329415516436347861228895488643273166441561411533n,
          11439472045654552193501641935191272510310700749292254096971492059395490474333n,
          1n,
        ],
        pi_b: [
          [
            9504016565207506403669863325910909261895290869770400859912289060432212561556n,
            5585458639664330884674604979926545157738413552171896388847286041535475749994n,
          ],
          [
            2267922622178181050003250967905503768336745833139733443925008688127164753722n,
            6468132235966774883134391932455640712285941935421291196183449581615632867289n,
          ],
          [1n, 0n],
        ],
        pi_c: [
          2800516945315142887473640866885862831135118445429050888957031771876362402199n,
          3985265116619304756241073522055436097402195464512710302199703637002286482755n,
          1n,
        ],
        protocol: "groth16",
        curve: "bn128",
      },
      publicSignals: [
        15745358324915654535844038046342922394482477457481874702820953566518155886827n,
        15228173424381476800785150908932552081425805105938880762503659214470728216648n,
        2286544842324345429356520867027175085488900579338284790537283953002740638458n,
        0n,
        6788200415912446811036539433665043898703951932183083212685650527334780593664n,
        3410208679035955448048473506092758128219056888996571401261094425628605487166n,
        14250012864283992313906391437346116730749044873638625310078878077948282168152n,
        20001156114030335099503216805435516991522342005652960394711050779561820776979n,
        12345n,
        10n,
        5n,
      ],
    };
  }

  async verifyJoinSplitProof({
    proof,
    publicSignals,
  }: JoinSplitProofWithPublicSignals): Promise<boolean> {
    return true;
  }
}

export class MockSubtreeUpdateProver implements SubtreeUpdateProver {
  async proveSubtreeUpdate(
    inputs: SubtreeUpdateInputs
  ): Promise<SubtreeUpdateProofWithPublicSignals> {
    return {
      proof: {
        pi_a: [
          21088015562295919926803007890523568907362626291725881492664119321070036198844n,
          18570299120553316626792639026460482794951743347320028016548836843484744601335n,
          1n,
        ],
        pi_b: [
          [
            18399076212437565331601882738293618999410619553961059546664055085420817858275n,
            661678711464783610447054290055633914866586497386275419245879093835853047122n,
          ],
          [
            8762533967649298463154446960143798824114623972911546605629977597809947169997n,
            10802211552993792951695387914431138160620068296816508977496234075923402867880n,
          ],
          [1n, 0n],
        ],
        pi_c: [
          13813928389981190258664125494752022882655825809087555555723631827909962395616n,
          15050355748469127923587844385785301278607126500738632263544898455939385976127n,
          1n,
        ],
        protocol: "groth16",
        curve: "bn128",
      },
      publicSignals: [
        21443572485391568159800782191812935835534334817699172242223315142338162256601n,
        5509827880219772731374375585669724524727973663155755687024864114523504664635n,
        0n,
        12722949430739793925828359129762327968511013213886745107919442221783126903327n,
      ],
    };
  }

  async verifySubtreeUpdate({
    proof,
    publicSignals,
  }: SubtreeUpdateProofWithPublicSignals): Promise<boolean> {
    return true;
  }
}