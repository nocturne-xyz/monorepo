import { program } from "commander";
import { SubtreeUpdateServer } from "./src/server";

program
  .requiredOption("--zkey <string>", "path to the subtree update circuit's proving key")
  .requiredOption("--vkey <string>", "path to the subtree update circuit's verifying key")
  .requiredOption("--prover <string>", "path to the rapidsnark prover executable")
  .requiredOption("--witnessGenerator <string>", "path to the subtree update circuit's witness generator executable")
  .option("--tmpDir <string>", "path to a dirctory to use for rapidsnark intermediate files", "./prover-tmp");

program.parse();

const { zkey, vkey, prover, witnessGenreator, tmpDir } = program.opts();

const server = new SubtreeUpdateServer(zkey, vkey, prover, witnessGenreator, tmpDir);
server.start();
