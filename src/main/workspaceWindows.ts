// Ephemeral workspace/window state
// todo (yoav): replace this with solidjs ephemeral store? and possibly add subscription / syncing to the front-end
export let workspaceWindows: {
  [id: string]: {
    [id: string]: {
      id: string;
      // YYY - use type
      win: any;
      // portalChannel: any;
      status: "open" | "hiding";
    };
  };
} = {};

export const broadcastToAllWindowsInWorkspace = (
  workspaceId: string,
  type: string,
  data: any
) => {
  const activeWorkspaceWindows = workspaceWindows[workspaceId];

  for (const windowId in activeWorkspaceWindows) {
    const { win } = activeWorkspaceWindows[windowId];

    win.webview?.rpc.send(type, data);
  }
};

export const broadcastToAllWindows = (type: string, data: any) => {
  for (const workspaceId in workspaceWindows) {
    broadcastToAllWindowsInWorkspace(workspaceId, type, data);
  }
};

export const broadcastToWindow = (
  workspaceId: string,
  windowId: string,
  type: string,
  data: any
) => {
  const activeWorkspaceWindows = workspaceWindows[workspaceId];
  const { win } = activeWorkspaceWindows[windowId];
  win.webview?.rpc.send(type, data);
};
