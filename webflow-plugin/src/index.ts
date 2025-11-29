/**
 * Webflow Plugin for Colab
 *
 * Provides integration with Webflow's ecosystem:
 * - DevLink: Sync visual components from Webflow Designer to code
 * - Code Components: Share React components from code to Webflow Designer
 * - Webflow Cloud: Deploy Next.js/Astro apps to Webflow's edge infrastructure
 * - Assets: Upload and inject custom code/assets into Webflow sites
 */

import type { PluginAPI, Disposable } from '../../src/main/plugins/types';
import { WebflowClient } from './api/client';
import { StorageManager } from './storage/manager';
import { handleWfCommand } from './commands/wf';

const disposables: Disposable[] = [];

let client: WebflowClient | null = null;
let storage: StorageManager | null = null;
let pluginApi: PluginAPI | null = null;

// Export for use by GUI
export function getClient(): WebflowClient | null {
  return client;
}

export function getStorage(): StorageManager | null {
  return storage;
}

export function getApi(): PluginAPI | null {
  return pluginApi;
}

/**
 * Called when the plugin is activated
 */
export async function activate(api: PluginAPI): Promise<void> {
  api.log.info('Webflow plugin activating...');
  pluginApi = api;

  // Initialize storage manager
  storage = new StorageManager(api);
  await storage.initialize();

  // Initialize API client (will use stored auth if available)
  client = new WebflowClient(storage, api);

  // Create status bar item early so it can be used by settings handlers
  const statusBarItem = api.statusBar.createItem({
    id: 'webflow-status',
    text: 'Webflow',
    tooltip: 'Webflow Plugin - Click to open settings',
    color: '#4353ff',
    alignment: 'right',
    priority: 50,
  });
  disposables.push(statusBarItem);

  // Unified token type
  interface WebflowToken {
    id: string;
    token: string;
    label?: string;
    type: 'oauth' | 'site' | 'workspace';
    siteId?: string;
    workspaceId?: string;
    scopes?: string[];
    status: 'idle' | 'validating' | 'valid' | 'invalid';
    error?: string;
  }

  // Fetch and store sites for the current token
  const fetchAndStoreSites = async (token: string) => {
    try {
      const response = await fetch('https://api.webflow.com/v2/sites', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        api.state.set('sites', data.sites || []);
        api.log.info(`Fetched ${data.sites?.length || 0} sites`);
      }
    } catch (e) {
      api.log.warn('Failed to fetch sites:', e);
    }
  };

  // Update status bar based on valid tokens
  const updateStatusBar = async () => {
    const tokens = api.state.get<WebflowToken[]>('tokens') || [];
    const validTokens = tokens.filter(t => t.status === 'valid');

    if (validTokens.length > 0) {
      const labels = validTokens.map(t => t.label || t.type).slice(0, 2);
      const extra = validTokens.length > 2 ? ` +${validTokens.length - 2}` : '';

      statusBarItem.update({
        text: `Webflow: ${labels.join(', ')}${extra}`,
        color: '#00c853',
        tooltip: `Connected to Webflow - ${validTokens.length} token${validTokens.length !== 1 ? 's' : ''}`,
      });
    } else if (tokens.length > 0) {
      statusBarItem.update({
        text: 'Webflow: Validating...',
        color: '#ff9800',
        tooltip: 'Verifying tokens...',
      });
    } else {
      statusBarItem.update({
        text: 'Webflow: Not connected',
        color: '#ff9800',
        tooltip: 'Click to connect your Webflow account',
      });
    }
  };

  // Validate any token - determines type automatically
  const validateToken = async (id: string, token: string) => {
    try {
      // First try the introspect endpoint to get token info
      const introspectResponse = await fetch('https://api.webflow.com/v2/token/introspect', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (introspectResponse.ok) {
        const data = await introspectResponse.json();
        api.log.info('Token introspect response:', JSON.stringify(data));

        // Extract scopes
        const scopes: string[] = [];
        if (data.authorization?.scopes) {
          scopes.push(...data.authorization.scopes);
        }

        // Check for workspace access (OAuth or workspace token)
        if (data.workspaces && data.workspaces.length > 0) {
          const workspace = data.workspaces[0];
          api.settings.postMessage({
            type: 'tokenValidated',
            id,
            label: workspace.displayName || workspace.shortName || 'Workspace',
            tokenType: 'oauth',
            workspaceId: workspace.id,
            scopes,
          });
          // Fetch sites and update status bar
          await fetchAndStoreSites(token);
          setTimeout(() => updateStatusBar(), 500);
          return;
        }

        // Check for site access
        if (data.sites && data.sites.length > 0) {
          const site = data.sites[0];
          api.settings.postMessage({
            type: 'tokenValidated',
            id,
            label: site.displayName || site.shortName || 'Site',
            tokenType: 'site',
            siteId: site.id,
            scopes,
          });
          await fetchAndStoreSites(token);
          setTimeout(() => updateStatusBar(), 500);
          return;
        }

        // Token is valid but no clear access - try listing sites
        const tempStorage = { async getAuth() { return { accessToken: token }; } } as any;
        const tempClient = new WebflowClient(tempStorage, api);

        try {
          const sites = await tempClient.listSites();
          if (sites.length > 0) {
            // Store sites in state
            api.state.set('sites', sites);
            const site = sites[0];
            api.settings.postMessage({
              type: 'tokenValidated',
              id,
              label: site.displayName || site.shortName || 'Site',
              tokenType: sites.length > 1 ? 'oauth' : 'site',
              siteId: site.id,
              scopes,
            });
            setTimeout(() => updateStatusBar(), 500);
            return;
          }
        } catch {
          // Ignore - will fall through to error
        }

        api.settings.postMessage({
          type: 'tokenInvalid',
          id,
          error: 'Token valid but no sites or workspaces accessible',
        });
      } else {
        // Introspect failed - try direct site listing as fallback
        const tempStorage = { async getAuth() { return { accessToken: token }; } } as any;
        const tempClient = new WebflowClient(tempStorage, api);

        try {
          const sites = await tempClient.listSites();
          if (sites.length > 0) {
            const site = sites[0];
            api.settings.postMessage({
              type: 'tokenValidated',
              id,
              label: site.displayName || site.shortName || 'Site',
              tokenType: sites.length > 1 ? 'oauth' : 'site',
              siteId: site.id,
            });
            setTimeout(() => updateStatusBar(), 500);
            return;
          }
        } catch (e) {
          api.log.warn('Site listing failed:', e);
        }

        // Both introspect and site listing failed
        if (introspectResponse.status === 401) {
          api.settings.postMessage({
            type: 'tokenInvalid',
            id,
            error: 'Invalid or expired token',
          });
        } else {
          api.settings.postMessage({
            type: 'tokenInvalid',
            id,
            error: `API error: ${introspectResponse.status}`,
          });
        }
      }
    } catch (e) {
      api.log.error('Token validation error:', e);
      api.settings.postMessage({
        type: 'tokenInvalid',
        id,
        error: e instanceof Error ? e.message : 'Network error',
      });
    }
    await updateStatusBar();
  };

  // Start browser-based OAuth flow using Webflow CLI
  const startBrowserAuth = async () => {
    api.log.info('=== startBrowserAuth called ===');

    try {
      // Create a temp folder for auth
      const home = process.env.HOME || '/tmp';
      const channel = process.env.COLAB_CHANNEL || 'dev';
      const colabDir = `${home}/.colab-${channel}`;
      const authDir = `${colabDir}/.tmp-auth`;
      const envPath = `${authDir}/.env`;

      api.log.info('Step 2: Setting up auth directory: ' + authDir);

      // Create the temp auth directory
      const { mkdir, rm, exists, watch } = await import('fs/promises');
      const { existsSync, readFileSync } = await import('fs');

      try {
        await mkdir(authDir, { recursive: true });
      } catch (e) {
        api.log.warn('Could not create auth dir:', e);
      }

      api.log.info('Step 3: Running auth command...');

      // Use expect to handle interactive prompts - auto-select first site
      const expectScript = `
        cd "${authDir}"
        expect -c '
          set timeout 120
          spawn npx -y @webflow/webflow-cli auth login --force
          expect {
            "Select the Webflow site" {
              send "\\r"
              exp_continue
            }
            "Authentication complete" {
              # Done
            }
            timeout {
              exit 1
            }
            eof
          }
        '
      `;

      api.shell.exec(expectScript, {
        cwd: authDir,
        timeout: 130000,
      }).then(r => {
        api.log.info('Auth command finished:', r.exitCode);
      }).catch(e => {
        api.log.warn('Auth command error:', e);
      });

      api.notifications.showInfo('Complete authentication in your browser...');

      // Watch for the .env file to be created using Bun's file APIs
      api.log.info('Step 4: Watching for token...');

      const checkForToken = (): string | null => {
        try {
          const fileExists = existsSync(envPath);
          api.log.info(`Checking ${envPath}: exists=${fileExists}`);
          if (fileExists) {
            const content = readFileSync(envPath, 'utf-8');
            api.log.info(`File content (${content.length} chars): ${content.slice(0, 100)}`);
            // Look for either WEBFLOW_SITE_API_TOKEN or WEBFLOW_WORKSPACE_API_TOKEN
            const match = content.match(/WEBFLOW_(?:SITE_API|WORKSPACE_API)_TOKEN="?([^"\n]+)"?/);
            if (match) {
              api.log.info('Found token match!');
              return match[1].trim();
            } else {
              api.log.warn('No token match in content');
            }
          }
        } catch (e) {
          api.log.warn('checkForToken error:', e);
        }
        return null;
      };

      // Poll using Bun's sync file APIs (fast and reliable)
      let attempts = 0;
      const maxAttempts = 180;

      const poll = () => {
        attempts++;
        const token = checkForToken();

        if (token) {
          api.log.info('Found token in .env!');

          // Clean up temp directory
          rm(authDir, { recursive: true, force: true }).catch(() => {});

          api.notifications.showInfo('Successfully authenticated with Webflow!');
          api.settings.postMessage({
            type: 'browserAuthComplete',
            token,
          });
          return;
        }

        if (attempts > maxAttempts) {
          api.log.warn('Token polling timed out');
          rm(authDir, { recursive: true, force: true }).catch(() => {});
          api.settings.postMessage({
            type: 'browserAuthFailed',
            error: 'Authentication timed out. Please try again.',
          });
          return;
        }

        // Continue polling
        setTimeout(poll, 1000);
      };

      // Start polling immediately
      setTimeout(poll, 1000);

    } catch (e) {
      api.log.error('Browser auth error:', e);
      api.settings.postMessage({
        type: 'browserAuthFailed',
        error: e instanceof Error ? e.message : 'Failed to start authentication',
      });
    }
  };

  // Load token from project's .env file if it exists
  const loadEnvToken = async () => {
    try {
      const workspaceFolders = await api.workspace.getWorkspaceFolders();
      if (workspaceFolders.length === 0) return;

      const cwd = workspaceFolders[0].path;
      const envPath = `${cwd}/.env`;

      if (await api.workspace.exists(envPath)) {
        const envContent = await api.workspace.readFile(envPath);
        const match = envContent.match(/WEBFLOW_WORKSPACE_API_TOKEN=(.+)/);
        if (match) {
          const token = match[1].trim();
          // Check if we already have this token
          const existingTokens = api.state.get<WebflowToken[]>('tokens') || [];
          const alreadyHave = existingTokens.some(t => t.token === token);

          if (!alreadyHave && token) {
            api.log.info('Found Webflow token in .env, importing...');
            api.settings.postMessage({
              type: 'browserAuthComplete',
              token,
            });
          }
        }
      }
    } catch (e) {
      api.log.warn('Could not load token from .env:', e);
    }
  };

  // Listen for messages from settings UI
  const messageDisposable = api.settings.onMessage(async (message: unknown) => {
    console.log('[Webflow] Received settings message:', message);
    const msg = message as { type: string; id?: string; token?: string };

    if (msg.type === 'validateToken' && msg.id && msg.token) {
      console.log('[Webflow] Handling validateToken');
      await validateToken(msg.id, msg.token);
    } else if (msg.type === 'startBrowserAuth') {
      console.log('[Webflow] Handling startBrowserAuth');
      await startBrowserAuth();
    } else if (msg.type === 'loadEnvToken') {
      console.log('[Webflow] Handling loadEnvToken');
      await loadEnvToken();
    }
  });
  disposables.push(messageDisposable);

  // Register settings schema with custom component for token management
  const settingsDisposable = api.settings.registerSchema({
    title: 'Webflow',
    description: 'Connect your Webflow account to sync components, deploy apps, and manage assets',
    customSettingsComponent: 'webflow-tokens',
    fields: [
      {
        key: 'autoSync',
        label: 'Auto-sync on save',
        type: 'boolean',
        default: false,
        description: 'Automatically sync DevLink components when files change',
      },
      {
        key: 'defaultFramework',
        label: 'Default Cloud Framework',
        type: 'select',
        default: 'astro',
        description: 'Default framework for new Webflow Cloud projects',
        options: [
          { label: 'Astro', value: 'astro' },
          { label: 'Next.js', value: 'nextjs' },
        ],
      },
      {
        key: 'showNotifications',
        label: 'Show Notifications',
        type: 'boolean',
        default: true,
        description: 'Show notifications for sync and deploy events',
      },
    ],
  });
  disposables.push(settingsDisposable);

  // Register terminal command: wf <subcommand> [args]
  const terminalDisposable = api.terminal.registerCommand('wf', async (ctx) => {
    await handleWfCommand(ctx, client!, storage!, api);
  });
  disposables.push(terminalDisposable);

  // Register file decoration provider for Webflow config files
  const decorationDisposable = api.fileDecorations.registerProvider({
    provideDecoration(filePath) {
      const filename = filePath.split('/').pop() || '';

      // DevLink config
      if (filename === '.webflowrc.json') {
        return {
          badge: 'WF',
          badgeColor: '#4353ff',
          tooltip: 'Webflow DevLink project',
        };
      }

      // Code Components library config
      if (filename === 'webflow.json') {
        return {
          badge: 'WF',
          badgeColor: '#4353ff',
          tooltip: 'Webflow Code Components library',
        };
      }

      // Webflow Cloud project marker
      if (filename === '.colab.json') {
        if (filePath.includes('/cloud/')) {
          return {
            badge: 'WF',
            badgeColor: '#00c853',
            tooltip: 'Webflow Cloud project',
          };
        }
      }

      return undefined;
    },
  });
  disposables.push(decorationDisposable);

  // Initial status bar update and fetch sites if we have a valid token
  const tokens = api.state.get<WebflowToken[]>('tokens') || [];
  const validToken = tokens.find(t => t.status === 'valid');
  if (validToken?.token) {
    api.log.info('Found existing valid token, fetching sites...');
    await fetchAndStoreSites(validToken.token);
  }
  await updateStatusBar();

  // Register context menu items
  const initMenuDisposable = api.contextMenu.registerItem(
    {
      id: 'webflow-init-devlink',
      label: 'Initialize Webflow DevLink',
      context: 'fileTree',
    },
    async (ctx) => {
      if (!ctx.filePath) return;

      // Get the directory path (if file selected, use parent directory)
      const { existsSync, writeFileSync, mkdirSync } = await import('fs');
      const { statSync } = await import('fs');
      const { join, dirname } = await import('path');

      let targetDir = ctx.filePath;
      try {
        const stat = statSync(ctx.filePath);
        if (!stat.isDirectory()) {
          targetDir = dirname(ctx.filePath);
        }
      } catch {
        targetDir = dirname(ctx.filePath);
      }

      // Check if already initialized
      const configPath = join(targetDir, '.webflowrc.json');
      if (existsSync(configPath)) {
        api.notifications.showWarning('DevLink is already initialized in this directory');
        return;
      }

      // Check authentication
      const tokens = api.state.get<WebflowToken[]>('tokens') || [];
      const validToken = tokens.find(t => t.status === 'valid');

      if (!validToken) {
        api.notifications.showError('Not connected to Webflow. Open Settings → Webflow to connect.');
        return;
      }

      api.notifications.showInfo('Fetching your Webflow sites...');

      try {
        // Fetch sites using the API
        const sitesResponse = await fetch('https://api.webflow.com/v2/sites', {
          headers: {
            'Authorization': `Bearer ${validToken.token}`,
            'Accept': 'application/json',
          },
        });

        if (!sitesResponse.ok) {
          throw new Error(`Failed to fetch sites: ${sitesResponse.status}`);
        }

        const { sites } = await sitesResponse.json() as { sites: Array<{ id: string; displayName: string; shortName: string }> };

        if (sites.length === 0) {
          api.notifications.showError('No Webflow sites found. Make sure your token has access to at least one site.');
          return;
        }

        // For now, use the first site - TODO: add site picker UI
        const site = sites[0];

        // Create .webflowrc.json with auth token
        const config = {
          siteId: site.id,
          siteName: site.displayName,
          authToken: validToken.token,
          componentsPath: './devlink',
        };
        writeFileSync(configPath, JSON.stringify(config, null, 2));

        // Add .webflowrc.json to .gitignore (contains auth token)
        const gitignorePath = join(targetDir, '.gitignore');
        try {
          const { readFileSync: readFs } = await import('fs');
          let gitignore = '';
          if (existsSync(gitignorePath)) {
            gitignore = readFs(gitignorePath, 'utf-8');
          }
          if (!gitignore.includes('.webflowrc.json')) {
            const addition = '\n# Webflow DevLink config (contains auth token)\n.webflowrc.json\n';
            writeFileSync(gitignorePath, gitignore + addition);
          }
        } catch (e) {
          api.log.warn('Could not update .gitignore:', e);
        }

        // Create devlink directory
        const devlinkPath = join(targetDir, 'devlink');
        if (!existsSync(devlinkPath)) {
          mkdirSync(devlinkPath, { recursive: true });
        }

        // Check/update package.json
        const packageJsonPath = join(targetDir, 'package.json');
        if (existsSync(packageJsonPath)) {
          try {
            const { readFileSync } = await import('fs');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            packageJson.devDependencies = {
              ...(packageJson.devDependencies || {}),
              '@webflow/webflow-cli': '^1.1.1',
            };
            writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
          } catch (e) {
            api.log.warn('Could not update package.json:', e);
          }
        }

        api.notifications.showInfo(`DevLink initialized for "${site.displayName}"! Run 'bun install' then right-click to sync.`);
        api.log.info(`DevLink initialized for site: ${site.displayName} (${site.id})`);

      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        api.notifications.showError(`Failed to initialize DevLink: ${message}`);
        api.log.error('DevLink init error:', e);
      }
    }
  );
  disposables.push(initMenuDisposable);

  const syncMenuDisposable = api.contextMenu.registerItem(
    {
      id: 'webflow-sync',
      label: 'Sync Webflow Components',
      context: 'fileTree',
    },
    async (ctx) => {
      if (!ctx.filePath) return;

      const { existsSync, readFileSync } = await import('fs');
      const { statSync } = await import('fs');
      const { join, dirname } = await import('path');
      const { spawn } = await import('child_process');

      // Get the directory path
      let targetDir = ctx.filePath;
      try {
        const stat = statSync(ctx.filePath);
        if (!stat.isDirectory()) {
          targetDir = dirname(ctx.filePath);
        }
      } catch {
        targetDir = dirname(ctx.filePath);
      }

      // Find .webflowrc.json (check current dir and parents)
      let configPath = join(targetDir, '.webflowrc.json');
      let searchDir = targetDir;
      while (!existsSync(configPath)) {
        const parent = dirname(searchDir);
        if (parent === searchDir) break; // reached root
        searchDir = parent;
        configPath = join(searchDir, '.webflowrc.json');
      }

      if (!existsSync(configPath)) {
        api.notifications.showError('No DevLink configuration found. Right-click a folder and select "Initialize Webflow DevLink" first.');
        return;
      }

      // Check authentication
      const tokens = api.state.get<WebflowToken[]>('tokens') || [];
      const validToken = tokens.find(t => t.status === 'valid');

      if (!validToken) {
        api.notifications.showError('Not connected to Webflow. Open Settings → Webflow to connect.');
        return;
      }

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      api.notifications.showInfo(`Syncing components from "${config.siteName || 'Webflow'}"...`);

      try {
        const bunPath = process.env.BUN_BINARY_PATH || 'bun';

        await new Promise<void>((resolve, reject) => {
          // Token is read from .webflowrc.json by the CLI
          const proc = spawn(bunPath, ['run', 'webflow', 'devlink', 'sync'], {
            cwd: searchDir,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
          });

          let output = '';
          proc.stdout.on('data', (data: Buffer) => {
            output += data.toString();
          });
          proc.stderr.on('data', (data: Buffer) => {
            output += data.toString();
          });

          proc.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(output || `Process exited with code ${code}`));
            }
          });

          proc.on('error', reject);
        });

        api.notifications.showInfo('Components synced successfully!');
        api.log.info('DevLink sync completed');

      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);

        if (message.includes('not found') || message.includes('ENOENT')) {
          api.notifications.showError('Webflow CLI not found. Run "bun install" first.');
        } else {
          api.notifications.showError(`Sync failed: ${message.slice(0, 100)}`);
        }
        api.log.error('DevLink sync error:', e);
      }
    }
  );
  disposables.push(syncMenuDisposable);

  // Register keyboard shortcut for quick sync
  const keybindingDisposable = api.keybindings.register({
    key: 'cmd+shift+w',
    command: 'webflow.sync',
    when: 'global',
  });
  disposables.push(keybindingDisposable);

  // Register slates for custom file handlers
  const devlinkSlateDisposable = api.slates.register({
    id: 'devlink-project',
    name: 'Webflow DevLink Project',
    description: 'Manage DevLink component sync with Webflow Designer',
    icon: '🔗',
    patterns: ['.webflowrc.json'],
    component: 'WebflowDevLinkSlate',
  });
  disposables.push(devlinkSlateDisposable);

  const componentsSlateDisposable = api.slates.register({
    id: 'code-components',
    name: 'Webflow Code Components',
    description: 'Manage your Code Components library',
    icon: '📦',
    patterns: ['webflow.json'],
    component: 'WebflowComponentsSlate',
  });
  disposables.push(componentsSlateDisposable);

  const dashboardSlateDisposable = api.slates.register({
    id: 'dashboard',
    name: 'Webflow Dashboard',
    description: 'Overview of your Webflow sites and projects',
    icon: '🌐',
    patterns: [],
    component: 'WebflowDashboardSlate',
  });
  disposables.push(dashboardSlateDisposable);

  // Register commands
  const initCmdDisposable = api.commands.registerCommand('webflow.init', async () => {
    api.notifications.showInfo('Use "wf init" in terminal to initialize a Webflow project');
  });
  disposables.push(initCmdDisposable);

  const syncCmdDisposable = api.commands.registerCommand('webflow.sync', async () => {
    api.notifications.showInfo('Use "wf devlink pull" in terminal to sync components');
  });
  disposables.push(syncCmdDisposable);

  const shareCmdDisposable = api.commands.registerCommand('webflow.share', async () => {
    api.notifications.showInfo('Use "wf components share" in terminal to share your library');
  });
  disposables.push(shareCmdDisposable);

  const deployCmdDisposable = api.commands.registerCommand('webflow.deploy', async () => {
    api.notifications.showInfo('Use "wf cloud deploy" in terminal to deploy');
  });
  disposables.push(deployCmdDisposable);

  const uploadCmdDisposable = api.commands.registerCommand('webflow.uploadAssets', async () => {
    api.notifications.showInfo('Use "wf assets upload" in terminal to upload assets');
  });
  disposables.push(uploadCmdDisposable);

  api.log.info('Webflow plugin activated!');
}

/**
 * Called when the plugin is deactivated
 */
export async function deactivate(): Promise<void> {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
  client = null;
  storage = null;
}
