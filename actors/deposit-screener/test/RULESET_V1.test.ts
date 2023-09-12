import { expect } from "chai";
import { ScreeningDepositRequest } from "../src";
import { RULESET_V1 } from "../src/screening/checks/v1/RULESET_V1";

// Address contexts provided in: notion.so/nocturnelabs/Compliance-Provider-Evaluation-9ffe8bbf698f420498eba9e782e93b6d

const formDepositInfo = (
  spender: string,
  value = 0n
): ScreeningDepositRequest => {
  return {
    spender,
    assetAddr: "",
    value,
  } as const;
};

// const REJECT_ADDRESSES = {
//   ROCKETSWAP: "0x96c0876f573e27636612cf306c9db072d2b13de8",
//   ZUNAMI: "0x96c0876f573e27636612cf306c9db072d2b13de8",
//   ZUNAMI_2ND_DEGREE: "0xF00d0e11AcCe1eA37658f428d947C3FFFAeaDe70",
//   STEADEFI: "0xE10d4a5bd440775226C7e1858f573E379d0aca36",
//   EARNING_FARM: "0xee4b3dd20902Fa3539706F25005fa51D3b7bDF1b",
//   SUS_TC_USER: "0x5f1237bb7c14d4b4ae0026a186abc9c27a4b1224",
//   SWIRLEND: "0x26f6d954c4132fae4efe389b947c8cc4b4ce5ce7",
//   AZTEC_4: "0x8C9555D210C9019f952b0cCF57f8E65D542281F2",
// };

// const APPROVE_ADDRESSES = {
//   VITALIK: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
//   BEIKO: "0x10F5d45854e038071485AC9e402308cF80D2d2fE",
// };

const ADDRESSES = {
  TC_1: "0x86738d21db9a2ccc9747b2e374fd1a500f6eeb50",
  TC_2: "0xEE6572fD080F791E10B48F789a9C2eF76114bA86",
  TC_3: "0x3f77d1F729B439dA80264622dEACe480153e683D",
  TC_4: "0xa9b4b8108b6df063525aea9bac68b0e03b65e0c5",
  TC_5: "0x5E1B70EA7F694951ebAC269BEb2b3F4f25dD6e6a",
  TC_6: "0x698739c0F2e92446f6696578c89308A05F5BA0Fd",
  TC_7: "0xadd7885af8f37df5c965e5d16caf16f807dc79a0",

  AZTEC_1: "0x7c3171A6eabc8fc95077762ACF4B04eE1eAEF465",
  AZTEC_2: "0xd81A68F256985452E82297b43A465DE4F2a6Fd24",
  AZTEC_3: "0xa0bE23dB857262c8ff29763930fCD04Cc621FcCA",
} as const;

describe("RULESET_V1", () => {
  //   describe("Rejections", () => {
  //     it("should reject RocketSwap exploiter", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.ROCKETSWAP)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject Zunami exploiter", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.ZUNAMI)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject Zunami 2nd Degree exploiter", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.ZUNAMI_2ND_DEGREE)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject Steadefi exploiter", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.STEADEFI)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject Earning.Farm exploiter", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.EARNING_FARM)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject suspicious TC user", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.SUS_TC_USER)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject Swirlend exploiter", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.SWIRLEND)
  //       );
  //       expect(result.type).to.equal("Rejection");
  //     });

  //     it("should reject Aztec user 4 due to TRM_HIGH_INDIRECT_REJECT", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(REJECT_ADDRESSES.AZTEC_4)
  //       );
  //       expect(result).to.deep.equal({
  //         type: "Rejection",
  //         reason: "Indirect exposure to high risk categories > $20k",
  //       });
  //     });
  //   });

  //   describe("Approvals", () => {
  //     it("should approve Vitalik", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(APPROVE_ADDRESSES.VITALIK)
  //       );
  //       expect(result.type).to.equal("Delay");
  //     });

  //     it("should approve Beiko", async () => {
  //       const result = await RULESET_V1.check(
  //         formDepositInfo(APPROVE_ADDRESSES.BEIKO)
  //       );
  //       expect(result.type).to.equal("Delay");
  //     });
  //   });

  describe("Find out", () => {
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_1));
    //   expect(result).to.deep.equal({
    //     type: "Rejection",
    //     reason: "Score > 80 AND phishing/theft has > 0 attributions",
    //   });
    // });
    // // it("", async () => {
    // //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_2));
    // //   expect(result).to.deep.equal({
    // //     type: "Delay",
    // //     timeSeconds: 36000,
    // //   });
    // // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_3));
    //   expect(result).to.deep.equal({
    //     type: "Delay",
    //     timeSeconds: 93600,
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_4));
    //   expect(result).to.deep.equal({
    //     type: "Rejection",
    //     reason: "Score > 80 AND phishing/theft has > 0 attributions",
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_5));
    //   expect(result).to.deep.equal({
    //     type: "Delay",
    //     timeSeconds: 36000,
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_6));
    //   expect(result).to.deep.equal({
    //     type: "Rejection",
    //     reason: "Score > 80 AND phishing/theft has > 0 attributions",
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.TC_7));
    //   expect(result).to.deep.equal({
    //     type: "Rejection",
    //     reason: "Score > 80 AND phishing/theft has > 0 attributions",
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.AZTEC_1));
    //   expect(result).to.deep.equal({
    //     RESULT: "RESULT!",
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.AZTEC_2));
    //   console.log("AZTEC 2", result);
    //   expect(result).to.deep.equal({
    //     type: "Delay",
    //     timeSeconds: 36000,
    //   });
    // });
    // it("", async () => {
    //   const result = await RULESET_V1.check(formDepositInfo(ADDRESSES.AZTEC_3));
    //   expect(result).to.deep.equal({
    //     RESULT: "RESULT!",
    //   });
    // });
  });
});
