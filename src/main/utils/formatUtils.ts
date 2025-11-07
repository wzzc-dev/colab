import { BIOME_BINARY_PATH } from "../consts/paths";
import { spawnSync } from "child_process";

export const formatFile = (path: string) => {
  if (BIOME_BINARY_PATH) {
    const result = spawnSync(BIOME_BINARY_PATH, [
      "check",
      path,
      // todo (yoav): make this a configuration option from the
      // status bar (--apply) just applies fixes (--apply-unsafe)
      // also applies import sorting
      "--apply-unsafe",
    ]);

    if (result.stdout && result.stdout.length > 0) {
      console.log(result.stdout.toString().trim());
    }
  }
};
