import { createSignal, onMount, onCleanup, Show, type Component } from "solid-js";
import { render } from "solid-js/web";
import { electrobun } from "../init";
import { state } from "../store";
import type { CachedFileType, FolderNodeType } from "../../../shared/types/types";
import { waitForPluginRenderers } from "./pluginSlateRegistry";

export interface PluginSlateInfo {
  id: string;
  pluginName: string;
  name: string;
  description?: string;
  icon?: string;
  patterns: string[];
  folderHandler?: boolean;
}

interface PluginSlateProps {
  node?: CachedFileType | FolderNodeType;
  slateInfo: PluginSlateInfo;
}

/**
 * Registry of slate components that can be rendered by plugins.
 * Plugins register their slate patterns in the main process, but the actual
 * SolidJS components live here in the renderer and are looked up by slate ID.
 *
 * Format: "pluginName.slateId" -> Component
 */
type SlateComponentProps = {
  node?: CachedFileType | FolderNodeType;
  slateInfo: PluginSlateInfo;
  instanceId: string;
};

type SlateComponent = Component<SlateComponentProps>;

const slateComponentRegistry: Map<string, SlateComponent> = new Map();

/**
 * Register a SolidJS component for a plugin slate.
 * Call this from the renderer to associate a component with a slate ID.
 *
 * @param slateId - Full slate ID (e.g., "webflow-plugin.devlink")
 * @param component - SolidJS component to render
 */
export function registerSlateComponent(slateId: string, component: SlateComponent): void {
  slateComponentRegistry.set(slateId, component);
  console.log(`[PluginSlate] Registered component for slate: ${slateId}`);
}

/**
 * Unregister a slate component
 */
export function unregisterSlateComponent(slateId: string): void {
  slateComponentRegistry.delete(slateId);
}

/**
 * Get a registered slate component
 */
export function getSlateComponent(slateId: string): SlateComponent | undefined {
  return slateComponentRegistry.get(slateId);
}

/**
 * PluginSlate - A generic container for plugin-provided slates
 *
 * This component:
 * 1. Looks up a registered SolidJS component for the slate ID
 * 2. Provides a mount point for the component
 * 3. Notifies the plugin when the slate mounts/unmounts
 * 4. Renders the component into the mount point
 */
export const PluginSlate = (props: PluginSlateProps) => {
  const [instanceId, setInstanceId] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  let mountRef: HTMLDivElement | undefined;
  let disposeComponent: (() => void) | null = null;

  onMount(async () => {
    if (!props.node?.path) {
      setError("No node path provided");
      setIsLoading(false);
      return;
    }

    // Wait for plugin renderers to be loaded before checking registry
    await waitForPluginRenderers();

    // Look up the component for this slate
    const SlateComponent = slateComponentRegistry.get(props.slateInfo.id);

    if (!SlateComponent) {
      // No component registered - fall back to notifying plugin for HTML-based rendering
      console.warn(`[PluginSlate] No component registered for slate: ${props.slateInfo.id}`);
      setError(`No component registered for slate: ${props.slateInfo.id}`);
      setIsLoading(false);
      return;
    }

    try {
      // Notify the plugin that a slate is mounting (for any plugin-side state management)
      const result = await electrobun.rpc?.request.pluginMountSlate({
        slateId: props.slateInfo.id,
        filePath: props.node.path,
        windowId: state.windowId,
      });

      const newInstanceId = result?.instanceId || `local-${Date.now()}`;
      setInstanceId(newInstanceId);
      setIsLoading(false);

      // Render the component into the mount point
      if (mountRef) {
        disposeComponent = render(
          () => (
            <SlateComponent
              node={props.node}
              slateInfo={props.slateInfo}
              instanceId={newInstanceId}
            />
          ),
          mountRef
        );
      }
    } catch (e) {
      console.error("[PluginSlate] Error mounting slate:", e);
      setError(`Failed to mount slate: ${e}`);
      setIsLoading(false);
    }
  });

  onCleanup(async () => {
    // Dispose the rendered component
    if (disposeComponent) {
      disposeComponent();
      disposeComponent = null;
    }

    // Notify the plugin that the slate is unmounting
    const currentInstanceId = instanceId();
    if (currentInstanceId && !currentInstanceId.startsWith('local-')) {
      try {
        await electrobun.rpc?.request.pluginUnmountSlate({
          instanceId: currentInstanceId,
        });
      } catch (e) {
        console.error("[PluginSlate] Error unmounting slate:", e);
      }
    }
  });

  return (
    <div class="plugin-slate" style={{ height: "100%", overflow: "auto" }}>
      <Show when={isLoading()}>
        <div style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          height: "100%",
          color: "var(--text-secondary)",
        }}>
          Loading {props.slateInfo.name}...
        </div>
      </Show>

      <Show when={error()}>
        <div style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "center",
          "justify-content": "center",
          height: "100%",
          color: "var(--error)",
          padding: "20px",
        }}>
          <div style={{ "font-weight": "bold", "margin-bottom": "10px" }}>
            Error loading {props.slateInfo.name}
          </div>
          <div style={{ color: "var(--text-secondary)", "font-size": "12px" }}>
            {error()}
          </div>
        </div>
      </Show>

      <Show when={!isLoading() && !error()}>
        <div
          ref={mountRef}
          class="plugin-slate-mount"
          style={{ height: "100%" }}
        />
      </Show>
    </div>
  );
};

export default PluginSlate;
