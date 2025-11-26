/**
 * Cat Image Replacer Plugin for Colab
 *
 * This is a test/demo plugin that demonstrates the plugin API.
 * When enabled, it replaces all images on web pages with cat pictures.
 */

import type { PluginAPI, Disposable } from '../colab/src/main/plugins/types';

let catModeEnabled = false;
const disposables: Disposable[] = [];

/**
 * The preload script that will be injected into web pages
 * This runs in the webview context, not the plugin worker
 */
const preloadScript = `
(function() {
  console.log('🐱 Cat Replacer preload script loaded!');

  // Simple: wait 2 seconds then replace all images with cats
  setTimeout(function() {
    var images = document.querySelectorAll('img');
    console.log('🐱 Replacing', images.length, 'images with cats...');

    images.forEach(function(img, i) {
      // Use cataas.com - Cat as a Service (reliable cat image API)
      var catUrl = 'https://cataas.com/cat?t=' + Date.now() + '-' + i;

      img.src = catUrl;
      img.srcset = '';
    });

    console.log('🐱 Done! All images are now cats.');
  }, 2000);
})();
`;

/**
 * Called when the plugin is activated
 */
export async function activate(api: PluginAPI): Promise<void> {
  api.log.info('Cat Image Replacer plugin activating...');

  // Register the preload script - this will be injected into all webviews
  const preloadDisposable = api.webview.registerPreloadScript(preloadScript);
  disposables.push(preloadDisposable);
  api.log.info('Preload script registered for webviews');

  // Register the enable command (for future use - could toggle cat mode on/off)
  const enableDisposable = api.commands.registerCommand('catReplacer.enable', async () => {
    catModeEnabled = true;
    api.log.info('Cat mode enabled!');
    api.notifications.showInfo('🐱 Cat Mode Enabled! All images are now cats.');
    return { enabled: true };
  });
  disposables.push(enableDisposable);

  // Register the disable command
  const disableDisposable = api.commands.registerCommand('catReplacer.disable', async () => {
    catModeEnabled = false;
    api.log.info('Cat mode disabled!');
    api.notifications.showInfo('😿 Cat Mode Disabled. Images restored.');
    return { enabled: false };
  });
  disposables.push(disableDisposable);

  // Register terminal command - type "meow" in any terminal!
  const terminalDisposable = api.terminal.registerCommand('meow', async (ctx) => {
    const { args, cwd, write } = ctx;
    const count = parseInt(args[0]) || 1;

    write('\x1b[33m'); // Yellow color
    write('🐱 Cat Plugin Terminal Command\r\n');
    write('\x1b[0m'); // Reset color
    write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n\r\n');
    write(`\x1b[90mCWD: ${cwd}\x1b[0m\r\n\r\n`);

    // Stream multiple meows with a delay
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const catEmojis = ['🐱', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
      const randomCat = catEmojis[Math.floor(Math.random() * catEmojis.length)];
      write(`${randomCat} Meow ${i + 1}!\r\n`);
    }

    write('\r\n\x1b[32m✓ Done meowing!\x1b[0m\r\n');
  });
  disposables.push(terminalDisposable);

  // Register editor completion provider - adds cat-themed console.log snippets
  const completionDisposable = api.editor.registerCompletionProvider(
    ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
    {
      triggerCharacters: ['.'],
      provideCompletions(ctx) {
        // Only trigger after "console."
        if (!ctx.linePrefix.endsWith('console.')) {
          return [];
        }

        return [
          {
            label: '🐱 log (cat)',
            insertText: "log('🐱 ', $1);$0",
            detail: 'Cat-themed console.log',
            documentation: 'Insert a console.log with a cat emoji prefix',
            kind: 'snippet',
          },
          {
            label: '😺 meow',
            insertText: "log('😺 Meow!', $1);$0",
            detail: 'Log a meow',
            documentation: 'Insert a meow log statement',
            kind: 'snippet',
          },
          {
            label: '🙀 error (cat)',
            insertText: "error('🙀 ', $1);$0",
            detail: 'Cat-themed console.error',
            documentation: 'Insert a console.error with a surprised cat',
            kind: 'snippet',
          },
        ];
      },
    }
  );
  disposables.push(completionDisposable);

  // Create a status bar item that shows cat mode status
  let catCount = 0;
  const statusBarItem = api.statusBar.createItem({
    id: 'cat-status',
    text: '🐱 Cat Mode',
    tooltip: 'Cat Replacer Plugin is active',
    color: '#ffcc00',
    alignment: 'right',
    priority: 100,
  });
  disposables.push(statusBarItem);

  // Update the status bar periodically with a random cat emoji
  const catEmojis = ['🐱', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
  const statusInterval = setInterval(() => {
    catCount++;
    const randomCat = catEmojis[catCount % catEmojis.length];
    statusBarItem.update({
      text: `${randomCat} Cat Mode (${catCount})`,
    });
  }, 5000);

  // Clean up the interval on deactivate
  disposables.push({ dispose: () => clearInterval(statusInterval) });

  // Register file decoration provider - mark .cat files with a cat badge
  const decorationDisposable = api.fileDecorations.registerProvider({
    provideDecoration(filePath) {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        return {
          badge: '🐱',
          tooltip: 'TypeScript file (cat approved!)',
        };
      }
      return undefined;
    },
  });
  disposables.push(decorationDisposable);

  // Register context menu item
  const contextMenuDisposable = api.contextMenu.registerItem(
    {
      id: 'catify-file',
      label: '🐱 Catify this file',
      context: 'both',
      shortcutHint: 'Ctrl+Shift+C',
    },
    async (ctx) => {
      api.log.info(`Catify requested for: ${ctx.filePath || 'selection'}`);
      api.notifications.showInfo(`🐱 Would catify: ${ctx.filePath || ctx.selection || 'nothing selected'}`);
    }
  );
  disposables.push(contextMenuDisposable);

  // Register keyboard shortcut
  const keybindingDisposable = api.keybindings.register({
    key: 'ctrl+shift+m',
    command: 'catReplacer.enable',
    when: 'global',
  });
  disposables.push(keybindingDisposable);

  api.log.info('Cat Image Replacer plugin activated! All features registered.');
  api.notifications.showInfo('🐱 Cat Replacer loaded! Check status bar, type "meow" in terminal, or "console." in editor.');
}

/**
 * Called when the plugin is deactivated
 */
export async function deactivate(): Promise<void> {
  // Clean up all disposables
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;
  catModeEnabled = false;
}
