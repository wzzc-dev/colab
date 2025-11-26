/**
 * Plugin Manager - handles installation, loading, and lifecycle of plugins
 */

import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import {
  BUN_BINARY_PATH,
  COLAB_PLUGINS_PATH,
  COLAB_PLUGINS_REGISTRY_PATH,
} from '../consts/paths';
import { execSpawnSync } from '../utils/processUtils';
import type {
  InstalledPlugin,
  PluginManifest,
  PluginRegistry,
  PluginState,
  MainToWorkerMessage,
  WorkerToMainMessage,
  PluginAPI,
  PluginSettingsSchema,
  PluginSettingsValues,
  PluginEntitlements,
  EntitlementSummary,
} from './types';
import { DEFAULT_PERMISSIONS, summarizeEntitlements } from './types';

// ============================================================================
// Registry Management
// ============================================================================

const REGISTRY_VERSION = 1;

function loadRegistry(): PluginRegistry {
  if (!existsSync(COLAB_PLUGINS_REGISTRY_PATH)) {
    return { version: REGISTRY_VERSION, plugins: {} };
  }
  try {
    const data = readFileSync(COLAB_PLUGINS_REGISTRY_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load plugin registry:', e);
    return { version: REGISTRY_VERSION, plugins: {} };
  }
}

function saveRegistry(registry: PluginRegistry): void {
  writeFileSync(COLAB_PLUGINS_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

// ============================================================================
// Plugin Manager State
// ============================================================================

interface PluginWorkerState {
  worker: Worker | null; // null in v1 (no worker isolation)
  plugin: InstalledPlugin;
  pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout?: ReturnType<typeof setTimeout>;
  }>;
  module?: {
    activate?: (api: PluginAPI) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
  };
}

// Terminal command handler type
import type {
  TerminalCommandContext,
  CompletionProvider,
  CompletionContext,
  CompletionItem,
  StatusBarItem,
  FileDecorationProvider,
  FileDecoration,
  ContextMenuItem,
  KeyboardShortcut,
} from './types';
type TerminalCommandHandler = (ctx: TerminalCommandContext) => void | Promise<void>;
type ContextMenuHandler = (context: { filePath?: string; selection?: string }) => void | Promise<void>;

// Completion provider registration
interface RegisteredCompletionProvider {
  pluginName: string;
  languages: string[];
  provider: CompletionProvider;
}

// Registered status bar item with plugin info
interface RegisteredStatusBarItem {
  pluginName: string;
  item: StatusBarItem;
}

// Registered file decoration provider
interface RegisteredDecorationProvider {
  pluginName: string;
  provider: FileDecorationProvider;
}

// Registered context menu item
interface RegisteredContextMenuItem {
  pluginName: string;
  item: ContextMenuItem;
  handler: ContextMenuHandler;
}

// Registered keyboard shortcut
interface RegisteredKeybinding {
  pluginName: string;
  shortcut: KeyboardShortcut;
}

/** Settings change callback */
type SettingsChangeCallback = (key: string, value: string | number | boolean) => void;

/** Registered settings schema */
interface RegisteredSettingsSchema {
  pluginName: string;
  schema: PluginSettingsSchema;
}

class PluginManager {
  private registry: PluginRegistry;
  private activeWorkers: Map<string, PluginWorkerState> = new Map();
  private eventSubscribers: Map<string, Set<string>> = new Map(); // event -> plugin names
  private commandHandlers: Map<string, { pluginName: string; handler: (...args: unknown[]) => unknown }> = new Map(); // command id -> handler
  private preloadScripts: Map<string, Set<string>> = new Map(); // plugin name -> set of scripts
  private terminalCommands: Map<string, { pluginName: string; handler: TerminalCommandHandler }> = new Map(); // command name -> handler
  private completionProviders: Map<string, RegisteredCompletionProvider> = new Map(); // provider id -> provider
  private statusBarItems: Map<string, RegisteredStatusBarItem> = new Map(); // item id -> item
  private decorationProviders: Map<string, RegisteredDecorationProvider> = new Map(); // provider id -> provider
  private contextMenuItems: Map<string, RegisteredContextMenuItem> = new Map(); // item id -> item
  private keybindings: Map<string, RegisteredKeybinding> = new Map(); // keybinding id -> keybinding
  private settingsSchemas: Map<string, RegisteredSettingsSchema> = new Map(); // plugin name -> schema
  private settingsValues: Map<string, PluginSettingsValues> = new Map(); // plugin name -> values
  private settingsChangeCallbacks: Map<string, Set<SettingsChangeCallback>> = new Map(); // plugin name -> callbacks

  constructor() {
    this.registry = loadRegistry();
    this.loadAllPluginSettings();
  }

  // ==========================================================================
  // Settings Persistence
  // ==========================================================================

  private getSettingsFilePath(pluginName: string): string {
    return join(COLAB_PLUGINS_PATH, `${pluginName.replace(/\//g, '__')}.settings.json`);
  }

  private loadPluginSettings(pluginName: string): PluginSettingsValues {
    const settingsPath = this.getSettingsFilePath(pluginName);
    if (!existsSync(settingsPath)) {
      return {};
    }
    try {
      const data = readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error(`Failed to load settings for plugin ${pluginName}:`, e);
      return {};
    }
  }

  private savePluginSettings(pluginName: string): void {
    const values = this.settingsValues.get(pluginName) || {};
    const settingsPath = this.getSettingsFilePath(pluginName);
    try {
      writeFileSync(settingsPath, JSON.stringify(values, null, 2));
    } catch (e) {
      console.error(`Failed to save settings for plugin ${pluginName}:`, e);
    }
  }

  private loadAllPluginSettings(): void {
    for (const pluginName of Object.keys(this.registry.plugins)) {
      const values = this.loadPluginSettings(pluginName);
      this.settingsValues.set(pluginName, values);
    }
  }

  // ==========================================================================
  // Installation
  // ==========================================================================

  /**
   * Install a plugin from npm or a local folder path
   * @param packageNameOrPath - npm package name OR absolute path to local folder
   * @param version - optional version (only for npm packages)
   */
  async installPlugin(packageNameOrPath: string, version?: string): Promise<InstalledPlugin> {
    // Check if this is a local path
    const isLocalPath = packageNameOrPath.startsWith('/') ||
                        packageNameOrPath.startsWith('./') ||
                        packageNameOrPath.startsWith('../');

    if (isLocalPath) {
      return this.installFromLocalPath(packageNameOrPath);
    }

    return this.installFromNpm(packageNameOrPath, version);
  }

  /**
   * Install a plugin from a local folder path
   */
  async installFromLocalPath(localPath: string): Promise<InstalledPlugin> {
    console.info(`[PluginManager] Installing plugin from local path: ${localPath}`);

    // Verify the path exists and has a package.json
    const packageJsonPath = join(localPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error(`No package.json found at ${localPath}`);
    }

    // Read package.json to get the name
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const packageName = packageJson.name;

    if (!packageName) {
      throw new Error(`package.json at ${localPath} is missing a "name" field`);
    }

    // Use bun add with file: protocol for local packages
    // This creates a symlink in node_modules
    const fileSpec = `${packageName}@file:${localPath}`;
    console.info(`[PluginManager] Running: bun add ${fileSpec}`);

    const result = execSpawnSync(
      BUN_BINARY_PATH,
      ['add', fileSpec],
      { cwd: COLAB_PLUGINS_PATH }
    );

    console.info('[PluginManager] Install result:', result);

    // The package is now linked in node_modules
    const installedPath = join(COLAB_PLUGINS_PATH, 'node_modules', packageName);

    // Re-read package.json from the installed location (might be symlinked)
    const installedPackageJsonPath = join(installedPath, 'package.json');
    if (!existsSync(installedPackageJsonPath)) {
      throw new Error(`Failed to install plugin: package.json not found at ${installedPackageJsonPath}`);
    }

    const installedPackageJson = JSON.parse(readFileSync(installedPackageJsonPath, 'utf-8'));
    const manifest: PluginManifest = installedPackageJson['colab-plugin'] || {};

    const installedPlugin: InstalledPlugin = {
      name: installedPackageJson.name,
      version: installedPackageJson.version,
      manifest: {
        displayName: manifest.displayName || installedPackageJson.name,
        description: manifest.description || installedPackageJson.description,
        main: manifest.main || installedPackageJson.main || 'dist/index.js',
        icon: manifest.icon,
        contributes: manifest.contributes || {},
        permissions: { ...DEFAULT_PERMISSIONS, ...manifest.permissions },
        activationEvents: manifest.activationEvents || ['*'],
      },
      installPath: installedPath,
      state: 'installed',
      enabled: true,
      installedAt: Date.now(),
      updatedAt: Date.now(),
      // Mark as local for UI purposes
      isLocal: true,
      localPath: localPath,
    };

    // Update registry
    this.registry.plugins[packageName] = installedPlugin;
    saveRegistry(this.registry);

    // Auto-activate if enabled
    if (installedPlugin.enabled) {
      try {
        await this.activatePlugin(packageName);
      } catch (error) {
        console.warn(`[PluginManager] Failed to auto-activate ${packageName}:`, error);
        // Don't fail the install if activation fails
      }
    }

    return installedPlugin;
  }

  /**
   * Install a plugin from npm registry
   */
  async installFromNpm(packageName: string, version?: string): Promise<InstalledPlugin> {
    const packageSpec = version ? `${packageName}@${version}` : packageName;
    console.info(`[PluginManager] Installing plugin from npm: ${packageSpec}`);

    // Run bun install in the plugins directory
    const result = execSpawnSync(
      BUN_BINARY_PATH,
      ['add', '--exact', packageSpec],
      { cwd: COLAB_PLUGINS_PATH }
    );

    console.info('[PluginManager] Install result:', result);

    // Read the installed package.json to get manifest
    const packagePath = join(COLAB_PLUGINS_PATH, 'node_modules', packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (!existsSync(packageJsonPath)) {
      throw new Error(`Failed to install plugin: package.json not found at ${packageJsonPath}`);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const manifest: PluginManifest = packageJson['colab-plugin'] || {};

    const installedPlugin: InstalledPlugin = {
      name: packageJson.name,
      version: packageJson.version,
      manifest: {
        displayName: manifest.displayName || packageJson.name,
        description: manifest.description || packageJson.description,
        main: manifest.main || packageJson.main || 'dist/index.js',
        icon: manifest.icon,
        contributes: manifest.contributes || {},
        permissions: { ...DEFAULT_PERMISSIONS, ...manifest.permissions },
        activationEvents: manifest.activationEvents || ['*'],
      },
      installPath: packagePath,
      state: 'installed',
      enabled: true,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Update registry
    this.registry.plugins[packageName] = installedPlugin;
    saveRegistry(this.registry);

    // Auto-activate if enabled
    if (installedPlugin.enabled) {
      try {
        await this.activatePlugin(packageName);
      } catch (error) {
        console.warn(`[PluginManager] Failed to auto-activate ${packageName}:`, error);
        // Don't fail the install if activation fails
      }
    }

    return installedPlugin;
  }

  async uninstallPlugin(packageName: string): Promise<void> {
    console.info(`[PluginManager] Uninstalling plugin: ${packageName}`);

    // Deactivate if active
    if (this.activeWorkers.has(packageName)) {
      await this.deactivatePlugin(packageName);
    }

    // Run bun remove
    execSpawnSync(
      BUN_BINARY_PATH,
      ['remove', packageName],
      { cwd: COLAB_PLUGINS_PATH }
    );

    // Remove from registry
    delete this.registry.plugins[packageName];
    saveRegistry(this.registry);
  }

  async updatePlugin(packageName: string): Promise<InstalledPlugin> {
    console.info(`[PluginManager] Updating plugin: ${packageName}`);

    const wasActive = this.activeWorkers.has(packageName);
    if (wasActive) {
      await this.deactivatePlugin(packageName);
    }

    // Run bun update
    execSpawnSync(
      BUN_BINARY_PATH,
      ['update', packageName],
      { cwd: COLAB_PLUGINS_PATH }
    );

    // Re-read manifest
    const packagePath = join(COLAB_PLUGINS_PATH, 'node_modules', packageName);
    const packageJsonPath = join(packagePath, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const manifest: PluginManifest = packageJson['colab-plugin'] || {};

    const plugin = this.registry.plugins[packageName];
    plugin.version = packageJson.version;
    plugin.manifest = {
      ...plugin.manifest,
      ...manifest,
      permissions: { ...DEFAULT_PERMISSIONS, ...manifest.permissions },
    };
    plugin.updatedAt = Date.now();
    plugin.state = 'installed';

    saveRegistry(this.registry);

    if (wasActive) {
      await this.activatePlugin(packageName);
    }

    return plugin;
  }

  // ==========================================================================
  // Activation / Deactivation
  // ==========================================================================

  async activatePlugin(packageName: string): Promise<void> {
    const plugin = this.registry.plugins[packageName];
    if (!plugin) {
      throw new Error(`Plugin not found: ${packageName}`);
    }

    if (!plugin.enabled) {
      console.info(`[PluginManager] Plugin ${packageName} is disabled, skipping activation`);
      return;
    }

    if (this.activeWorkers.has(packageName)) {
      console.info(`[PluginManager] Plugin ${packageName} is already active`);
      return;
    }

    console.info(`[PluginManager] Activating plugin: ${packageName}`);
    plugin.state = 'activating';

    try {
      const entryPath = join(plugin.installPath, plugin.manifest.main || 'dist/index.js');
      if (!existsSync(entryPath)) {
        throw new Error(`Plugin entry point not found: ${entryPath}`);
      }

      console.info(`[PluginManager] Loading plugin from: ${entryPath}`);

      // For v1, load plugin directly in main process (no worker isolation)
      // TODO: Add worker isolation in v2
      const pluginModule = await import(entryPath);

      // Create a simple API for the plugin
      const api = this.createPluginAPI(packageName, plugin.manifest.permissions || DEFAULT_PERMISSIONS);

      // Store the module for later cleanup
      const pluginState: PluginWorkerState = {
        worker: null as any, // No worker in v1
        plugin,
        pendingRequests: new Map(),
        module: pluginModule,
      };

      this.activeWorkers.set(packageName, pluginState);

      // Call activate if it exists
      if (pluginModule.activate) {
        console.info(`[PluginManager] Calling activate() for ${packageName}`);
        await pluginModule.activate(api);
      } else {
        console.warn(`[PluginManager] Plugin ${packageName} has no activate function`);
      }

      plugin.state = 'active';
      plugin.error = undefined;

      // Note: Commands are now registered dynamically via api.commands.registerCommand()
      // in the plugin's activate() function, not from manifest.contributes.commands

      console.info(`[PluginManager] Plugin ${packageName} activated successfully`);
    } catch (error) {
      console.error(`[PluginManager] Failed to activate ${packageName}:`, error);
      plugin.state = 'error';
      plugin.error = error instanceof Error ? error.message : String(error);
      this.activeWorkers.delete(packageName);
      throw error;
    }
  }

  /**
   * Create a simple plugin API (v1 - runs in main process)
   */
  private createPluginAPI(pluginName: string, permissions: NonNullable<PluginManifest['permissions']>): PluginAPI {
    const self = this;

    return {
      plugin: {
        name: pluginName,
        version: this.registry.plugins[pluginName]?.version || '0.0.0',
      },

      commands: {
        registerCommand(id: string, handler: (...args: unknown[]) => unknown) {
          const fullId = id.includes('.') ? id : `${pluginName}.${id}`;
          self.commandHandlers.set(fullId, { pluginName, handler });
          return {
            dispose: () => {
              self.commandHandlers.delete(fullId);
            },
          };
        },
        async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
          return self.executeCommand(id, ...args) as Promise<T>;
        },
      },

      webview: {
        registerPreloadScript(script: string) {
          if (!self.preloadScripts.has(pluginName)) {
            self.preloadScripts.set(pluginName, new Set());
          }
          self.preloadScripts.get(pluginName)!.add(script);
          console.info(`[PluginManager] Plugin ${pluginName} registered preload script`);
          return {
            dispose: () => {
              self.preloadScripts.get(pluginName)?.delete(script);
            },
          };
        },
      },

      workspace: {
        async getWorkspaceFolders() {
          // TODO: implement
          return [];
        },
        async readFile(path: string) {
          if (permissions.fs === 'none') {
            throw new Error('Permission denied: fs access required');
          }
          const { readFileSync } = await import('fs');
          return readFileSync(path, 'utf-8');
        },
        async writeFile(path: string, content: string) {
          if (permissions.fs !== 'readwrite') {
            throw new Error('Permission denied: fs:readwrite access required');
          }
          const { writeFileSync } = await import('fs');
          writeFileSync(path, content);
        },
        async exists(path: string) {
          const { existsSync } = await import('fs');
          return existsSync(path);
        },
        async findFiles(pattern: string) {
          // TODO: implement
          return [];
        },
      },

      editor: {
        async getActiveEditor() {
          return null;
        },
        async getSelection() {
          return null;
        },
        async insertText(text: string) {
          // TODO: implement
        },
        registerCompletionProvider(languages: string[], provider: CompletionProvider) {
          const providerId = `${pluginName}-${Date.now()}`;
          self.completionProviders.set(providerId, {
            pluginName,
            languages,
            provider,
          });
          console.info(`[PluginManager] Plugin ${pluginName} registered completion provider for: ${languages.join(', ')}`);
          return {
            dispose: () => {
              self.completionProviders.delete(providerId);
            },
          };
        },
      },

      terminal: {
        async createTerminal(options: { name?: string; cwd?: string }) {
          if (permissions.terminal === 'none') {
            throw new Error('Permission denied: terminal access required');
          }
          // TODO: implement
          return '';
        },
        async sendText(terminalId: string, text: string) {
          if (permissions.terminal !== 'readwrite') {
            throw new Error('Permission denied: terminal:readwrite access required');
          }
          // TODO: implement
        },
        registerCommand(name: string, handler: TerminalCommandHandler) {
          if (self.terminalCommands.has(name)) {
            console.warn(`[PluginManager] Terminal command "${name}" already registered, overwriting`);
          }
          self.terminalCommands.set(name, { pluginName, handler });
          console.info(`[PluginManager] Plugin ${pluginName} registered terminal command: ${name}`);
          return {
            dispose: () => {
              const existing = self.terminalCommands.get(name);
              if (existing?.pluginName === pluginName) {
                self.terminalCommands.delete(name);
              }
            },
          };
        },
      },

      notifications: {
        showInfo(message: string) {
          console.info(`[Plugin:${pluginName}] INFO: ${message}`);
          // TODO: Show actual UI notification
        },
        showWarning(message: string) {
          console.warn(`[Plugin:${pluginName}] WARNING: ${message}`);
        },
        showError(message: string) {
          console.error(`[Plugin:${pluginName}] ERROR: ${message}`);
        },
      },

      log: {
        debug: (message: string, ...args: unknown[]) => console.debug(`[Plugin:${pluginName}]`, message, ...args),
        info: (message: string, ...args: unknown[]) => console.info(`[Plugin:${pluginName}]`, message, ...args),
        warn: (message: string, ...args: unknown[]) => console.warn(`[Plugin:${pluginName}]`, message, ...args),
        error: (message: string, ...args: unknown[]) => console.error(`[Plugin:${pluginName}]`, message, ...args),
      },

      git: {
        async getStatus(repoRoot: string) {
          if (permissions.git === 'none') {
            throw new Error('Permission denied: git access required');
          }
          // TODO: implement
          return {};
        },
        async getBranch(repoRoot: string) {
          if (permissions.git === 'none') {
            throw new Error('Permission denied: git access required');
          }
          // TODO: implement
          return '';
        },
      },

      configuration: {
        async get<T>(key: string) {
          // TODO: implement
          return undefined as T | undefined;
        },
        async update(key: string, value: unknown) {
          // TODO: implement
        },
      },

      events: {
        onFileChange(callback: (event: any) => void) {
          // TODO: implement
          return { dispose: () => {} };
        },
        onActiveEditorChange(callback: (editor: any) => void) {
          // TODO: implement
          return { dispose: () => {} };
        },
      },

      statusBar: {
        createItem(item: StatusBarItem) {
          const fullId = `${pluginName}.${item.id}`;
          self.statusBarItems.set(fullId, { pluginName, item: { ...item, id: fullId } });
          console.info(`[PluginManager] Plugin ${pluginName} created status bar item: ${item.id}`);

          return {
            update(updates: Partial<Omit<StatusBarItem, 'id'>>) {
              const existing = self.statusBarItems.get(fullId);
              if (existing) {
                existing.item = { ...existing.item, ...updates };
              }
            },
            dispose() {
              self.statusBarItems.delete(fullId);
            },
          };
        },
      },

      fileDecorations: {
        registerProvider(provider: FileDecorationProvider) {
          const providerId = `${pluginName}-${Date.now()}`;
          self.decorationProviders.set(providerId, { pluginName, provider });
          console.info(`[PluginManager] Plugin ${pluginName} registered file decoration provider`);

          return {
            dispose() {
              self.decorationProviders.delete(providerId);
            },
          };
        },
      },

      contextMenu: {
        registerItem(item: ContextMenuItem, handler: ContextMenuHandler) {
          const fullId = `${pluginName}.${item.id}`;
          self.contextMenuItems.set(fullId, {
            pluginName,
            item: { ...item, id: fullId },
            handler,
          });
          console.info(`[PluginManager] Plugin ${pluginName} registered context menu item: ${item.label}`);

          return {
            dispose() {
              self.contextMenuItems.delete(fullId);
            },
          };
        },
      },

      keybindings: {
        register(shortcut: KeyboardShortcut) {
          const keybindingId = `${pluginName}.${shortcut.key}`;
          self.keybindings.set(keybindingId, { pluginName, shortcut });
          console.info(`[PluginManager] Plugin ${pluginName} registered keybinding: ${shortcut.key} -> ${shortcut.command}`);

          return {
            dispose() {
              self.keybindings.delete(keybindingId);
            },
          };
        },
      },

      settings: {
        registerSchema(schema: PluginSettingsSchema) {
          self.settingsSchemas.set(pluginName, { pluginName, schema });
          // Initialize settings values with defaults if not already set
          const currentValues = self.settingsValues.get(pluginName) || {};
          let hasChanges = false;
          for (const field of schema.fields) {
            if (!(field.key in currentValues) && field.default !== undefined) {
              currentValues[field.key] = field.default;
              hasChanges = true;
            }
          }
          if (hasChanges) {
            self.settingsValues.set(pluginName, currentValues);
            self.savePluginSettings(pluginName);
          }
          console.info(`[PluginManager] Plugin ${pluginName} registered settings schema with ${schema.fields.length} fields`);

          return {
            dispose() {
              self.settingsSchemas.delete(pluginName);
            },
          };
        },
        get<T extends string | number | boolean>(key: string): T | undefined {
          const values = self.settingsValues.get(pluginName) || {};
          if (key in values) {
            return values[key] as T;
          }
          // Check for default value in schema
          const schema = self.settingsSchemas.get(pluginName);
          if (schema) {
            const field = schema.schema.fields.find(f => f.key === key);
            if (field?.default !== undefined) {
              return field.default as T;
            }
          }
          return undefined;
        },
        set(key: string, value: string | number | boolean) {
          const values = self.settingsValues.get(pluginName) || {};
          const oldValue = values[key];
          values[key] = value;
          self.settingsValues.set(pluginName, values);
          self.savePluginSettings(pluginName);

          // Notify callbacks if value changed
          if (oldValue !== value) {
            const callbacks = self.settingsChangeCallbacks.get(pluginName);
            if (callbacks) {
              for (const callback of callbacks) {
                try {
                  callback(key, value);
                } catch (e) {
                  console.error(`[PluginManager] Error in settings change callback for ${pluginName}:`, e);
                }
              }
            }
          }
        },
        getAll(): PluginSettingsValues {
          return { ...(self.settingsValues.get(pluginName) || {}) };
        },
        onChange(callback: SettingsChangeCallback) {
          if (!self.settingsChangeCallbacks.has(pluginName)) {
            self.settingsChangeCallbacks.set(pluginName, new Set());
          }
          self.settingsChangeCallbacks.get(pluginName)!.add(callback);

          return {
            dispose() {
              self.settingsChangeCallbacks.get(pluginName)?.delete(callback);
            },
          };
        },
      },
    } as PluginAPI;
  }

  async deactivatePlugin(packageName: string): Promise<void> {
    const workerState = this.activeWorkers.get(packageName);
    if (!workerState) {
      return;
    }

    console.info(`[PluginManager] Deactivating plugin: ${packageName}`);
    workerState.plugin.state = 'deactivating';

    try {
      // V1: Call deactivate directly on the module
      if (workerState.module?.deactivate) {
        await workerState.module.deactivate();
      }
    } catch (error) {
      console.warn(`[PluginManager] Error during deactivation of ${packageName}:`, error);
    }

    // Cleanup
    if (workerState.worker) {
      workerState.worker.terminate();
    }
    this.activeWorkers.delete(packageName);

    // Unregister commands (both manifest and dynamically registered)
    if (workerState.plugin.manifest.contributes?.commands) {
      for (const cmd of workerState.plugin.manifest.contributes.commands) {
        this.commandHandlers.delete(cmd.id);
      }
    }
    // Also clean up dynamically registered commands
    for (const [cmdId, registration] of this.commandHandlers) {
      if (registration.pluginName === packageName) {
        this.commandHandlers.delete(cmdId);
      }
    }

    // Unregister preload scripts
    this.preloadScripts.delete(packageName);

    // Unregister terminal commands
    for (const [cmdName, cmd] of this.terminalCommands) {
      if (cmd.pluginName === packageName) {
        this.terminalCommands.delete(cmdName);
      }
    }

    // Unregister completion providers
    for (const [providerId, provider] of this.completionProviders) {
      if (provider.pluginName === packageName) {
        this.completionProviders.delete(providerId);
      }
    }

    // Unregister status bar items
    for (const [itemId, item] of this.statusBarItems) {
      if (item.pluginName === packageName) {
        this.statusBarItems.delete(itemId);
      }
    }

    // Unregister decoration providers
    for (const [providerId, provider] of this.decorationProviders) {
      if (provider.pluginName === packageName) {
        this.decorationProviders.delete(providerId);
      }
    }

    // Unregister context menu items
    for (const [itemId, item] of this.contextMenuItems) {
      if (item.pluginName === packageName) {
        this.contextMenuItems.delete(itemId);
      }
    }

    // Unregister keybindings
    for (const [keybindingId, keybinding] of this.keybindings) {
      if (keybinding.pluginName === packageName) {
        this.keybindings.delete(keybindingId);
      }
    }

    workerState.plugin.state = 'inactive';
    console.info(`[PluginManager] Plugin ${packageName} deactivated`);
  }

  // ==========================================================================
  // Command Execution
  // ==========================================================================

  async executeCommand(commandId: string, ...args: unknown[]): Promise<unknown> {
    const registration = this.commandHandlers.get(commandId);
    if (!registration) {
      throw new Error(`No handler registered for command: ${commandId}`);
    }

    const { pluginName, handler } = registration;

    // Verify plugin is still active
    if (!this.activeWorkers.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} is not active`);
    }

    // Directly call the handler (v1 direct module loading approach)
    try {
      return await Promise.resolve(handler(...args));
    } catch (error) {
      console.error(`[PluginManager] Command ${commandId} failed:`, error);
      throw error;
    }
  }

  // ==========================================================================
  // Event Broadcasting
  // ==========================================================================

  broadcastEvent(eventType: string, payload: unknown): void {
    for (const [name, workerState] of this.activeWorkers) {
      const msg: MainToWorkerMessage = {
        type: 'event',
        eventType,
        payload,
      };
      workerState.worker.postMessage(msg);
    }
  }

  // ==========================================================================
  // API Request Handling (from workers)
  // ==========================================================================

  private handleWorkerMessage(pluginName: string, message: WorkerToMainMessage): void {
    const workerState = this.activeWorkers.get(pluginName);

    switch (message.type) {
      case 'ready':
        // Worker is ready to receive activation
        break;

      case 'activated':
        // Plugin activated successfully
        if (workerState) {
          workerState.plugin.state = 'active';
        }
        break;

      case 'deactivated':
        if (workerState) {
          workerState.plugin.state = 'inactive';
        }
        break;

      case 'error':
        console.error(`[Plugin:${pluginName}] Error:`, message.error);
        if (workerState) {
          workerState.plugin.error = message.error;
        }
        break;

      case 'request':
        // Plugin is requesting something from the main process
        this.handlePluginRequest(pluginName, message.requestId, message.method, message.params);
        break;

      case 'log':
        const prefix = `[Plugin:${pluginName}]`;
        switch (message.level) {
          case 'debug':
            console.debug(prefix, message.message, ...(message.args || []));
            break;
          case 'info':
            console.info(prefix, message.message, ...(message.args || []));
            break;
          case 'warn':
            console.warn(prefix, message.message, ...(message.args || []));
            break;
          case 'error':
            console.error(prefix, message.message, ...(message.args || []));
            break;
        }
        break;
    }
  }

  private async handlePluginRequest(
    pluginName: string,
    requestId: string,
    method: string,
    params: unknown
  ): Promise<void> {
    const workerState = this.activeWorkers.get(pluginName);
    if (!workerState) return;

    const plugin = workerState.plugin;
    const permissions = plugin.manifest.permissions || DEFAULT_PERMISSIONS;

    let result: unknown;
    let error: string | undefined;

    try {
      result = await this.executeApiMethod(pluginName, permissions, method, params);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    const response: MainToWorkerMessage = {
      type: 'response',
      requestId,
      result,
      error,
    };
    workerState.worker.postMessage(response);
  }

  private async executeApiMethod(
    pluginName: string,
    permissions: NonNullable<PluginManifest['permissions']>,
    method: string,
    params: unknown
  ): Promise<unknown> {
    // This will be expanded to call actual colab APIs
    // For now, implement basic permission checks and stubs

    const [namespace, action] = method.split('.');

    switch (namespace) {
      case 'workspace':
        if (action === 'readFile') {
          if (permissions.fs === 'none') {
            throw new Error('Permission denied: fs access required');
          }
          // TODO: implement actual file read
          return '';
        }
        if (action === 'writeFile') {
          if (permissions.fs !== 'readwrite') {
            throw new Error('Permission denied: fs:readwrite access required');
          }
          // TODO: implement actual file write
          return;
        }
        break;

      case 'git':
        if (permissions.git === 'none') {
          throw new Error('Permission denied: git access required');
        }
        // TODO: implement git operations
        break;

      case 'terminal':
        if (permissions.terminal === 'none') {
          throw new Error('Permission denied: terminal access required');
        }
        // TODO: implement terminal operations
        break;

      case 'notifications':
        // Notifications are allowed if permission is not explicitly false
        if (permissions.notifications === false) {
          throw new Error('Permission denied: notifications access required');
        }
        const notifParams = params as { message: string };
        console.info(`[Plugin:${pluginName}] Notification (${action}):`, notifParams.message);
        // TODO: implement actual UI notifications
        // For now, just log to console
        return;

      default:
        console.warn(`[PluginManager] Unknown API method: ${method}`);
        throw new Error(`Unknown API method: ${method}`);
    }

    return undefined;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private waitForWorkerReady(pluginName: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerState = this.activeWorkers.get(pluginName);
      if (!workerState) {
        reject(new Error('Worker not found'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Worker ready timeout'));
      }, timeout);

      const originalHandler = workerState.worker.onmessage;
      workerState.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
        if (event.data.type === 'ready') {
          clearTimeout(timeoutId);
          workerState.worker.onmessage = originalHandler;
          resolve();
        }
        originalHandler?.call(workerState.worker, event);
      };
    });
  }

  private waitForActivation(pluginName: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const workerState = this.activeWorkers.get(pluginName);
      if (!workerState) {
        reject(new Error('Worker not found'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Activation timeout'));
      }, timeout);

      const checkActivated = () => {
        if (workerState.plugin.state === 'active') {
          clearTimeout(timeoutId);
          resolve();
        } else if (workerState.plugin.state === 'error') {
          clearTimeout(timeoutId);
          reject(new Error(workerState.plugin.error || 'Activation failed'));
        } else {
          setTimeout(checkActivated, 100);
        }
      };
      checkActivated();
    });
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  getInstalledPlugins(): InstalledPlugin[] {
    return Object.values(this.registry.plugins);
  }

  getPlugin(name: string): InstalledPlugin | undefined {
    return this.registry.plugins[name];
  }

  isPluginActive(name: string): boolean {
    return this.activeWorkers.has(name);
  }

  setPluginEnabled(name: string, enabled: boolean): void {
    const plugin = this.registry.plugins[name];
    if (plugin) {
      plugin.enabled = enabled;
      saveRegistry(this.registry);

      if (!enabled && this.activeWorkers.has(name)) {
        this.deactivatePlugin(name);
      }
    }
  }

  /**
   * Refresh the manifest from disk for a plugin (useful for local dev plugins)
   */
  private refreshPluginManifest(name: string): PluginManifest | undefined {
    const plugin = this.registry.plugins[name];
    if (!plugin) return undefined;

    try {
      const packageJsonPath = join(plugin.installPath, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const manifest: PluginManifest = packageJson['colab-plugin'] || {};
        // Update the cached manifest
        plugin.manifest = manifest;
        return manifest;
      }
    } catch (e) {
      console.error(`[PluginManager] Failed to refresh manifest for ${name}:`, e);
    }
    return plugin.manifest;
  }

  /**
   * Get entitlements summary for a plugin
   */
  getPluginEntitlements(name: string): EntitlementSummary[] {
    const plugin = this.registry.plugins[name];
    if (!plugin) return [];
    // Refresh manifest from disk to get latest entitlements (especially for local dev plugins)
    const manifest = this.refreshPluginManifest(name);
    return summarizeEntitlements(manifest?.entitlements);
  }

  /**
   * Get raw entitlements for a plugin
   */
  getPluginEntitlementsRaw(name: string): PluginEntitlements | undefined {
    const plugin = this.registry.plugins[name];
    if (!plugin) return undefined;
    // Refresh manifest from disk to get latest entitlements
    const manifest = this.refreshPluginManifest(name);
    return manifest?.entitlements;
  }

  /**
   * Get all registered preload scripts from active plugins
   * Returns a combined script string ready for injection
   */
  getAllPreloadScripts(): string {
    console.info(`[PluginManager] getAllPreloadScripts called. Active plugins: ${this.activeWorkers.size}, Preload scripts registered: ${this.preloadScripts.size}`);
    const scripts: string[] = [];
    for (const [pluginName, pluginScripts] of this.preloadScripts) {
      // Only include scripts from active plugins
      if (this.activeWorkers.has(pluginName)) {
        console.info(`[PluginManager] Including ${pluginScripts.size} preload script(s) from ${pluginName}`);
        for (const script of pluginScripts) {
          scripts.push(`// Plugin: ${pluginName}\n${script}`);
        }
      }
    }
    console.info(`[PluginManager] Returning ${scripts.length} total preload scripts`);
    return scripts.join('\n\n');
  }

  /**
   * Check if a command line matches a registered terminal command
   * @param commandLine - The full command line entered by user
   * @returns The command name if it matches, null otherwise
   */
  getTerminalCommand(commandLine: string): string | null {
    const trimmed = commandLine.trim();
    const commandName = trimmed.split(/\s+/)[0];
    if (this.terminalCommands.has(commandName)) {
      return commandName;
    }
    return null;
  }

  /**
   * Execute a registered terminal command
   * @param commandLine - The full command line entered by user
   * @param terminalId - The terminal ID
   * @param cwd - Current working directory of the terminal
   * @param write - Function to write output back to the terminal
   * @returns true if command was handled, false if not a plugin command
   */
  async executeTerminalCommand(
    commandLine: string,
    terminalId: string,
    cwd: string,
    write: (text: string) => void
  ): Promise<boolean> {
    const trimmed = commandLine.trim();
    const parts = trimmed.split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    const cmd = this.terminalCommands.get(commandName);
    if (!cmd) {
      return false;
    }

    console.info(`[PluginManager] Executing terminal command "${commandName}" from plugin ${cmd.pluginName}`);

    const ctx: TerminalCommandContext = {
      args,
      cwd,
      terminalId,
      write,
    };

    try {
      await cmd.handler(ctx);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      write(`\x1b[31mError: ${errorMsg}\x1b[0m\r\n`);
      console.error(`[PluginManager] Terminal command "${commandName}" failed:`, error);
    }

    return true;
  }

  // ==========================================================================
  // Editor Completions
  // ==========================================================================

  /**
   * Get completions from all registered plugin providers for a given language
   * @param language - The language ID (e.g., 'typescript')
   * @param context - The completion context
   * @returns Array of completion items from all matching providers
   */
  async getCompletions(language: string, context: CompletionContext): Promise<CompletionItem[]> {
    const allCompletions: CompletionItem[] = [];

    for (const [, registered] of this.completionProviders) {
      // Check if this provider handles this language
      if (!registered.languages.includes(language)) {
        continue;
      }

      try {
        const items = await registered.provider.provideCompletions(context);
        allCompletions.push(...items);
      } catch (error) {
        console.error(`[PluginManager] Completion provider from ${registered.pluginName} failed:`, error);
      }
    }

    return allCompletions;
  }

  /**
   * Get all trigger characters from registered completion providers for a language
   */
  getTriggerCharacters(language: string): string[] {
    const triggers = new Set<string>();

    for (const [, registered] of this.completionProviders) {
      if (registered.languages.includes(language) && registered.provider.triggerCharacters) {
        for (const char of registered.provider.triggerCharacters) {
          triggers.add(char);
        }
      }
    }

    return Array.from(triggers);
  }

  // ==========================================================================
  // Status Bar Items
  // ==========================================================================

  /**
   * Get all status bar items from plugins
   */
  getStatusBarItems(): Array<StatusBarItem & { pluginName: string; hasSettings: boolean }> {
    return Array.from(this.statusBarItems.values()).map(r => ({
      ...r.item,
      pluginName: r.pluginName,
      hasSettings: this.settingsSchemas.has(r.pluginName),
    }));
  }

  // ==========================================================================
  // File Decorations
  // ==========================================================================

  /**
   * Get file decoration for a given path from all providers
   */
  async getFileDecoration(filePath: string): Promise<FileDecoration | undefined> {
    for (const [, registered] of this.decorationProviders) {
      try {
        const decoration = await registered.provider.provideDecoration(filePath);
        if (decoration) {
          return decoration;
        }
      } catch (error) {
        console.error(`[PluginManager] File decoration provider failed for ${filePath}:`, error);
      }
    }
    return undefined;
  }

  // ==========================================================================
  // Context Menu Items
  // ==========================================================================

  /**
   * Get context menu items for a given context
   */
  getContextMenuItems(contextType: 'editor' | 'fileTree'): Array<{ id: string; label: string; shortcutHint?: string }> {
    const items: Array<{ id: string; label: string; shortcutHint?: string }> = [];

    for (const [, registered] of this.contextMenuItems) {
      if (registered.item.context === contextType || registered.item.context === 'both') {
        items.push({
          id: registered.item.id,
          label: registered.item.label,
          shortcutHint: registered.item.shortcutHint,
        });
      }
    }

    return items;
  }

  /**
   * Execute a context menu item handler
   */
  async executeContextMenuItem(itemId: string, context: { filePath?: string; selection?: string }): Promise<void> {
    const registered = this.contextMenuItems.get(itemId);
    if (!registered) {
      console.warn(`[PluginManager] Context menu item not found: ${itemId}`);
      return;
    }

    try {
      await registered.handler(context);
    } catch (error) {
      console.error(`[PluginManager] Context menu handler failed for ${itemId}:`, error);
    }
  }

  // ==========================================================================
  // Keybindings
  // ==========================================================================

  /**
   * Get all registered keybindings
   */
  getKeybindings(): KeyboardShortcut[] {
    return Array.from(this.keybindings.values()).map(r => r.shortcut);
  }

  // ==========================================================================
  // Plugin Settings (for renderer)
  // ==========================================================================

  /**
   * Get all plugins that have registered settings schemas
   */
  getPluginsWithSettings(): Array<{ pluginName: string; displayName?: string; schema: PluginSettingsSchema }> {
    const result: Array<{ pluginName: string; displayName?: string; schema: PluginSettingsSchema }> = [];
    for (const [pluginName, registered] of this.settingsSchemas) {
      const plugin = this.registry.plugins[pluginName];
      result.push({
        pluginName,
        displayName: plugin?.manifest.displayName,
        schema: registered.schema,
      });
    }
    return result;
  }

  /**
   * Get settings schema for a specific plugin
   */
  getPluginSettingsSchema(pluginName: string): PluginSettingsSchema | null {
    return this.settingsSchemas.get(pluginName)?.schema || null;
  }

  /**
   * Get current settings values for a plugin
   */
  getPluginSettingsValues(pluginName: string): PluginSettingsValues {
    return { ...(this.settingsValues.get(pluginName) || {}) };
  }

  /**
   * Update a setting value from the renderer
   * This is called from the settings panel
   */
  setPluginSettingValue(pluginName: string, key: string, value: string | number | boolean): void {
    const values = this.settingsValues.get(pluginName) || {};
    const oldValue = values[key];
    values[key] = value;
    this.settingsValues.set(pluginName, values);
    this.savePluginSettings(pluginName);

    // Notify callbacks if value changed
    if (oldValue !== value) {
      const callbacks = this.settingsChangeCallbacks.get(pluginName);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback(key, value);
          } catch (e) {
            console.error(`[PluginManager] Error in settings change callback for ${pluginName}:`, e);
          }
        }
      }
    }
  }

  /**
   * Check if a plugin has a settings schema registered
   */
  hasPluginSettings(pluginName: string): boolean {
    return this.settingsSchemas.has(pluginName);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async activateAllEnabled(): Promise<void> {
    const plugins = Object.values(this.registry.plugins).filter(p => p.enabled);
    for (const plugin of plugins) {
      try {
        await this.activatePlugin(plugin.name);
      } catch (error) {
        console.error(`[PluginManager] Failed to activate ${plugin.name}:`, error);
      }
    }
  }

  async deactivateAll(): Promise<void> {
    const activeNames = Array.from(this.activeWorkers.keys());
    for (const name of activeNames) {
      try {
        await this.deactivatePlugin(name);
      } catch (error) {
        console.error(`[PluginManager] Failed to deactivate ${name}:`, error);
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.deactivateAll();
    saveRegistry(this.registry);
  }
}

// Singleton export
export const pluginManager = new PluginManager();
