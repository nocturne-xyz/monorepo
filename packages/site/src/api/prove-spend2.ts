import { LocalSpend2Prover } from "@flax/local-prover";
import { GatsbyFunctionRequest, GatsbyFunctionResponse } from "gatsby";

const Prover = new LocalSpend2Prover();
export default async function handler(
  req: GatsbyFunctionRequest,
  res: GatsbyFunctionResponse
) {
  console.log("[prove-spend2] request body: ", req.body);
  const proof = await Prover.proveSpend2(req.body);
  res.status(200).json(proof);
}
