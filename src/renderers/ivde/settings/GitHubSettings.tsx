import {
  type JSXElement,
  createSignal,
  createEffect,
  onMount,
  Show,
} from "solid-js";
import { state, setState, updateSyncedAppSettings } from "../store";
import {
  SettingsPaneSaveClose,
  SettingsPaneFormSection,
  SettingsPaneField,
} from "./forms";
import { electrobun } from "../init";

export const GitHubSettings = (): JSXElement => {
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [connectionStatus, setConnectionStatus] = createSignal<string>("");
  const [userInfo, setUserInfo] = createSignal<{
    login: string;
    name: string;
    avatar_url: string;
    public_repos: number;
    private_repos: number;
  } | null>(null);

  const isConnected = () => {
    return state.appSettings.github.accessToken && state.appSettings.github.username;
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString();
  };

  onMount(() => {
    // If we have a token, verify it's still valid and get user info
    if (isConnected()) {
      verifyAndGetUserInfo();
    }
  });

  const verifyAndGetUserInfo = async () => {
    if (!state.appSettings.github.accessToken) return;
    
    setConnectionStatus("Verifying connection...");
    
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${state.appSettings.github.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Colab-IDE/1.0.0',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUserInfo(userData);
        setConnectionStatus("Connected successfully");
        
        // Update username if it's different
        if (userData.login !== state.appSettings.github.username) {
          setState("appSettings", "github", "username", userData.login);
          updateSyncedAppSettings();
        }
      } else {
        setConnectionStatus("Token is invalid or expired");
        // Clear invalid token
        setState("appSettings", "github", {
          accessToken: "",
          username: "",
          connectedAt: undefined,
          scopes: [],
        });
        updateSyncedAppSettings();
      }
    } catch (error) {
      console.error("Error verifying GitHub token:", error);
      setConnectionStatus("Failed to verify connection");
    }
  };

  // GitHub OAuth configuration
  const getGitHubConfig = () => {
    // For development/testing, fallback to Personal Access Token flow
    // In production, this would be replaced with actual OAuth app credentials
    const isDevelopment = window.location.hostname === 'localhost';
    
    return {
      // These would be environment-specific in a real deployment:
      // Development: OAuth app for localhost
      // Production: OAuth app for the actual domain
      clientId: isDevelopment ? 'dev_client_id_here' : 'prod_client_id_here',
      redirectUri: isDevelopment ? 'http://localhost:3000/auth/github/callback' : 'https://colab.sh/auth/github/callback',
      scopes: 'repo,read:user,read:org'
    };
  };

  const initiateOAuthFlow = async () => {
    setIsConnecting(true);
    setConnectionStatus("OAuth flow not configured - using Personal Access Token method");
    
    // For now, skip OAuth and go straight to PAT input since we don't have OAuth app set up
    // This would be enabled once proper OAuth app credentials are configured
    /*
    try {
      const config = getGitHubConfig();
      const state_param = Math.random().toString(36).substring(7);
      
      // Store state for validation
      localStorage.setItem('github_oauth_state', state_param);
      
      const authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${config.clientId}&` +
        `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
        `scope=${encodeURIComponent(config.scopes)}&` +
        `state=${state_param}`;
      
      // Open auth URL in system browser
      await electrobun.rpc?.request.openUrlInNewTab({ url: authUrl });
      
      setConnectionStatus("Complete authorization in your browser, then paste the token below");
    } catch (error) {
      console.error("Error initiating OAuth flow:", error);
      setConnectionStatus("Failed to open GitHub authorization");
      setIsConnecting(false);
    }
    */
  };

  const disconnect = () => {
    setState("appSettings", "github", {
      accessToken: "",
      username: "",
      connectedAt: undefined,
      scopes: [],
    });
    setUserInfo(null);
    setConnectionStatus("Disconnected");
    updateSyncedAppSettings();
  };

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    
    // Settings are already saved via individual handlers
    // Just close the panel
    setState("settingsPane", { type: "", data: {} });
  };

  const onTokenInput = async (token: string) => {
    if (!token.trim()) return;
    
    setConnectionStatus("Verifying token...");
    
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Colab-IDE/1.0.0',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        const scopes = response.headers.get('X-OAuth-Scopes')?.split(', ') || [];
        
        const githubSettings = {
          accessToken: token,
          username: userData.login,
          connectedAt: Date.now(),
          scopes: scopes,
        };
        
        setState("appSettings", "github", githubSettings);
        
        setUserInfo(userData);
        setConnectionStatus("Connected successfully!");
        setIsConnecting(false);
        updateSyncedAppSettings();
      } else {
        setConnectionStatus("Invalid token. Please check and try again.");
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      setConnectionStatus("Failed to verify token");
    }
  };

  return (
    <div
      style="background: #404040; color: #d9d9d9; height: 100vh; overflow: hidden; display: flex; flex-direction: column;"
    >
      <form onSubmit={onSubmit} style="height: 100%; display: flex; flex-direction: column;">
        <SettingsPaneSaveClose label="GitHub Integration" />
        
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
            
            <Show when={isConnected() && userInfo()}>
              <SettingsPaneField label="Account">
                <div style="background: #2b2b2b; padding: 12px; border-radius: 4px; display: flex; align-items: center; gap: 12px;">
                  <img 
                    src={userInfo()?.avatar_url}
                    style="width: 32px; height: 32px; border-radius: 50%;"
                    alt="GitHub Avatar"
                  />
                  <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 12px; font-weight: 500; color: #d9d9d9;">
                      {userInfo()?.name || userInfo()?.login}
                    </span>
                    <span style="font-size: 10px; color: #999;">
                      @{userInfo()?.login}
                    </span>
                    <span style="font-size: 10px; color: #999; margin-top: 2px;">
                      {userInfo()?.public_repos || 0} public repos • {userInfo()?.private_repos || 0} private repos
                    </span>
                  </div>
                </div>
              </SettingsPaneField>
            </Show>
            
            <Show when={isConnected()}>
              <SettingsPaneField label="Connected">
                <div style="font-size: 11px; color: #999;">
                  Connected on {formatDate(state.appSettings.github.connectedAt)}
                </div>
                <div style="font-size: 11px; color: #999; margin-top: 4px;">
                  Scopes: {state.appSettings.github.scopes.join(', ') || 'Unknown'}
                </div>
              </SettingsPaneField>
            </Show>
          </SettingsPaneFormSection>

          <SettingsPaneFormSection label="GitHub Authentication">
            <Show 
              when={!isConnected()}
              fallback={
                <SettingsPaneField label="">
                  <button
                    type="button"
                    onClick={disconnect}
                    style="background: #ff6b6b; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;"
                  >
                    Disconnect GitHub Account
                  </button>
                  <div style="font-size: 11px; color: #999; margin-top: 8px; text-align: center;">
                    This will remove access to your GitHub repositories for cloning.
                  </div>
                </SettingsPaneField>
              }
            >
              <SettingsPaneField label="">
                <Show 
                  when={!isConnecting()}
                  fallback={
                    <div>
                      <div style="margin-bottom: 12px;">
                        <label style="display: block; font-size: 12px; color: #d9d9d9; margin-bottom: 6px;">
                          Paste your GitHub Personal Access Token:
                        </label>
                        <input
                          type="password"
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                          style="background: #2b2b2b; border: 1px solid #555; color: #d9d9d9; padding: 8px 12px; border-radius: 4px; font-size: 12px; width: 100%; box-sizing: border-box; font-family: 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;"
                          onInput={(e) => {
                            const token = e.currentTarget.value.trim();
                            if (token.length > 20) { // GitHub tokens are typically longer
                              onTokenInput(token);
                            }
                          }}
                        />
                      </div>
                      <div style="font-size: 11px; color: #999; margin-bottom: 12px;">
                        Create a Personal Access Token at: 
                        <a 
                          href="https://github.com/settings/tokens/new"
                          style="color: #0969da; text-decoration: none; margin-left: 4px;"
                          onClick={(e) => {
                            e.preventDefault();
                            // Open GitHub token creation page in a separate auth webview
                            setState("githubAuth", {
                              authUrl: "https://github.com/settings/tokens/new?scopes=repo,read:user,read:org&description=Colab%20IDE",
                              resolver: () => {
                                // No need to do anything special, just close the auth webview
                                // User will manually copy the token from GitHub and paste it
                                setState("githubAuth", { authUrl: null, resolver: null });
                              }
                            });
                          }}
                        >
                          github.com/settings/tokens/new
                        </a>
                      </div>
                      <div style="background: #1a1a1a; border: 1px solid #333; padding: 12px; border-radius: 4px; margin-bottom: 12px;">
                        <div style="font-size: 11px; color: #ffa500; font-weight: 500; margin-bottom: 6px;">
                          Required Scopes:
                        </div>
                        <ul style="font-size: 10px; color: #999; margin: 0; padding-left: 16px;">
                          <li><code>repo</code> - Access to repositories for cloning</li>
                          <li><code>read:user</code> - Read your profile information</li>
                          <li><code>read:org</code> - Access to organization repositories</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsConnecting(false)}
                        style="background: #666; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; width: 100%;"
                      >
                        Cancel
                      </button>
                    </div>
                  }
                >
                  <button
                    type="button"
                    onClick={initiateOAuthFlow}
                    style="background: #0969da; color: white; border: none; padding: 12px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%; font-weight: 500;"
                  >
                    Connect GitHub Account
                  </button>
                  <div style="font-size: 11px; color: #999; margin-top: 8px; text-align: center;">
                    Connect your GitHub account to enable repository cloning from your accessible repos.
                  </div>
                </Show>
              </SettingsPaneField>
            </Show>
          </SettingsPaneFormSection>

          <SettingsPaneFormSection label="Features">
            <SettingsPaneField label="Repository Access">
              <div style="background: #2b2b2b; padding: 12px; border-radius: 4px;">
                <div style="font-size: 12px; color: #d9d9d9; margin-bottom: 8px;">
                  <strong>What you can do with GitHub integration:</strong>
                </div>
                <ul style="font-size: 11px; color: #999; margin: 0; padding-left: 16px; line-height: 1.4;">
                  <li>Browse and clone your personal repositories</li>
                  <li>Access organization repositories you have permissions for</li>
                  <li>Search and filter repositories by name, language, etc.</li>
                  <li>Select specific branches when cloning</li>
                  <li style="color: #666; font-style: italic;">Coming soon: Push/pull with authentication</li>
                  <li style="color: #666; font-style: italic;">Coming soon: Create pull requests directly from Colab</li>
                </ul>
              </div>
            </SettingsPaneField>
          </SettingsPaneFormSection>
        </div>
      </form>
    </div>
  );
};