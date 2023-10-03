import * as dotenv from "dotenv";
import * as fs from "fs";
import { NocturneDeploymentVerification } from "../src/verification";

const VERIFICATIONS_DIR = `${__dirname}/../verifications/`;

dotenv.config();

(async () => {
  if (process.argv.length < 3) {
    throw new Error("Missing verification name");
  }
  const verificationName = process.argv[2];

  const configString = fs.readFileSync(
    `${VERIFICATIONS_DIR}/${verificationName}.json`,
    "utf-8"
  );

  const verificationData = JSON.parse(configString);
  console.log(verificationData);

  const nocturneDeploymentVerification = new NocturneDeploymentVerification(
    verificationData
  );

  await nocturneDeploymentVerification.verify();

  console.log(`Verification complete for ${verificationName}.`);

  process.exit(0);
})();
