import { BundlerRouter } from "./router";
import IORedis from "ioredis";
import express, { Request, Response } from "express";
import * as os from "os";

export class BundlerServer {
  router: BundlerRouter;

  constructor(walletAddress: string, redis?: IORedis) {
    this.router = new BundlerRouter(walletAddress, redis);
  }

  async run(port: number): Promise<void> {
    const router = express.Router();
    router.post("/relay", async (req: Request, res: Response) => {
      await this.router.handleRelay(req, res);
    });
    router.get("/operations/:id", async (req: Request, res: Response) => {
      await this.router.handleGetOperationStatus(req, res);
    });

    const app = express();
    app.use(express.json());
    app.use(router);

    app.listen(port, () => {
      console.log(`Bundler server listening at ${os.hostname()}:${port}`);
    });
  }
}
