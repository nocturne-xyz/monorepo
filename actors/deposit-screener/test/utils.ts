import * as JSON from "bigint-json-serialization";
import fs from "fs";
import path from "path";
import util from "util";
import { ScreeningDepositRequest } from "../src";
import {
  ApiCallNames,
  ApiCallReturnData,
  MisttrackData,
  TrmData,
} from "../src/screening/checks/apiCalls";

export function toTrmResponse(data: TrmData): Response {
  const res = new Response(JSON.stringify([data]));
  res.headers.set("content-type", "application/json");
  return res;
}

export function toMisttrackResponse(data: MisttrackData): Response {
  const res = new Response(
    JSON.stringify({
      success: true, // Assume the data is valid
      data: data,
    })
  );
  res.headers.set("content-type", "application/json");
  return res;
}

// Address contexts provided in: notion.so/nocturnelabs/Compliance-Provider-Evaluation-9ffe8bbf698f420498eba9e782e93b6d

export const formDepositInfo = (
  spender: string,
  value = 0n
): ScreeningDepositRequest => {
  return {
    spender,
    assetAddr: "",
    value,
  } as const;
};

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

export type CachedAddressData = Partial<
  Record<ApiCallNames, ApiCallReturnData>
>;
export type AddressDataSnapshot = Record<string, CachedAddressData>;

// saves a snapshot to deposit-screener/test/snapshots/{YYYY-M|MM-D|DD}/snapshot.json
export function saveSnapshot(data: AddressDataSnapshot) {
  const date = new Date();
  const folderPath = path.resolve(
    __dirname,
    "./snapshots",
    date.toISOString().substring(0, 10)
  );
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  const filePath = path.join(folderPath, "snapshot.json");
  fs.writeFileSync(filePath, JSON.stringify(data));
}

// returns the latest snapshot folder in deposit-screener/test/snapshots, according to dated folder name, if any exist
export async function getLatestSnapshotFolder(
  baseDir: string
): Promise<string | null> {
  try {
    const readdir = util.promisify(fs.readdir);
    const folderPath = path.resolve(__dirname, baseDir);
    const files = await readdir(folderPath);

    if (files.length === 0) return null;

    const sortedFolders = files.sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    return `${baseDir}/${sortedFolders[0]}`;
  } catch (err) {
    console.error("An error occurred:", err);
    return null;
  }
}

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
    type: "Tornado No Anonymity Mining Top 100 to 300",
    addresses: [
      "0x1ed7f72a25c45df4dc5b9a53af8ad5269a827862",
      "0x2a7b6c20ddcb9411ab2653f6c1fd51127b478e7f",
      "0xbff019ce8090425f57ee927013eb8216cdd5d78c",
      "0xc1b67b6572a2d49c129895f47eaec5995811bd62",
      "0x83533a784f2856972ebe9d2ba64603ed1b51e909",
      "0xd3fa7826a1d69dd3dee4dda574e9e87ca1c3375d",
      "0xd17e73e407cb76f0438c81b66d28adce017ef4f8",
      "0x29bea86db61e875913978773d53fe4f2754797ec",
      "0x699cb98d8f96879783bfa35466fa980a6385756b",
      "0x510db06de3bd264dedaae2a97562ab97830c768e",
      "0x97b2bb85d797add22dabda43eda8570091ed4b03",
      "0x17e4e3e9591998ad988627f3a11b61c459568cee",
      "0x9d08edd56dd306bb53c403c3856a30c67793ad52",
      "0xde8ab79ce01f9ad1f5acb2447cbb771202e75146",
      "0x373704e394ef150241aee836115d78aba3fc5c76",
      "0xd01fa96619f9e220dc69afcd1ab94a49c0a28e52",
      "0xb6af7c04f67b5eb61f0dc7ac4a760888ec3e3887",
      "0xbbde1e05d96c5c4f7e377d5eaed21cac08a92945",
      "0x32a297ca5c1321f4f5c89f2540d76cb7602a08c1",
      "0xef967ece5322c0d7d26dab41778acb55ce5bd58b",
      "0x9a72ef50318388373628792d0c2c0787b873939c",
      "0x41963830c969b8f3b2bab67e79b7d3e019c247ba",
      "0x12efed3512ea7b76f79bcde4a387216c7bce905e",
      "0xcdd3010b519a7328a19496c2c63448e7e6cb1ea4",
      "0x22e832a7cc7c2270b66925386bc18b96ecced2cf",
      "0x769399d9cede28128f926e856d21eb44348cae2f",
      "0x0fbde6f4517f2253155fc03a3a76882dc837ceb0",
      "0x07c83fed13524c46255a0a39d55e5c46c97c7a04",
      "0x0b74c749e8067b0cca0e5faf8b49e62f14bc3a0f",
      "0xf40c8b4ce57dba8fc57ec6f6c846902610ef81cf",
      "0xecb6a3e0e99700b32bb03ba14727d99fe8e538cf",
      "0xb3f09f6d5d1d22579383e56123b7c360f343e255",
      "0x6b5a1cfe4f01f380a9f4773b9f41e58f3d42519f",
      "0x9ad084fb5e38eba8031b6b1cd1ecc06fc03f5903",
      "0xb18f7fc7d419e034ff8592c33db579171560ea93",
      "0x50a9d9556a43f326552c079895bd11c242f2ec45",
      "0x4a5b26505001d28c1e514214fb077cb23130defc",
      "0xb2a8b37b1fc3fc0c41ec7d72adcfd47bf85f34c0",
      "0x8558f502887a9a52c4b265d72327e0e529ff790d",
      "0xa624ffd7f011b20a9df51c6d2dddb51c52a20e75",
      "0x8d520068bb6568adca50fcfbbef5c27a1d8b3125",
      "0xdb84778393a0b056f8de111eb1a9a8600ef1c72f",
      "0x86df2908f9bd3a122f014ce008754b3136eaa688",
      "0x63493e679155c2f0aad5bf96d65725ad6427fac4",
      "0x9313c9fbdb6d3883a4cb59b2c9ad07d8c0764f26",
      "0x8ec65f1e57cfc2d8ffa9ebe7d5f8aba2c5d1b3b1",
      "0x56b42dce0acc1dae9c4010fe2c9f1802ec51924b",
      "0xbad1990c2967231bc9a4fa9562ea68e65dd2b25d",
      "0x5de4ca716bc806c79286ee0bab92a585da214043",
      "0xc1156386bdc8d0e232b295ee9cbd3650d38dea3d",
      "0xf573d864e5cc10f0351a1ac2c058ba5fe1b9fca2",
      "0x118203b0f2a3ef9e749d871c8fef5e5e55ef5c91",
      "0xec0f41378d58f42552eeb6293105e0ce0c1de0ba",
      "0xa74221f22d1fa8753a8f999deec5da8f10f0ad60",
      "0xdc9659796884c43bf0cba78fc9f27ab07510f865",
      "0xba2258096034783747c1c62881ae09e4f318099c",
      "0xf7ce4cbc824572a03cf2183574982c3356656a76",
      "0x3af7fa91f0b2b2d148622831e3a21c165c8c8e49",
      "0x7b5a8cbc77876421f1dcfb22ae2a1c404d7b71cb",
      "0x8fec7ab376c3bf5eba388753007ad2a4b048e75d",
      "0xc598ab19bd79c01fb4c106c755f3dc4e7be7dd29",
      "0x3af4fe8eb4d8aff7c97d8fb213309a9c2717ad61",
      "0xe0e484dfa7f3aa36733a915d6f07eb5a57a74a11",
      "0xada6f0b1b3a4bd9e1a9c672fec9428f38844cdf7",
      "0x2b217eaa3dd4fddf03372a8d7834afafc2bc6835",
      "0x530defd6c816809f54f6cfa6fe873646f6ecf930",
      "0x933258bddd49beeca77f6d1889633c5429af45ea",
      "0xdb739ac8be26c5f75ba5f259378fa2d63a8bc358",
      "0x40453aa65e4f64903c955af8d4f7f345cc9009b8",
      "0x924cd613428f170e34491b86e7f8b3560efcfe16",
      "0x75cb34491e7d5f61f31e7076ba61fa81259e3f36",
      "0xeb6955cf773de10da86ff7d78af91c163818b8d2",
      "0x19c812dfc372d5e7de62baff9d7af690ca748c3b",
      "0x82e67fb485b9e29a3cd2e6fdfa789e4220324671",
      "0x4b08c49790b5d354b10afe30fb45ff463b495769",
      "0x6160599e4bbf2ce09dd9853599653ea8e8e8238d",
      "0x67b5d9eef02c359c20501e0602df665c88147f8a",
      "0xa591971b64e8718de38d140013bd7b5bb62f42d8",
      "0xc3eaf129005d68183335232ec3d95933c0d7b605",
      "0xa3143587d89410cc59fa2507b2e3e64c9f36c11d",
      "0x846efc4ed95bc999824a46ab74f8f197508bae30",
      "0x933ada992ba8219180076294bd55247124df758e",
      "0x841550486b3cc3f57e58904d707d8dfcd4f14ab7",
      "0xdf9f0d6b501d97e0b503bd64f77f20c246ddd46d",
      "0x04f4606a04c75a390ca17d7de5194486c856c04a",
      "0x9823f36c34dba0a9d88215f8eb7e6618162ffbb8",
      "0xcefd07b9cf875152708bae6344f8a256f83c88d2",
      "0x05a7034af75e5ae0c59d979c401d756698d05809",
      "0xa2025c136089fc08854bdcdd4fd8fde4277a9027",
      "0x0716b258570fb712a02adf56a7382ed562d4fd37",
      "0x70a9677fa840d27c5c764f6f30d26ae556ea7aed",
      "0x5830690cc3c6b1b4a76ce12a115f2c491bee51a4",
      "0x1c0c694189d9c6390ea99eb7b5c9b6c983cf00f7",
      "0x3b8f5a87ae8139f489058bebfa5790d88b73802d",
      "0xbd82b6edb7824e0365b0257b75e7967e6f227564",
      "0xbeb12dbe1998b2dad174954a0145129ed053d46d",
      "0xed52ef592af955be92b34055a45ca840850b2445",
      "0xd5cb8c3f349b50699049018a897cd34c19608fbb",
      "0xfe23fc1f735003271ab97eb3494397a2b7afc0fd",
      "0x813d8e93dbbf493c26d470c6e0c9a2cdf97f6335",
      "0x05547d4e1a2191b91510ea7fa8555a2788c70030",
      "0x594c6ed60fa2471de8757b34b116d68b68824017",
      "0x88b336136e006a894816f2a84f4f0b30fc2ee59f",
      "0xd7b3b50977a5947774bfc46b760c0871e4018e97",
      "0x718fdf375e1930ba386852e35f5bafc31df3ae66",
      "0x4b1a187d7e6d8f2eb3ac46961db3468fb824e991",
      "0xa57ae59690c49c6f36e4ac0c9cf2654a371d0e78",
      "0x510d94465e889a2f1855cda2c1d9691624e4cfd2",
      "0x978aad63fe35f7a72573c411c3dff53608aaeac9",
      "0xe58d35add7e19702a067355fda4e6a241ab0dc19",
      "0xb50bf62a92d54d5847355d4044b62e95ebf53e9b",
      "0x96cb2f6cdf6f301e59724092d03ad119782c093d",
      "0xbbe4ebd8e7b05f436b04cd4352459a275602cd62",
      "0xa30a1ecbe0234f6c11c28ae5b39a88ff6ebcc4a7",
      "0x1dd71645847ba3a22df1261ad32d66d9a701552d",
      "0x39e79b7462830da1eb81802663efffa35d0f2244",
      "0xfe30619d230d5dd48635be5e3c4ddb24caa5595a",
      "0x7036773bab099bad29611f1ca479ded4a071d6cb",
      "0xef45e3d772a3e7d0b6127b17c5e14ed13bf3a000",
      "0xb88de44e7895b241c4d57122ad4893f01ecb8976",
      "0xbe85f2dbb6503b9207b1d3adba0699ecdc869548",
      "0x4145b8a9b596981cafe78c20bf7a18466686a88d",
      "0x5665ea7015e71fb615fe925d89ec3a083a265617",
      "0x376346cc9f76b5e7e261b8c971a8d65052f7b281",
      "0xb62b4c95c247b27d7df35c6bd63c9ddce7734784",
      "0x222ee4966563ebc070744509fd7ce434e1043f0e",
      "0x96b4a2528a6865cdaa33fda8aa1bbd87e1f27eb3",
      "0xb9e86b5e69576b2a2a1552261d4b74410e80c389",
      "0xa7cc7c1522f529320776d27d9340f534d3a73b7f",
      "0xc99e76d1e4112bfc1ba6f85f153ce4596014fbfd",
      "0xcf9bf539af5e40e536286fe2e8cba390c6c14044",
      "0x70391bcf73933c40075ad5289c018fb615c36473",
      "0x1772a19c8f152dd1f81df4eac9fa4f8e489a2e50",
      "0xd89950082aeea391214a95668e51f131529795b0",
      "0x94b171f23236c8bbd61db21ca4af94dbc033d255",
      "0x9174a36a49c2ba4abcecf1b0886bfe415c98db65",
      "0x8f76ea096b8efca1a5c1c724f7d81ad2ecb47f69",
      "0xaee146b0442e718d00dfe3bebb5bf0b91a11cbac",
      "0xba650840835ad316455df1332a742eb7570199ef",
      "0x5ef360540799e464859f8441102055affe3cc3c0",
      "0xdee2ed06e73bfb330109d68fa81bae2faf6f793e",
      "0x453f3099322081f863abcc71863551e0f9feaff1",
      "0xae98eea3fc88141b3ad0252aca1695a1e7578479",
      "0xf92c5de2c43d8b2f5fbe5b145307f01659e34101",
      "0xf22d4c7ca1244b83cc06d7b445294d04fc51c7f1",
      "0x4a12eeb99fe2a6944adaa9c32ccced01342b1711",
      "0x1b8623de0a439e7c220d054969951f2b7211851f",
      "0x1a6bbeacb9eb39701d9c08f0a48b1c89ffc8ab0e",
      "0x815c9f2a40dc8233ad9a6058bb819bf9f2220304",
      "0xf74b623336ace7b9cf6da1e82a7eb19a4737cbb4",
      "0x3e1596a814d70f4e63f7f1487c5807a6bb04b967",
      "0x3113ab5c691ecdac25c07bbf2bf80eb005e4088c",
      "0x7b2fc0feacdf2f59bc26f19839aeb6eee43f4224",
      "0x70c83233c2eb2d5a2334a59eff98a2922bb5abd6",
      "0x9c089a843d777c650a7a79d55c5e4bdf95941565",
      "0x311caea34107c72dbe1aa5a0405f11a10ee6965d",
      "0x9a39996d6ffa124ecc9c3d28a6b0ea59f394592b",
      "0xa64049f525063e31d7ea1de3a7e2bcdfa5662d5a",
      "0xdc887d29f1d662c31472b9c0fafb0aa30672bb22",
      "0x61fef96e49f352fbac4645b0f5aefc0f40d80695",
      "0x8d775d8a6cdcc6318e1771bf9d6881ebca2a88d0",
      "0xdff6135cfa21f0a5b6c7bd95a98210f1d168456d",
      "0xd44734bcb15d435aace6b49e03aa75031b59c51d",
      "0x6749592f169d9e1b56dcd6e70b0f0c120e586525",
      "0x59a1b7aae77d54a80c3b2e9e000e8e481c3837ac",
      "0x0000000000d1921aa255cc20daec11a22b7e894d",
      "0x2cd28139abdc9e91f8fe7c1b4a49fc41555a5607",
      "0x6ea72d536c8842646daa95d14a2fd622c258b610",
      "0x6753b4aa810eb184c830459d5b46f50fa9fdcced",
      "0x94fc1e155c29c05613b4cafd0fda597c2d4021d9",
      "0x2d4011f9de3ff504edb2b58dc7e10d8cded346a9",
      "0x86f6ff8479c69e0cdea641796b0d3bb1d40761db",
      "0xb79157bca1635f4731df5828f2a28a0cbfc799ce",
      "0x10369349a683578d1dfd4195eb41c6450fba0e2c",
      "0x0dbd217abdd521e73c4c0942ffc85c0bbe830fcd",
      "0x72b62f6f66fe33fa140f46678194c0cca1e61cc4",
      "0x6f6330bd290727c9323aaf8148b6cff78697a008",
      "0x5ce4202cb47469fc958f035f592f88dc89bedbcf",
      "0x0007d40f29c7a1713b251c69f5d999f16ec09dfc",
      "0xb15be4bee361a9bd318f9a02356ffceff021701e",
      "0x8f475b04e7c48fa8e66e45e52b01f2783c90adc5",
      "0x61015cb3991bb71ace0c88c4c1eb1cbe36a22ca1",
      "0x779cca1c713fd321b7f2a2897d0a50dae3cc52dd",
      "0x1dd7f3cfaa39a4c32f758f2c1e19001e876a5575",
      "0x95c31ac4d2fb2a103689d5c51d3209099a43745a",
      "0xcdc0f019f0ec0a903ca689e2bced3996efc53939",
      "0xb0b1972ab32b2f28257787afcf025236b8a08ea0",
      "0xe35a136a44eff549bedde6a3b9ca6c3ed14bd0b0",
      "0x23289cc0d89f171dc05ca3c40808546b721c6c93",
      "0x694022bd3beb56711662e2b3aa5af3dc20b47818",
      "0xec6aed0666cd79df723134c1caeb80205790e234",
      "0xf4460c07206b5c4d1b8581eae93e75185eb44b68",
      "0xdf025dff5d79a8c5aec7859e0ecb3ca81e4823a0",
      "0x99eb1b78c8ac7f8e96e611fea95a7661e408890a",
      "0x315380ebc2035e2eaef74c642bb850835ee535bd",
      "0x3182158ba73b484db0d8f3ba961701977b21ce32",
      "0x8e590208abc1892e33caaa378c035d02369d0fb6",
      "0xbab68c5d61bbcbc45bdae221385e95586ed53244",
    ],
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
