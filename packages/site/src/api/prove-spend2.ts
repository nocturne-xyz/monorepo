import { localSpend2Prover } from "@nocturne-xyz/local-prover";
import { GatsbyFunctionRequest, GatsbyFunctionResponse } from "gatsby";

export default async function handler(
  req: GatsbyFunctionRequest,
  res: GatsbyFunctionResponse
) {
  console.log("[prove-spend2] request body: ", req.body);
  const proof = await localSpend2Prover.prove(req.body);
  res.status(200).json(proof);
}
