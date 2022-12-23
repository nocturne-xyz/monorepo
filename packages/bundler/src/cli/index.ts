import { program } from "commander";
import run from "./commands/run";

export async function main() {
  program
    .name("bundler-cli")
    .description("CLI for running/debugging bundler components")
    .addCommand(run);
  await program.parseAsync(process.argv);
}

(async () => {
  await main();
})();
