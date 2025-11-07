import {
  spawnSync,
  type SpawnSyncOptionsWithBufferEncoding,
} from "child_process";
import { BUN_PATH } from "../consts/paths";

// An execSync-like wrapper around spawnSync in the ~/.colab/.bun/ folder as cwd
export const execSpawnSync = (
  command: string,
  args: string[] = [],
  opts: SpawnSyncOptionsWithBufferEncoding = {}
) => {
  // todo (yoav): do something with result? do we even need this util?
  const result = spawnSync(command, args, {
    cwd: BUN_PATH,
    ...opts,
  });

  if (result.error) {
    console.error(`error running ${command}`, result.error);
  }

  if (result.stderr && result.stderr.length > 0) {
    console.error("stderr: ", result.stderr.toString());
  }

  if (result.stdout && result.stdout.length > 0) {
    return result.stdout.toString().trim();
  } else {
    console.log("No output");
    return "";
  }
};
