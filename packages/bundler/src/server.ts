import { BundlerRouter } from "./router";
import IORedis from "ioredis";
import express, { Request, Response } from "express";
import * as os from "os";
import { ethers } from "ethers";
import cors from "cors";

export class BundlerServer {
  router: BundlerRouter;

  constructor(
    walletAddress: string,
    provider: ethers.providers.Provider,
    redis: IORedis,
    ignoreGas?: boolean
  ) {
    this.router = new BundlerRouter(walletAddress, provider, redis, ignoreGas);
  }

  start(port: number): () => Promise<void> {
    const router = express.Router();
    router.post("/relay", async (req: Request, res: Response) => {
      await this.router.handleRelay(req, res);
    });
    router.get("/operations/:id", async (req: Request, res: Response) => {
      await this.router.handleGetOperationStatus(req, res);
    });

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(router);

    const server = app.listen(port, () => {
      console.log(`Bundler server listening at ${os.hostname()}:${port}`);
    });

    return () =>
      new Promise((resolve) => {
        console.log("[BUNDLER_SERVER TEARDOWN] server.close()...")
        server.close(() => {
          console.log("[BUNDLER_SERVER TEARDOWN] resolve...")
          resolve();
        });
      });
  }
}
