import {
  type JSXElement,
  createSignal,
  onMount,
  Show,
} from "solid-js";
import { state, setState, updateSyncedAppSettings } from "../store";
import {
  SettingsPaneSaveClose,
  SettingsPaneFormSection,
  SettingsPaneField,
} from "./forms";

// API URLs - use 127.0.0.1 in dev (localhost can cause issues with webviews), production URL otherwise
const getApiBaseUrl = () => {
  const isDev = state.buildVars.channel === "dev";
  return isDev ? "http://127.0.0.1:8788" : "https://cloud.blackboard.sh";
};

const getDashboardUrl = () => {
  const isDev = state.buildVars.channel === "dev";
  return isDev ? "http://127.0.0.1:8788/dashboard" : "https://cloud.blackboard.sh/dashboard";
};

export const ColabCloudSettings = (): JSXElement => {
  const [isLoggingIn, setIsLoggingIn] = createSignal(false);
  const [loginError, setLoginError] = createSignal<string>("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [connectionStatus, setConnectionStatus] = createSignal<string>("");

  const isConnected = () => {
    return state.appSettings.colabCloud.accessToken && state.appSettings.colabCloud.email;
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString();
  };

  onMount(() => {
    // If we have a token, verify it's still valid
    if (isConnected()) {
      verifyConnection();
    }
  });

  const verifyConnection = async () => {
    if (!state.appSettings.colabCloud.accessToken) return;

    setConnectionStatus("Verifying connection...");

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${state.appSettings.colabCloud.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update user info if changed
        setState("appSettings", "colabCloud", {
          ...state.appSettings.colabCloud,
          email: data.user.email,
          name: data.user.name,
          emailVerified: data.user.email_verified === 1,
        });
        setConnectionStatus("Connected");
        updateSyncedAppSettings();
      } else if (response.status === 401) {
        // Token expired, try to refresh
        await refreshToken();
      } else {
        setConnectionStatus("Connection error");
      }
    } catch (error) {
      console.error("Error verifying Colab Cloud connection:", error);
      setConnectionStatus("Failed to verify connection");
    }
  };

  const refreshToken = async () => {
    const refreshTokenValue = state.appSettings.colabCloud.refreshToken;
    if (!refreshTokenValue) {
      disconnect();
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshTokenValue }),
      });

      if (response.ok) {
        const data = await response.json();
        setState("appSettings", "colabCloud", {
          ...state.appSettings.colabCloud,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        setConnectionStatus("Connected");
        updateSyncedAppSettings();
      } else {
        // Refresh token invalid, need to re-login
        disconnect();
        setConnectionStatus("Session expired, please login again");
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      setConnectionStatus("Failed to refresh session");
    }
  };

  const login = async () => {
    if (!email() || !password()) {
      setLoginError("Email and password are required");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email(),
          password: password(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setState("appSettings", "colabCloud", {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          userId: data.user.id,
          email: data.user.email,
          name: data.user.name,
          emailVerified: data.user.email_verified === 1,
          connectedAt: Date.now(),
        });
        setConnectionStatus("Connected successfully!");
        setEmail("");
        setPassword("");
        updateSyncedAppSettings();
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Network error. Please check your connection.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const disconnect = async () => {
    // Try to logout on server
    try {
      const refreshTokenValue = state.appSettings.colabCloud.refreshToken;
      if (refreshTokenValue) {
        await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: refreshTokenValue }),
        });
      }
    } catch (error) {
      // Ignore errors, we're logging out anyway
    }

    setState("appSettings", "colabCloud", {
      accessToken: "",
      refreshToken: "",
      userId: "",
      email: "",
      name: "",
      emailVerified: false,
      connectedAt: undefined,
    });
    setConnectionStatus("Disconnected");
    updateSyncedAppSettings();
  };

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    setState("settingsPane", { type: "", data: {} });
  };

  return (
    <div
      style="background: #404040; color: #d9d9d9; height: 100vh; overflow: hidden; display: flex; flex-direction: column;"
    >
      <form onSubmit={onSubmit} style="height: 100%; display: flex; flex-direction: column;">
        <SettingsPaneSaveClose label="Colab Cloud" />

        <div style="flex: 1; overflow-y: auto; padding: 0; margin-bottom: 60px;">
          <SettingsPaneFormSection label="Connection Status">
            <SettingsPaneField label="Status">
              <div style="background: #202020; padding: 12px; color: #d9d9d9; font-size: 12px; border-radius: 4px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style={{
                    width: "8px",
                    height: "8px",
                    "border-radius": "50%",
                    background: isConnected() ? "#51cf66" : "#666",
                  }}></div>
                  <span style="font-weight: 500;">
                    {isConnected() ? "Connected" : "Not Connected"}
                  </span>
                </div>
                <Show when={connectionStatus()}>
                  <div style="font-size: 11px; color: #999; margin-top: 4px;">
                    {connectionStatus()}
                  </div>
                </Show>
              </div>
            </SettingsPaneField>

            <Show when={isConnected()}>
              <SettingsPaneField label="Account">
                <div style="background: #2b2b2b; padding: 12px; border-radius: 4px;">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 12px; font-weight: 500; color: #d9d9d9;">
                      {state.appSettings.colabCloud.name || state.appSettings.colabCloud.email}
                    </span>
                    <span style="font-size: 10px; color: #999;">
                      {state.appSettings.colabCloud.email}
                    </span>
                    <Show when={!state.appSettings.colabCloud.emailVerified}>
                      <span style="font-size: 10px; color: #ffa500; margin-top: 4px;">
                        Email not verified
                      </span>
                    </Show>
                  </div>
                </div>
              </SettingsPaneField>

              <SettingsPaneField label="Connected">
                <div style="font-size: 11px; color: #999;">
                  Connected on {formatDate(state.appSettings.colabCloud.connectedAt)}
                </div>
              </SettingsPaneField>
            </Show>
          </SettingsPaneFormSection>

          <SettingsPaneFormSection label="Authentication">
            <Show
              when={!isConnected()}
              fallback={
                <SettingsPaneField label="">
                  <button
                    type="button"
                    onClick={disconnect}
                    style="background: #ff6b6b; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;"
                  >
                    Logout
                  </button>
                  <div style="font-size: 11px; color: #999; margin-top: 8px; text-align: center;">
                    You will need to login again to sync settings.
                  </div>
                </SettingsPaneField>
              }
            >
              <SettingsPaneField label="">
                <Show when={loginError()}>
                  <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); color: #ff6b6b; padding: 8px 12px; border-radius: 4px; font-size: 11px; margin-bottom: 12px;">
                    {loginError()}
                  </div>
                </Show>

                <div style="margin-bottom: 12px;">
                  <label style="display: block; font-size: 11px; color: #999; margin-bottom: 4px;">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    style="background: #2b2b2b; border: 1px solid #555; color: #d9d9d9; padding: 8px 12px; border-radius: 4px; font-size: 12px; width: 100%; box-sizing: border-box;"
                  />
                </div>

                <div style="margin-bottom: 12px;">
                  <label style="display: block; font-size: 11px; color: #999; margin-bottom: 4px;">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        login();
                      }
                    }}
                    style="background: #2b2b2b; border: 1px solid #555; color: #d9d9d9; padding: 8px 12px; border-radius: 4px; font-size: 12px; width: 100%; box-sizing: border-box;"
                  />
                </div>

                <button
                  type="button"
                  onClick={login}
                  disabled={isLoggingIn()}
                  style={`background: #4ade80; color: #1a1a1a; border: none; padding: 10px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%; font-weight: 500; opacity: ${isLoggingIn() ? 0.7 : 1};`}
                >
                  {isLoggingIn() ? "Logging in..." : "Login"}
                </button>

                <div style="font-size: 11px; color: #999; margin-top: 12px; text-align: center;">
                  Don't have an account?{" "}
                  <a
                    href="#"
                    style="color: #4ade80; text-decoration: none;"
                    onClick={(e) => {
                      e.preventDefault();
                      // Open registration page in a web tab
                      const registerUrl = `${getApiBaseUrl()}/register`;
                      import("../store").then(({ openNewTabForNode }) => {
                        openNewTabForNode("__COLAB_INTERNAL__/web", false, { url: registerUrl });
                      });
                    }}
                  >
                    Sign up
                  </a>
                </div>
              </SettingsPaneField>
            </Show>
          </SettingsPaneFormSection>

          <SettingsPaneFormSection label="Features">
            <SettingsPaneField label="Settings Sync">
              <div style="background: #2b2b2b; padding: 12px; border-radius: 4px;">
                <div style="font-size: 12px; color: #d9d9d9; margin-bottom: 8px;">
                  <strong>What you can do with Colab Cloud:</strong>
                </div>
                <ul style="font-size: 11px; color: #999; margin: 0; padding-left: 16px; line-height: 1.4;">
                  <li>Sync your Co(lab) settings across devices</li>
                  <li>Backup your workspace configurations</li>
                  <li>Access your settings from any computer</li>
                  <li style="color: #666; font-style: italic;">Coming soon: Team settings sharing</li>
                </ul>
              </div>
            </SettingsPaneField>

            <SettingsPaneField label="Manage Account">
              <button
                type="button"
                onClick={() => {
                  import("../store").then(({ openNewTabForNode }) => {
                    openNewTabForNode("__COLAB_INTERNAL__/web", false, { url: getDashboardUrl() });
                  });
                }}
                style="background: #333; color: #d9d9d9; border: 1px solid #555; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;"
              >
                Open Colab Cloud Dashboard
              </button>
              <div style="font-size: 11px; color: #999; margin-top: 8px; text-align: center;">
                Manage your account, devices, and subscription.
              </div>
            </SettingsPaneField>
          </SettingsPaneFormSection>
        </div>
      </form>
    </div>
  );
};
