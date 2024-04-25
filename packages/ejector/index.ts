import { setup } from "./src/index";

async function main() {
  await setup();
}

process.on('SIGINT', () => {
  process.exit(1); // Exit with success status
});


main().catch((err) => {
  console.error(err);
  process.exit(1);
});