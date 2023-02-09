import Dockerode from "dockerode";
import { sleep } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";

const ROOT_DIR = findWorkspaceRoot()!;

const BUNDLER_IMAGE = "bundler";
