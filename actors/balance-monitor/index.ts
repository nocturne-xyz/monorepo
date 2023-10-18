import { BalanceMonitor } from "./src";
import * as dotenv from "dotenv";

(async () => {
  dotenv.config();
  const balanceMonitor = new BalanceMonitor();
  await balanceMonitor.start();
  process.exit(0);
})();
