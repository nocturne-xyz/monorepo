import { BundlerRouter } from "./router";
import IORedis from "ioredis";
import express, { Request, Response } from "express";
import * as os from "os";
import { ethers } from "ethers";
import { Server } from "http";
import cors from "cors";

export class BundlerServer {
  router: BundlerRouter;

  constructor(
    walletAddress: string,
    redis?: IORedis,
    provider?: ethers.providers.Provider
  ) {
    this.router = new BundlerRouter(walletAddress, redis, provider);
  }

  run(port: number): Server {
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
    app.use(cors());

    return app.listen(port, () => {
      console.log(`Bundler server listening at ${os.hostname()}:${port}`);
    });
  }
}
