/**
 * Plugin system types for Colab
 *
 * Plugins are npm packages with a "colab-plugin" field in package.json.
 * They run in isolated Bun Workers with a controlled API surface.
 */

// ============================================================================
// Manifest Types (package.json "colab-plugin" field)
// ============================================================================

export interface PluginManifest {
  /** Plugin display name */
  displayName?: string;
  /** Plugin description */
  description?: string;
  /** Entry point file (relative to package root, defaults to "main" or "dist/index.js") */
  main?: string;
  /** Icon URL or path */
  icon?: string;
  /** What the plugin contributes to Colab */
  contributes?: PluginContributes;
  /** Permissions the plugin requires */
  permissions?: PluginPermissions;
  /** Activation events - when should this plugin be loaded */
  activationEvents?: ActivationEvent[];
}

export interface PluginContributes {
  /** Commands the plugin registers */
  commands?: PluginCommand[];
  /** Language IDs the plugin supports */
  languageSupport?: string[];
  /** Webview lifecycle hooks */
  webviewHooks?: WebviewHook[];
  /** File tree contributions */
  fileTree?: FileTreeContribution[];
  /** Editor contributions */
  editor?: EditorContribution[];
  /** Terminal contributions */
  terminal?: TerminalContribution[];
  /** Settings/configuration schema */
  configuration?: PluginConfigurationSchema;
}

export interface PluginCommand {
  /** Unique command ID (namespaced: "myPlugin.doThing") */
  id: string;
  /** Display title for command palette */
  title: string;
  /** Optional category for grouping */
  category?: string;
  /** Keyboard shortcut (e.g., "Cmd+Shift+L") */
  keybinding?: string;
}

export type WebviewHook =
  | 'beforeNavigate'
  | 'afterNavigate'
  | 'onLoad'
  | 'onUnload';

export type FileTreeContribution =
  | 'contextMenuItems'
  | 'decorations'
  | 'dragDrop';

export type EditorContribution =
  | 'codeActions'
  | 'completions'
  | 'diagnostics'
  | 'hover'
  | 'formatting'
  | 'codeLen';

export type TerminalContribution =
  | 'ptyHooks'
  | 'shellIntegration';

export interface PluginConfigurationSchema {
  /** JSON Schema for plugin settings */
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    default?: unknown;
    description?: string;
    enum?: unknown[];
  }>;
}

// ============================================================================
// Permissions
// ============================================================================

export interface PluginPermissions {
  /** File system access level */
  fs?: 'none' | 'readonly' | 'readwrite';
  /** Network access */
  network?: 'none' | 'allow';
  /** AI model access */
  aiModels?: 'none' | 'allow';
  /** Clipboard access */
  clipboard?: 'none' | 'read' | 'readwrite';
  /** Git operations */
  git?: 'none' | 'readonly' | 'readwrite';
  /** Terminal access */
  terminal?: 'none' | 'readonly' | 'readwrite';
  /** Can show notifications */
  notifications?: boolean;
}

export const DEFAULT_PERMISSIONS: PluginPermissions = {
  fs: 'none',
  network: 'none',
  aiModels: 'none',
  clipboard: 'none',
  git: 'none',
  terminal: 'none',
  notifications: false,
};

// ============================================================================
// Activation Events
// ============================================================================

export type ActivationEvent =
  | '*'  // Always activate on startup
  | `onCommand:${string}`
  | `onLanguage:${string}`
  | `onFileOpen:${string}`  // glob pattern
  | `workspaceContains:${string}`;  // glob pattern

// ============================================================================
// Plugin Runtime Types
// ============================================================================

export type PluginState =
  | 'installed'     // Downloaded but not loaded
  | 'activating'    // Worker starting, calling activate()
  | 'active'        // Running
  | 'deactivating'  // Calling deactivate()
  | 'inactive'      // Loaded but not running
  | 'error';        // Failed to load/activate

export interface InstalledPlugin {
  /** npm package name */
  name: string;
  /** npm package version */
  version: string;
  /** Resolved manifest from package.json */
  manifest: PluginManifest;
  /** Path to installed package */
  installPath: string;
  /** Current state */
  state: PluginState;
  /** Error message if state is 'error' */
  error?: string;
  /** Whether plugin is enabled by user */
  enabled: boolean;
  /** When the plugin was installed */
  installedAt: number;
  /** When the plugin was last updated */
  updatedAt: number;
  /** Whether this is a local/dev plugin installed from a folder */
  isLocal?: boolean;
  /** Original local path if installed from folder */
  localPath?: string;
}

// ============================================================================
// Plugin Registry (persisted)
// ============================================================================

export interface PluginRegistry {
  /** Schema version for migrations */
  version: number;
  /** Installed plugins by name */
  plugins: Record<string, InstalledPlugin>;
}

// ============================================================================
// Worker Message Types (Main <-> Worker communication)
// ============================================================================

export type MainToWorkerMessage =
  | { type: 'activate'; pluginName: string; config: unknown }
  | { type: 'deactivate' }
  | { type: 'command'; commandId: string; args?: unknown[] }
  | { type: 'event'; eventType: string; payload: unknown }
  | { type: 'response'; requestId: string; result?: unknown; error?: string };

export type WorkerToMainMessage =
  | { type: 'ready' }
  | { type: 'activated' }
  | { type: 'deactivated' }
  | { type: 'error'; error: string }
  | { type: 'request'; requestId: string; method: string; params: unknown }
  | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string; args?: unknown[] };

// ============================================================================
// Plugin API Types (what plugins can call)
// ============================================================================

export interface PluginAPI {
  /** Plugin metadata */
  readonly plugin: {
    readonly name: string;
    readonly version: string;
  };

  /** Commands registration and execution */
  commands: {
    registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;
    executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T>;
  };

  /** Webview operations */
  webview: {
    /** Register a preload script to be injected into all webviews */
    registerPreloadScript(script: string): Disposable;
  };

  /** Workspace operations (scoped by permissions) */
  workspace: {
    /** Get open workspace folders */
    getWorkspaceFolders(): Promise<WorkspaceFolder[]>;
    /** Read a file (requires fs permission) */
    readFile(path: string): Promise<string>;
    /** Write a file (requires fs:readwrite permission) */
    writeFile(path: string, content: string): Promise<void>;
    /** Check if file exists */
    exists(path: string): Promise<boolean>;
    /** Find files matching pattern */
    findFiles(pattern: string): Promise<string[]>;
  };

  /** Editor operations */
  editor: {
    /** Get active editor info */
    getActiveEditor(): Promise<EditorInfo | null>;
    /** Get selected text in active editor */
    getSelection(): Promise<string | null>;
    /** Insert text at cursor position */
    insertText(text: string): Promise<void>;
    /**
     * Register a completion item provider for code suggestions
     * @param languages - Array of language IDs (e.g., ['typescript', 'javascript'])
     * @param provider - The completion provider
     */
    registerCompletionProvider(
      languages: string[],
      provider: CompletionProvider
    ): Disposable;
  };

  /** Terminal operations (requires terminal permission) */
  terminal: {
    /** Create a new terminal */
    createTerminal(options: { name?: string; cwd?: string }): Promise<string>;
    /** Send text to terminal */
    sendText(terminalId: string, text: string): Promise<void>;
    /**
     * Register a terminal command that can be invoked by typing its name in any terminal.
     * The handler receives a context object with args, cwd, write function, etc.
     * @param name - Command name (e.g., "catify" - user types "catify" in terminal)
     * @param handler - Function that handles the command
     */
    registerCommand(
      name: string,
      handler: (ctx: TerminalCommandContext) => void | Promise<void>
    ): Disposable;
  };

  /** UI notifications */
  notifications: {
    /** Show info message */
    showInfo(message: string): void;
    /** Show warning message */
    showWarning(message: string): void;
    /** Show error message */
    showError(message: string): void;
  };

  /** Logging (always available) */
  log: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };

  /** Git operations (requires git permission) */
  git: {
    getStatus(repoRoot: string): Promise<unknown>;
    getBranch(repoRoot: string): Promise<string>;
  };

  /** Configuration */
  configuration: {
    get<T>(key: string): Promise<T | undefined>;
    update(key: string, value: unknown): Promise<void>;
  };

  /** Events subscription */
  events: {
    onFileChange(callback: (event: FileChangeEvent) => void): Disposable;
    onActiveEditorChange(callback: (editor: EditorInfo | null) => void): Disposable;
  };

  /** Status bar operations */
  statusBar: {
    /** Create a status bar item */
    createItem(item: StatusBarItem): StatusBarItemHandle;
  };

  /** File tree decorations */
  fileDecorations: {
    /** Register a file decoration provider */
    registerProvider(provider: FileDecorationProvider): Disposable;
  };

  /** Context menu operations */
  contextMenu: {
    /**
     * Register a context menu item
     * @param item - The menu item configuration
     * @param handler - Called when the menu item is clicked, receives the file path or selection
     */
    registerItem(
      item: ContextMenuItem,
      handler: (context: { filePath?: string; selection?: string }) => void | Promise<void>
    ): Disposable;
  };

  /** Keyboard shortcuts */
  keybindings: {
    /**
     * Register a keyboard shortcut
     * @param shortcut - The shortcut configuration
     */
    register(shortcut: KeyboardShortcut): Disposable;
  };
}

/** Handle to update or dispose a status bar item */
export interface StatusBarItemHandle extends Disposable {
  /** Update the item's text */
  update(item: Partial<Omit<StatusBarItem, 'id'>>): void;
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface Disposable {
  dispose(): void;
}

export interface WorkspaceFolder {
  name: string;
  path: string;
}

export interface EditorInfo {
  path: string;
  languageId: string;
  isDirty: boolean;
}

export interface FileChangeEvent {
  path: string;
  type: 'created' | 'changed' | 'deleted';
}

export interface TerminalCommandContext {
  /** Command arguments (space-separated, excluding the command name) */
  args: string[];
  /** Current working directory of the terminal */
  cwd: string;
  /** Terminal ID */
  terminalId: string;
  /** Write output to the terminal (supports ANSI escape codes) */
  write: (text: string) => void;
}

export interface CompletionContext {
  /** The text before the cursor on the current line */
  linePrefix: string;
  /** The full line text */
  lineText: string;
  /** Line number (1-indexed) */
  lineNumber: number;
  /** Column number (1-indexed) */
  column: number;
  /** The file path */
  filePath: string;
  /** The trigger character if any */
  triggerCharacter?: string;
}

export interface CompletionItem {
  /** The label shown in the completion list */
  label: string;
  /** The text to insert when selected */
  insertText: string;
  /** Optional detail shown next to the label */
  detail?: string;
  /** Optional documentation shown in the details pane */
  documentation?: string;
  /** Kind of completion (e.g., 'function', 'snippet', 'text') */
  kind?: 'function' | 'snippet' | 'text' | 'keyword' | 'variable' | 'class' | 'method' | 'property';
  /** Characters that trigger this completion (e.g., ['.']) */
  triggerCharacters?: string[];
}

export interface CompletionProvider {
  /** Trigger characters that activate this provider */
  triggerCharacters?: string[];
  /**
   * Provide completion items
   * @param context - Information about the cursor position and surrounding text
   * @returns Array of completion items, or empty array for no completions
   */
  provideCompletions(context: CompletionContext): CompletionItem[] | Promise<CompletionItem[]>;
}

export interface StatusBarItem {
  /** Unique ID for this status bar item */
  id: string;
  /** Text to display */
  text: string;
  /** Optional tooltip */
  tooltip?: string;
  /** Optional color (CSS color string) */
  color?: string;
  /** Priority for ordering (higher = more to the left). Default: 0 */
  priority?: number;
  /** Alignment: 'left' or 'right'. Default: 'right' */
  alignment?: 'left' | 'right';
}

export interface FileDecoration {
  /** Badge text (1-2 characters, e.g., "M", "!", "★") */
  badge?: string;
  /** Badge color (CSS color string) */
  badgeColor?: string;
  /** Tooltip when hovering over the decoration */
  tooltip?: string;
  /** Whether to dim/fade the file name */
  faded?: boolean;
  /** Color for the file name (CSS color string) */
  color?: string;
}

export interface FileDecorationProvider {
  /**
   * Provide decorations for a file
   * @param filePath - Absolute path to the file
   * @returns Decoration for this file, or undefined for no decoration
   */
  provideDecoration(filePath: string): FileDecoration | undefined | Promise<FileDecoration | undefined>;
}

export interface ContextMenuItem {
  /** Unique ID for this menu item */
  id: string;
  /** Display label */
  label: string;
  /** Context where this item appears: 'editor', 'fileTree', or 'both' */
  context: 'editor' | 'fileTree' | 'both';
  /** Optional keyboard shortcut hint to display */
  shortcutHint?: string;
}

export interface KeyboardShortcut {
  /** Key combination (e.g., 'ctrl+shift+m', 'cmd+k cmd+c') */
  key: string;
  /** Command ID to execute when triggered */
  command: string;
  /** Optional context where this shortcut is active: 'editor', 'terminal', 'global'. Default: 'global' */
  when?: 'editor' | 'terminal' | 'global';
}

// ============================================================================
// npm Registry Types
// ============================================================================

export interface NpmPackageInfo {
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string };
  keywords?: string[];
  repository?: { type: string; url: string } | string;
  homepage?: string;
  license?: string;
  /** The colab-plugin field if present */
  'colab-plugin'?: PluginManifest;
}

export interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string;
      version: string;
      description?: string;
      keywords?: string[];
      author?: { name: string };
      publisher?: { username: string };
      date: string;
    };
    score: {
      final: number;
      detail: {
        quality: number;
        popularity: number;
        maintenance: number;
      };
    };
  }>;
  total: number;
}
