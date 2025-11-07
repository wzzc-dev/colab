// import { render } from "solid-js/web";
import { produce } from "solid-js/store";
import { dirname, basename } from "../../utils/pathUtils";
import { getProjectForNodePath } from "../files";
import { electrobun } from "../init";
import {
  state,
  setState,
  openNewTabForNode,
  getWindow,
  focusTabWithId,
  openFileAt,
} from "../store";
import { For, type JSX, Show, createEffect, createSignal } from "solid-js";

export const TopBar = () => {
  const onClickToggleSidebar = () => {
    const showSidebar = !state.ui.showSidebar;
    // isResizingPane will cause active webviews to go into mirroring mode
    setState("isResizingPane", true);
    // give it a second to start before toggling the ui so the animation is smoother
    setTimeout(() => {
      setState("ui", "showSidebar", showSidebar);
    }, 200);
    // then after the animation is complete turn off mirroring mode
    setTimeout(() => {
      setState("isResizingPane", false);
    }, 800);
  };

  // const onClickToggleTabs = () => {};

  const globalSettingsClick = () => {
    setState("settingsPane", {
      type:
        state.settingsPane.type === "global-settings" ? "" : "global-settings",
      data: {},
    });
  };

  const workspaceSettingsClick = () => {
    setState("settingsPane", {
      type:
        state.settingsPane.type === "workspace-settings"
          ? ""
          : "workspace-settings",
      data: {},
    });
  };


  const openNewWindow = () => {
    electrobun.rpc?.send.createWindow();
  };

  const openNewWorkspace = () => {
    electrobun.rpc?.send.createWorkspace();
  };

  const openXtermDemo = () => {
    electrobun.rpc?.send.createXtermDemoWindow();
  };

  // todo (yoav): make this a util that follows the currentTabPath
  return (
    <div
      style={{
        height: "40px",
        width: "100%",
        background: "#222",
        display: "flex",
      }}
    >
      <div
        style={{
          "margin-left": "80px",
          width: "24px",
          height: "24px",
          background: "#333",
          color: "#888",
          "border-radius": "4px",
          "text-align": "center",
          "vertical-align": "middle",
          "line-height": "24px",
          "margin-top": "7px",
          cursor: "pointer",
          "-webkit-user-select": "none",
          border: "1px solid #1f1f1f",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
        }}
        onClick={onClickToggleSidebar}
      >
        <img
          width="16px"
          height="16px"
          src={`views://assets/file-icons/sidebar-left${
            state.ui.showSidebar ? "-filled" : ""
          }.svg`}
        />
      </div>

      <div
        class="electrobun-webkit-app-region-drag"
        style="flex-grow:1; height: 100%; cursor: move; "
      ></div>

      {/* todo (yoav): I don't love this api but I can clean it up later */}

      <WorkspaceMenu>
        <li onClick={openNewWindow}>New Window</li>
        <li
          onClick={() => {
            electrobun.rpc?.send.hideWorkspace();
          }}
        >
          Hide Workspace
        </li>
        <div style="width: 100%; margin: 5px 0; border-bottom: 1px inset black"></div>
        <li onClick={workspaceSettingsClick}>Workspace Settings</li>
        <li onClick={globalSettingsClick}>Colab Settings</li>
        <div style="width: 100%; margin: 5px 0; border-bottom: 1px inset black"></div>
        <li onClick={openNewWorkspace}>New Workspace</li>
        <div style="width: 100%; margin: 5px 0; border-bottom: 1px inset black"></div>
        <li onClick={openXtermDemo}>XTerm.js Demo Window</li>
        <div style="width: 100%; margin: 5px 0; border-bottom: 1px inset black"></div>
      </WorkspaceMenu>
      <Update />
      <AppMenu />
      <CommandPalette />
    </div>
  );
};

const CommandPalette = () => {
  // const [open, setOpen] = createSignal(false);

  const setOpen = (value = !state.ui.showCommandPalette) => {
    setState("ui", "showCommandPalette", value);
  };

  const open = () => {
    return state.ui.showCommandPalette;
  };

  // todo:
  // 3. add a way to open the file in the current pane
  // 4. add a section for open tabs that focuses the tab when clicked
  // 5. add search functionality

  // decide if we can ship before continuing
  // 2. move the workspace menu into the command palette
  // 1. move state to store so it can be opened and modified globally
  // 2. add selection mechanism connected to hover and keyboard up/down
  // 4. when first opening it should show the active tabs organized by last used
  // 5. open tabs should be shown first even when filtering with a grey line and heading

  const [fileMatches, setFileMatches] = createSignal<
    { name: string; description: string; project: string }[]
  >([]);

  const [openTabs, setOpenTabs] = createSignal<
    { name: string; description: string; project: string }[]
  >([]);

  const onCommandPaletteInput = (e: InputEvent) => {
    const value = e.target?.value;

    if (value !== state.commandPalette.query) {
      setState(
        produce((_state: AppState) => {
          _state.commandPalette = { query: value, results: [] };
        })
      );
    }

    electrobun.rpc?.request
      .findFilesInWorkspace({ query: value })
      .then((results) => {
        console.log("find all results: ", results);
      });
  };

  createEffect((lastValue) => {
    if (open()) {
      resetOpenTabs();
      if (!lastValue) {
        setState("commandPalette", "query", "");
      }

      return true;
    }

    return false;
  });

  const resetOpenTabs = () => {
    const query = state.commandPalette.query;
    const queryRegex = new RegExp(query.split("").join(".*"), "i");
    const tabs = Object.values(getWindow(state)?.tabs || {}).reduce(
      (acc, tab) => {
        if (tab.type === "file") {
          // const node = state.fileCache[tab.path];
          const project = getProjectForNodePath(tab.path);
          const name = basename(tab.path);
          const folder = dirname(tab.path).replace(project?.path || "", "");
          const projectName = project?.name || basename(project?.path);
          console.log("project name::::", project);
          if (name.match(queryRegex)) {
            acc.push({
              name: name,
              description: `${projectName} ${folder}`,
              path: tab.path,
              tabId: tab.id,
            });
          }
        } else if (tab.type === "web") {
          if (tab.url.match(queryRegex)) {
            acc.push({
              name: new URL(tab.url).host,
              description: tab.url,
              tabId: tab.id,
              // todo: tabs need to store which project they were opened under
              // project: "web",
            });
          }
        }

        return acc;
      },
      []
    );

    setOpenTabs(tabs);
  };

  // resetOpenTabs();

  createEffect(() => {
    const matches = [];
    if (state.commandPalette.query) {
      Object.entries(state.commandPalette.results).forEach(([key, value]) => {
        const project = state.projects[key];
        value.forEach((path) => {
          const name = basename(path);
          const folder = dirname(path).replace(project.path, "");
          matches.push({
            name,
            description: `${
              project.name || basename(project.path || "")
            } ${folder}`,
            path,
          });
        });
      });
    }

    setFileMatches(matches);
  });

  let input: HTMLInputElement;

  createEffect(() => {
    if (open()) {
      // trigger webview rapid sync so show animation plays smoothly
      document
        .querySelectorAll("electrobun-webview")
        .forEach((el) => el?.syncDimensions());
      input?.focus();
    }
  });

  return (
    <div
      style={`
      position: absolute;
      height: 40px;          
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: none;
    `}
    >
      <button
        onClick={() => setOpen(!open())}
        style={`
        pointer-events: auto;
        width: 300px;
        border-radius: 7px;
        border: none;
        background: #444;
        padding: 4px;
        text-align: center;
        font-family: Helvetica;
        font-size: 14px;
        color: #999;
        cursor: pointer;
      `}
      >
        Search
      </button>
      <style>
        {`@keyframes fadeIn {
        to {
          opacity: 1;
          transform: translateY(0);           
        }
      }`}
      </style>
      {open() && (
        <div
          class="webview-overlay"
          style={`
          position: absolute;
          top: 8px;
          background: #222;
          z-index: 999999;
          width: 500px;
          min-height: 200px;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #444;
          display: flex;
          flex-direction: column;
          pointer-events: auto;
          box-shadow: 0 9px 10px 2px #170808;
          opacity: 0;
          transform: translateY(-10px);
          animation: fadeIn 0.4s forwards;          
        `}
        >
          <input
            ref={(r) => (input = r)}
            style={`
              background: #393939;
              border: 1px solid #444;
              border-radius: 4px;
              padding: 4px; 
              color: #ddd;   
              margin-bottom: 6px;          
            `}
            autofocus={true}
            onBlur={() => setOpen(false || false)}
            type="text"
            placeholder="Search"
            onInput={onCommandPaletteInput}
          />
          <div
            style={`max-height: 80vh;
          overflow-y: scroll;`}
          >
            {openTabs().length && (
              <div>
                <h3
                  style={`
              color: #888;
              padding: 5px;
              font-size: 12px;
              border-bottom: 1px solid #333;
              margin: 0 3px;`}
                >
                  Tabs
                </h3>
                <For each={openTabs()}>
                  {(match) => {
                    return (
                      <CommandPaletteItem
                        icon={"✨"}
                        name={match.name}
                        description={match.description}
                        onSelect={() => {
                          focusTabWithId(match.tabId);
                        }}
                      />
                    );
                  }}
                </For>
              </div>
            )}
            {fileMatches().length && (
              <div>
                <h3
                  style={`
              color: #888;
              padding: 5px;
              font-size: 12px;
              border-bottom: 1px solid #333;
              margin: 0 3px;`}
                >
                  Files
                </h3>
                <For each={fileMatches()}>
                  {(match) => {
                    // const name = basename(match.path);
                    // const folder = dirname(match.path);
                    return (
                      <CommandPaletteItem
                        icon={"✨"}
                        name={match.name}
                        description={match.description}
                        onSelect={() => {
                          openFileAt(match.path, 0, 0);
                        }}
                      />
                    );
                  }}
                </For>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CommandPaletteItem = ({ icon, name, description, onSelect }) => {
  const [hover, setHover] = createSignal(false);

  return (
    <div
      style={`
    display: flex;
    color: #666;
    padding: 0 5px;
    background: ${hover() ? "#3f5b7c" : "#222"};
    color: ${hover() ? "#ddd" : "#fff"};    
    padding: 5px;
    border-radius: 5px;
    align-items: center;
    cursor: pointer;
    text-wrap-mode: nowrap;
    `}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={onSelect}
    >
      <div>{icon}</div>
      <div>{name}</div>
      <div style={`font-size: 12px; opacity: .6; margin-left:8px;`}>
        {description}
      </div>
    </div>
  );
};

const WorkspaceMenu = ({ children }: { children: JSX.Element }) => {
  return (
    <Show when={state.workspace.id}>
      <div style="-webkit-user-select: none; font-size: 13px; color: #ddd;margin: 8px 0px; padding: 5px; ">
        <span
          style={`border-radius: 4px;padding: 5px 17px;   font-size: 13px; cursor: pointer;`}
          class="workspace-menu-button"
          onClick={() => {
            if (!state.ui.showWorkspaceMenu) {
              setState("isResizingPane", true);
              setTimeout(() => {
                setState(
                  "ui",
                  "showWorkspaceMenu",
                  !state.ui.showWorkspaceMenu
                );
              }, 100);
            } else {
              setState("ui", "showWorkspaceMenu", !state.ui.showWorkspaceMenu);
              setState("isResizingPane", false);
            }
          }}
        >
          {state.workspace?.name || "Workspace"}
        </span>
        <div style="position:relative;">
          <Show when={state.ui.showWorkspaceMenu}>
            <div
              class="workspace-menu webview-overlay"
              style="border-radius: 4px; position: absolute; top: 8px; right: 0px;min-width:200px; text-align: right; border: 2px solid black; padding:2px; z-index: 2; background: #000"
              onClick={() => setState("ui", "showWorkspaceMenu", false)}
            >
              <ul style="list-style: none;">{children}</ul>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

const Update = () => {
  const isReady = () => Boolean(state.update.downloadedFile);
  const updateInfo = () => state.update.info;
  const hasError = () =>
    state.update.status === "error" || Boolean(state.update.error);
  const updateAvailable = () =>
    Boolean(updateInfo()?.updateAvailable) || isReady() || hasError();
  const updateErrorMessage = () =>
    state.update.error?.message || "Update failed. Please download manually.";

  const buttonLabel = () => {
    const version = updateInfo()?.version || "";

    if (hasError()) {
      return "Update Failed";
    }

    if (isReady()) {
      return `Update Installed: Relaunch now ${version} - ${updateInfo().hash}`;
    }

    return `Downloading Update ${version} - ${updateInfo().hash}`;
  };

  const buttonTitle = () => {
    if (hasError()) {
      return updateErrorMessage();
    } else if (isReady()) {
      return "Will automatically update at next restart";
    }

    if (state.update.status === "update-not-downloaded") {
      return "Download failed, retrying shortly";
    }

    return "Downloading update…";
  };

  const onClick = () => {
    if (!isReady()) {
      return;
    }

    electrobun.rpc?.send.installUpdateNow();
  };

  return (
    <Show when={updateAvailable()}>
      <div
        class={`update-button${hasError() ? " error" : ""}`}
        onClick={onClick}
        title={buttonTitle()}
        style={`font-size: 13px;margin: 8px 0px; padding: 5px; cursor: ${
          isReady() ? "pointer" : "default"
        };`}
      >
        <span
          style={`-webkit-user-select: none;border-radius: 4px;  padding: 5px 17px; font-size: 13px; box-sizing: border-box; color: ${
            hasError() ? "#fff" : "#222"
          }; opacity: ${
            hasError() || isReady() ? 1 : 0.7
          };`}
        >
          {buttonLabel()}
        </span>
      </div>
    </Show>
  );
};

const AppMenu = () => {
  const openWebTab = (url: string) => {
    openNewTabForNode("__COLAB_INTERNAL__/web", false, {
      url,
    });
  };

  return (
    <div
      style="font-size: 13px;margin: 8px 0px; margin-right: -2px; cursor: pointer;"
      title="This is a beta version of co(lab)"
      onClick={() => {
        if (!state.ui.showAppMenu) {
          setState("isResizingPane", true);
          setTimeout(() => {
            setState("ui", "showAppMenu", !state.ui.showAppMenu);
          }, 100);
        } else {
          setState("ui", "showAppMenu", !state.ui.showAppMenu);
          setState("isResizingPane", false);
        }
      }}
    >
      <img
        class="app-menu-button"
        style={{
          height: "25px",
          background: "#fefefe",
          "border-radius": "4px",
        }}
        src="views://assets/colab-logo.png"
      />

      <div style="position:relative;">
        <Show when={state.ui.showAppMenu}>
          <div
            class="app-menu webview-overlay"
            style="font-weight: bold;border-radius: 4px; position: absolute; top: 8px; right: 6px;min-width:200px; text-align: right; border: 2px solid black; padding:2px; z-index: 2; background: #000"
            onClick={() => setState("ui", "showAppMenu", false)}
          >
            <ul style="list-style: none;">
              <li
                style={{ cursor: "pointer" }}
                onClick={() => openWebTab("https://colab.dev/docs")}
              >
                Docs
              </li>
              <li
                style={{ cursor: "pointer" }}
                onClick={() => openWebTab("https://colab.dev/changelog")}
              >
                Changelog
              </li>
              <li
                style={{ cursor: "pointer" }}
                onClick={() => openWebTab("https://discord.gg/ueKE4tjaCE")}
              >
                Join co(lab) Discord
              </li>
            </ul>
          </div>
        </Show>
      </div>
    </div>
  );
};
