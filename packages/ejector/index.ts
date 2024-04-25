import { setup } from "./src/index";

async function main() {
  await setup();
}

process.on('SIGINT', () => {
  process.exit(1); 
});


main().catch((err) => {
  console.error(err);
  process.exit(1);
});