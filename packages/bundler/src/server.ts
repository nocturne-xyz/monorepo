import { BundlerRouter } from "./router";
import express from "express";
import * as os from "os";

export class BundlerServer {
  router: BundlerRouter;

  constructor(walletAddress: string) {
    this.router = new BundlerRouter(walletAddress);
  }

  async run(port: number): Promise<void> {
    const router = express.Router();
    router.post("/relay", this.router.handleRelay);
    router.get("/operations/:id", this.router.handleGetOperationStatus);

    const app = express();
    app.use(express.json());
    app.use(router);

    app.listen(port, () => {
      console.log(`Bundler server listening at ${os.hostname()}:${port}`);
    });
  }
}
