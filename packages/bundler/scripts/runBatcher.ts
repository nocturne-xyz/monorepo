import { BundlerBatcher } from "../src/batcher";
import * as dotenv from "dotenv";

(async () => {
  dotenv.config();
  const batcher = new BundlerBatcher(30, 8);
  await batcher.run();
})();
