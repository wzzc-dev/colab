import { existsSync } from "fs";
import { execSpawnSync } from "../utils/processUtils";
import { BUN_BINARY_PATH } from "../consts/paths";

export const isInstalled = () => {
  return existsSync(BUN_BINARY_PATH);
};

let _version: string = "";
export const getVersion = (forceRefetch = false) => {
  const versionResult = execSpawnSync(BUN_BINARY_PATH, ["--version"]) || "";
  return versionResult;
};

export const install = () => {
  if (isInstalled()) {
    return;
  }

  // Since we're using electrobun we have bun bundled
  console.log("bun not bundled correctly");
};
