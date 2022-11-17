// // import { FlaxDB } from ".";

// export const DEFAULT_SNAP_ORIGIN =
//   process.env.REACT_APP_SNAP_ORIGIN ?? `local:http://localhost:8080`; // TODO: leave here?

// export class SnapDB {
//   async getKv(key: string): Promise<string | undefined> {
//     return (await window.ethereum.request({
//       method: "wallet_invokeSnap",
//       params: [
//         DEFAULT_SNAP_ORIGIN,
//         {
//           method: "flax_getKv",
//         },
//       ],
//     })) as string;
//   }

//   async putKv(key: string, value: string): Promise<boolean> {
//     await window.ethereum.request({
//       method: "wallet_invokeSnap",
//       params: [
//         DEFAULT_SNAP_ORIGIN,
//         {
//           method: "flax_putKv",
//           params: {
//             key,
//             value,
//           },
//         },
//       ],
//     });

//     return true;
//   }
// }
