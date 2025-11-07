import { join, dirname } from "path";
import {
  rmdirSync,
  statSync,
  unlinkSync,
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import {
  type CachedFileType,
  type PreviewFileTreeType,
} from "../../shared/types/types";
import { isPathSafe } from "../../shared/utils/files";
import { Utils } from "electrobun/bun";
import { BUN_BINARY_PATH, COLAB_ENV_PATH } from "../consts/paths";
import { spawn } from "child_process";
import path from "path";
import type { Subprocess } from "bun";

// helps prevent rmDirSync/unlink from being called on the system root or other important directories
export const safeTrashFileOrFolder = (absolutePath: string) => {
  if (isPathSafe(absolutePath)) {
    // Note: this puts things in the recycle bin, but without
    // the "put back" functionality
    // todo (yoav): maybe we can implement undo delete in colab

    Utils.moveToTrash(absolutePath);
  }
};

// helps prevent rmDirSync/unlink from being called on the system root or other important directories
export const safeDeleteFileOrFolder = (absolutePath: string) => {
  if (isPathSafe(absolutePath)) {
    const info = statSync(absolutePath);
    if (info.isDirectory()) {
      rmdirSync(absolutePath, { recursive: true });
    } else if (info.isFile()) {
      unlinkSync(absolutePath);
    }
  }
};

export const getUniqueNewName = (parentPath: string, baseName: string) => {
  let modifier = 1;
  let uniqueName = baseName;
  while (existsSync(join(parentPath, uniqueName))) {
    uniqueName = `${modifier.toString(36)}-${baseName}`;
    modifier++;
  }

  return uniqueName;
};

// Note: this can be used to read and cache any slate config file .colab.json, package.json, etc.
// currently only supports json files
export const readSlateConfigFile = (path: string, cacheResult = true) => {
  try {
    if (existsSync(path)) {
      if (!statSync(path)?.isFile()) {
        throw new Error(
          `Must give a file path (eg: to .colab.json), path given: ${path}`
        );
      }

      const slateJson = readFileSync(path, "utf-8");
      const slate = JSON.parse(slateJson);
      // NOTE: We want to update the cache whether it successfully reads or not
      // that way the user can see immediately if there's a problem with the config
      if (cacheResult) {
        // XXX send to windows
        // setState("slateCache", path, slate);
      }
      // todo (yoav): [blocking] add versioning and migration flow here
      return slate;
    }
  } catch (err) {
    // todo (yoav): report this error to the user
    console.error(err);
  }

  return null;
};

export const createDevlinkFiles = (
  nodePath: string,
  accessToken: string,
  siteId: string
) => {
  const rootFolder = nodePath;
  [
    {
      relPath: "/.webflowrc.json",
      contents: `{
    "host": "https://api.webflow.com",
    "rootDir": "./components",
    "siteId": "${siteId}",
    "authToken": "${accessToken}",
    "cssModules": true,
    "allowTelemetry": false
}
`,
    },
    {
      relPath: "/package.json",
      contents: `{
    "name": "design-system",
    "version": "1.0.0",
    "description": "",
    "main": "index.js",
    "scripts": {
        "sync": "webflow devlink sync"
    },
    "author": "",
    "license": "ISC",
    "dependencies": {
        "@webflow/webflow-cli": "^1.1.1"
    }
}
`,
    },
    // TODO: install rest of package.json and devlink files
  ].forEach(({ relPath, contents }) => {
    const folder = relPath.split("/")[0];
    const absoluteFolder = join(rootFolder, folder);

    if (folder && !existsSync(absoluteFolder)) {
      mkdirSync(absoluteFolder, { recursive: true });
    }

    const absoluteFilePath = join(rootFolder, relPath);
    writeFileSync(absoluteFilePath, contents, {});
  });

  // todo: use more generic terminal thing that's tied to process ids and sends
  // updates.
  setTimeout(async () => {
    const cmd = BUN_BINARY_PATH;

    if (!cmd) {
      throw new Error("Must set BUN_BINARY_PATH in state.paths");
    }

    // todo (yoav): implement terminal async process pool
    // Note: --no-save prevents bun install from creating a lockfile. revisit this decision
    let process = spawn(cmd, ["install", "--no-save"], {
      cwd: rootFolder,
      env: { PATH: COLAB_ENV_PATH },
    });

    process.stdout.on("data", (data) => {
      console.log("out", data.toString());
      // todo (yoav): do more processing here, like colorizing
      console.log(data.toString());
    });
    process.stderr.on("data", (data) => {
      console.log("err", data.toString());
      // todo (yoav): do more processing here, like colorizing
      console.log(data.toString());
    });

    process.addListener("error", (err) => {
      console.log("error", err);
    });

    process.on("exit", (code) => {
      process = spawn(cmd, ["run", "--bun", "sync"], {
        cwd: rootFolder,
        env: { PATH: COLAB_ENV_PATH },
      });
      process.stdout.on("data", (data) => {
        console.log("out", data.toString());
        // todo (yoav): do more processing here, like colorizing
        console.log(data.toString());
      });
      process.stderr.on("data", (data) => {
        console.log("err", data.toString());
        // todo (yoav): do more processing here, like colorizing
        console.log(data.toString());
      });

      process.addListener("error", (err) => {
        console.log("error", err);
      });
    });
  });
};

export const syncDevlink = (nodePath: string) => {
  const cwd = nodePath;
  // todo (yoav): maybe a status bar system with ids so we can show running jobs
  // in the status bar, and open up their terminal windows from there if you want?
  // or the sidebar or anywhere else.
  // for now just run it sync and show a tiny indicator
  const cmd = BUN_BINARY_PATH;
  const args = ["run", "--bun", "sync"];
  const process = spawn(cmd, args, {
    cwd,
    env: { PATH: COLAB_ENV_PATH },
  });

  process.stdout.on("data", (data) => {
    console.log("out", data.toString());
    // todo (yoav): do more processing here, like colorizing
    console.log(data.toString());
  });
  process.stderr.on("data", (data) => {
    console.log("err", data.toString());
    // todo (yoav): do more processing here, like colorizing
    console.log(data.toString());
  });

  process.addListener("error", (err) => {
    console.log("error", err);
  });

  process.addListener("exit", (code, signal) => {
    console.log("exit", code, signal);
    // setDevlinkSyncing(false);
  });
};

type FindAllInFolderResult = {
  path: string;
  line: number;
  column: number;
  match: string;
};

export function findAllInFolder(
  path: string,
  query: string = "",
  onResult: (result: FindAllInFolderResult) => void
): Subprocess {
  // console.log("searching1");

  // todo:
  // -i - ignore case in matches (should be toggle from UI)
  // macos grep doesn't support column results
  // replace with ripgrep or something else
  const findAllProcess = Bun.spawn(
    [
      "grep",
      "-rIn",
      // "--column",
      "--exclude-dir=node_modules",
      "--exclude-dir=.git",
      "--exclude-dir=build",
      query,
      path,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  function processLine(line: string) {
    const parts = line.split(":");
    if (parts.length >= 3) {
      const path = parts[0];
      const line = parseInt(parts[1], 10);
      const match = parts.slice(2).join(":"); // Handles matches containing ":"

      onResult({ path, line, column: 0, match });
      // console.log({ file, line: lineNumber, match });
    } else {
      // console.log("Invalid line format:", line);
    }
  }

  // Buffer for accumulating chunks of data
  let stdoutBuffer = "";

  // Listen for data events from stdout
  const reader = findAllProcess.stdout.getReader();

  async function readStream() {
    const { done, value } = await reader.read();

    // Convert the chunk to a string and accumulate it in the buffer
    stdoutBuffer += new TextDecoder().decode(value);

    // Split the buffer by newlines to process full lines
    const lines = stdoutBuffer.split("\n");

    // Process all complete lines, keep incomplete one in the buffer
    for (let i = 0; i < lines.length - 1; i++) {
      processLine(lines[i]);
    }

    // Keep the last incomplete line in the buffer
    stdoutBuffer = lines[lines.length - 1];

    // recurse
    if (!done) {
      readStream();
    }
  }

  readStream();

  return findAllProcess;
}

export function findFilesInFolder(
  path: string,
  query: string = "",
  onResult: (result: string) => void
): Subprocess {
  // console.log("searching2", query, path);

  // todo:
  // find /path/to/your/folder -type f -name "*match_string*" -not -path "/path/to/your/folder/folder1/*" -not -path "/path/to/your/folder/folder2/*"

  const findAllProcess = Bun.spawn(
    [
      "find",
      path,
      // "-type f",
      "-type",
      "f",

      "-not",
      "-path",
      "*/.git/*",

      "-not",
      "-path",
      "*/node_modules/*",

      "-not",
      "-path",
      "*/build/*",
      // `-not -path "node_modules"`,
      // "--exclude-dir=.git",
      // "--exclude-dir=build",
      // `-name "${query}"`,
      // "-name",
      "-iregex",
      `.*${query.split("").join(".*")}.*`,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  function processLine(line: string) {
    console.log("line", line);
    // const parts = line.split(":");
    if (line.length >= 1) {
      // const path = parts[0];
      // const line = parseInt(parts[1], 10);
      // const match = parts.slice(2).join(":"); // Handles matches containing ":"

      onResult(line);
      // console.log({ file, line: lineNumber, match });
    } else {
      // console.log("Invalid line format:", line);
    }
  }

  // Buffer for accumulating chunks of data
  let stdoutBuffer = "";

  // Listen for data events from stdout
  const reader = findAllProcess.stdout.getReader();

  async function readStream() {
    const { done, value } = await reader.read();

    // Convert the chunk to a string and accumulate it in the buffer
    stdoutBuffer += new TextDecoder().decode(value);
    // Split the buffer by newlines to process full lines
    const lines = stdoutBuffer.split("\n");

    // Process all complete lines, keep incomplete one in the buffer
    for (let i = 0; i < lines.length - 1; i++) {
      processLine(lines[i]);
    }

    // Keep the last incomplete line in the buffer
    stdoutBuffer = lines[lines.length - 1];

    // recurse
    if (!done) {
      readStream();
    }
  }

  readStream();

  return findAllProcess;
}
