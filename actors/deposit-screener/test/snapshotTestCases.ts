// Address contexts provided in: notion.so/nocturnelabs/Compliance-Provider-Evaluation-9ffe8bbf698f420498eba9e782e93b6d

export const REJECT_ADDRESSES = {
  ROCKETSWAP: "0x96c0876f573e27636612cf306c9db072d2b13de8",
  ZUNAMI: "0x5f4C21c9Bb73c8B4a296cC256C0cDe324dB146DF",
  ZUNAMI_2ND_DEGREE: "0xF00d0e11AcCe1eA37658f428d947C3FFFAeaDe70",
  STEADEFI: "0xE10d4a5bd440775226C7e1858f573E379d0aca36",
  EARNING_FARM: "0xee4b3dd20902Fa3539706F25005fa51D3b7bDF1b",
  // todo: this sus_tc_user is not rejected but it should be. May have to add to the ruleset something like "high value + mixer usage > 50%".
  SUS_TC_USER: "0x5f1237bb7c14d4b4ae0026a186abc9c27a4b1224",
  SWIRLEND: "0x26f6d954c4132fae4efe389b947c8cc4b4ce5ce7",
  TC_1: "0x86738d21db9a2ccc9747b2e374fd1a500f6eeb50",
  TC_4: "0xa9b4b8108b6df063525aea9bac68b0e03b65e0c5",
  TC_6: "0x698739c0F2e92446f6696578c89308A05F5BA0Fd",
  TC_7: "0xadd7885af8f37df5c965e5d16caf16f807dc79a0",
} as const;

export const APPROVE_ADDRESSES = {
  VITALIK: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  BEIKO: "0x10F5d45854e038071485AC9e402308cF80D2d2fE",
  TC_2: "0xEE6572fD080F791E10B48F789a9C2eF76114bA86",
  TC_3: "0x3f77d1F729B439dA80264622dEACe480153e683D",
  TC_5: "0x5E1B70EA7F694951ebAC269BEb2b3F4f25dD6e6a",
  TC_8: "0x5f1237bb7c14d4b4ae0026a186abc9c27a4b1224",
  AZTEC_2: "0xd81A68F256985452E82297b43A465DE4F2a6Fd24",
  AZTEC_1: "0x7c3171A6eabc8fc95077762ACF4B04eE1eAEF465",
  AZTEC_3: "0xa0bE23dB857262c8ff29763930fCD04Cc621FcCA",
  AZTEC_4: "0x8C9555D210C9019f952b0cCF57f8E65D542281F2",
} as const;

export const NAMED_TEST_ADDRESSES = {
  ...REJECT_ADDRESSES,
  ...APPROVE_ADDRESSES,
} as const;

// TODO: 7 of these are still commented out until we introduce a whitelist feature
export const BULK_TEST_CASES = [
  {
    type: "ENS",
    addresses: [
      "0x9c5083dd4838E120Dbeac44C052179692Aa5dAC5", // "pennilesswassie.eth",
      "0xAa9c52276069B58227697805F24707e175313351", // "Voltokara.eth",
      "0x471f59dD44f4b3c8F075FFa6ec59362D3C3Cd6dc", // "patokeeem.eth",
    ],
    isRejected: false,
  },
  {
    type: "Still Active Users",
    addresses: [
      "0x8a7fbe7452b9a96aa029af480d6df4c658e401bf",
      "0x18f768455e7f5fb09fc491fd86bcc282bcdd5973",
      // "0x92f29100cc4dca707359d8eb78402eb3acfd87d3",
      "0xf313e4f2f79081b7dd5e702ca64e86aae3253322",
      "0x50dd57f50a17d57304e7a4f262da30beb31c2e87",
      "0x7a74fb6bd364b9b5ef69605a3d28327da8087aa0",
      "0x82e67fb485b9e29a3cd2e6fdfa789e4220324671",
      "0x1c31e146ca6525dcb100f7faf280cbdac6e19ed2",
      "0xf74b623336ace7b9cf6da1e82a7eb19a4737cbb4",
      "0x7b2fc0feacdf2f59bc26f19839aeb6eee43f4224",
      "0x70c83233c2eb2d5a2334a59eff98a2922bb5abd6",
      // "0xfc23a2b9330570b586353b09969049dff2399ab4",
    ],
    isRejected: false,
  },
  {
    type: "Old DeFI Users",
    addresses: [
      "0x50adf7a75d7cd6132acc0a2fb21c019011286635",
      // "0xba681f15a7bacb49ccf4a6577f2b522869db90d8",
      // "0x7ed6dd8a5add34f4a8926b13b6c6bcb4419b115c",
      "0x2b9324f66b7733202261777726d8f9720285cb8a",
      "0x4e6b41472d13ad84f6990dfec1af282cb04705f8",
      "0x94b171f23236c8bbd61db21ca4af94dbc033d255",
      "0x13838e488e298afc21046cdedc1c3ce4df38cd90",
      "0x800366f5cb71966d5e10fa4ee0222d2395588d2a",
      "0xa98b254d9e2b9e2c11f20780d5e021ef3c45c23d",
      "0x06866f665368dd909330b12d75f866c3311a24eb",
      // "0x253c5cbdd08838dad5493d511e17aa1ac5eab51b",
      "0xba299a1fe0da7b443bf444fdcd0c2a5f2506d2b1",
      // "0x7692ef3dcc4d2ecd497c1a262c50ed22b925a513", // had to remove this one - completely funded by tornado
      // "0x280db0f897b08e2c8d72ca09936a344f9f0fff49",
      "0x65b0d5e1dc0dee0704f53f660aa865c72e986fc7",
      // "0x0b7c43af43d76f79b6f6cfbafb3a01dde0468225",
      "0x9a39996d6ffa124ecc9c3d28a6b0ea59f394592b",
    ],
    isRejected: false,
  },
  {
    type: "Tornado Funded > 50%",
    addresses: [
      "0xf1c9b7faa51468402b70ac2e0b5dde9152cadb50",
      "0x5dc7fa90651906bc99cd0628fa512e4ef24f7f16",
      "0x11497063c7839e341c6ed72947ce92fce52ea686",
      "0xb1dc3f79bf56b9bd78c1d13813a681d390a48728",
      "0x26294b00a982d75827825f7401b23423dbb4c698",
      "0x89cb47a328e3720c295defc36301d4dccd7d4382",
    ],
    isRejected: true,
    reason: "Counterparty exposure to mixer > 50%",
  },
  {
    type: "Tornado Funded < 50%",
    addresses: ["0xffa663addd96b85fe5c369782e8c9279ff32b297"],
    isRejected: false,
  },
];

export const ALL_TEST_ADDRESSES = [
  ...Object.values(NAMED_TEST_ADDRESSES),
  ...BULK_TEST_CASES.flatMap((testCase) => testCase.addresses),
] as const;
