import { RequestRouter } from "./router";
import express from "express";

export class BundlerServer {
  router: RequestRouter;

  constructor() {
    this.router = new RequestRouter();
  }

  async startServer(): Promise<void> {
    const router = express.Router();
    router.post("/relay", this.router.handleRelay);
    router.get("/operations/:id", this.router.handleGetOperationStatus);

    const app = express();
    app.use(express.json());
    app.use(router);
  }
}
