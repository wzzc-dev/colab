import { createSignal, onMount, onCleanup } from "solid-js";
import { produce } from "solid-js/store";
import { type TerminalTabType, getWindow, setState } from "../store";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { electrobun } from "../init";

export const TerminalSlate = ({ tabId }: { tabId: string }) => {
  const tab = () => getWindow()?.tabs[tabId] as TerminalTabType | undefined;
  const [terminalId, setTerminalId] = createSignal<string | null>(null);
  const [currentDir, setCurrentDir] = createSignal<string | null>(null);
  
  let terminalElement: HTMLDivElement | undefined;
  let terminal: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let webglAddon: WebglAddon | null = null;

  // Function to update current directory from the terminal process
  const updateCurrentDir = async () => {
    const id = terminalId();
    if (!id) {
      console.log('No terminal ID available');
      return;
    }
    
    console.log('Updating current directory for terminal:', id);
    
    try {
      const cwd = await electrobun.rpc?.request.getTerminalCwd({ terminalId: id });
      console.log('Got cwd from terminal:', cwd, 'current:', currentDir());
      
      if (cwd && cwd !== currentDir()) {
        console.log('Updating current directory to:', cwd);
        setCurrentDir(cwd);
        
        // Update the tab title with the new directory
        setState(
          produce((_state) => {
            const win = getWindow(_state);
            if (win && win.tabs[tabId]) {
              // Store the current directory in the tab for the title
              (win.tabs[tabId] as any).currentDir = cwd;
              console.log('Updated tab currentDir to:', cwd);
            }
          })
        );
      }
    } catch (error) {
      console.error('Failed to get terminal cwd:', error);
    }
  };

  const initializeTerminal = async () => {
    if (!terminalElement) return;

    const _tab = tab();
    if (!_tab) return;

    try {
      // Create terminal in bun process
      const id = await electrobun.rpc?.request.createTerminal({
        cwd: _tab.cwd || "/",
        shell: _tab.cmd,
      });

      if (!id) {
        console.error("Failed to create terminal");
        return;
      }

      setTerminalId(id);

      // Store the terminal ID in the tab for cleanup
      setState(
        produce((_state) => {
          const win = getWindow(_state);
          if (win && win.tabs[tabId]) {
            win.tabs[tabId].terminalId = id;
          }
        })
      );
      
      // Initial update of current directory
      setTimeout(updateCurrentDir, 1000);

      // Create xterm terminal
      terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Monaco, "Courier New", monospace',
        theme: {
          background: "#000005",
          foreground: "#888888",
        },
        scrollback: 10000,
        convertEol: true,
      });

      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      
      // Add web links addon
      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(webLinksAddon);
      
      terminal.open(terminalElement);
      fitAddon.fit();

      // Load WebGL addon for better performance
      try {
        webglAddon = new WebglAddon();
        terminal.loadAddon(webglAddon);
      } catch (error) {
        console.warn("WebGL addon failed to load:", error);
      }

      // Handle user input
      terminal.onData((data) => {
        if (terminalId()) {
          electrobun.rpc?.request.writeToTerminal({
            terminalId: terminalId()!,
            data,
          });
        }
      });

      // Handle resize
      terminal.onResize(({ cols, rows }) => {
        if (terminalId()) {
          electrobun.rpc?.request.resizeTerminal({
            terminalId: terminalId()!,
            cols,
            rows,
          });
        }
      });

      // Handle container resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon?.fit();
      });
      resizeObserver.observe(terminalElement);

      onCleanup(() => {
        resizeObserver.disconnect();
      });

    } catch (error) {
      console.error("Failed to initialize terminal:", error);
    }
  };

  onMount(() => {
    // Initialize the terminal
    initializeTerminal();

    // Set up CustomEvent listeners for terminal messages
    const handleTerminalOutput = (event: CustomEvent<{ terminalId: string; data: string }>) => {
      const data = event.detail;
      if (data.terminalId === terminalId() && terminal) {
        terminal.write(data.data);
        
        // If the output contains a newline (indicating a command was executed),
        // check for directory changes after a short delay
        if (data.data.includes('\n') || data.data.includes('\r')) {
          setTimeout(updateCurrentDir, 500); // Small delay to let command complete
        }
      }
    };

    const handleTerminalExit = (event: CustomEvent<{ terminalId: string; exitCode: number }>) => {
      const data = event.detail;
      if (data.terminalId === terminalId() && terminal) {
        terminal.write(`\r\n\x1b[31mProcess exited with code ${data.exitCode}\x1b[0m\r\n`);
      }
    };

    // Listen for terminal messages via CustomEvents
    window.addEventListener('terminalOutput', handleTerminalOutput as EventListener);
    window.addEventListener('terminalExit', handleTerminalExit as EventListener);

    onCleanup(() => {
      // Remove event listeners
      window.removeEventListener('terminalOutput', handleTerminalOutput as EventListener);
      window.removeEventListener('terminalExit', handleTerminalExit as EventListener);
      
      // Clean up terminal resources
      if (terminalId()) {
        electrobun.rpc?.request.killTerminal({
          terminalId: terminalId()!,
        });
      }
      terminal?.dispose();
      fitAddon?.dispose();
      webglAddon?.dispose();
    });
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: "8px",
        "background-color": "#000005",
      }}
    >
      <div
        ref={terminalElement}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
};