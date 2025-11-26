import {
  type JSXElement,
  createSignal,
  onMount,
  For,
  Show,
  Switch,
  Match,
} from "solid-js";
import { state, setState } from "../store";
import {
  SettingsPaneSaveClose,
  SettingsPaneFormSection,
  SettingsPaneField,
} from "./forms";
import { electrobun } from "../init";

interface SettingField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color';
  default?: string | number | boolean;
  description?: string;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
}

interface SettingsSchema {
  title?: string;
  description?: string;
  fields: SettingField[];
}

interface EntitlementSummary {
  category: string;
  level: 'low' | 'medium' | 'high';
  icon: string;
  label: string;
  description: string;
}

export const PluginSettings = (): JSXElement => {
  const [schema, setSchema] = createSignal<SettingsSchema | null>(null);
  const [values, setValues] = createSignal<Record<string, string | number | boolean>>({});
  const [entitlements, setEntitlements] = createSignal<EntitlementSummary[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [pluginDisplayName, setPluginDisplayName] = createSignal<string>("");

  // Get the plugin name from settingsPane data
  const getPluginName = () => {
    const data = state.settingsPane.data as { pluginName?: string };
    return data?.pluginName || "";
  };

  const loadSettings = async () => {
    const pluginName = getPluginName();
    if (!pluginName) {
      setLoading(false);
      return;
    }

    try {
      const [schemaResult, valuesResult, entitlementsResult] = await Promise.all([
        electrobun.rpc?.request.pluginGetSettingsSchema({ pluginName }),
        electrobun.rpc?.request.pluginGetSettingsValues({ pluginName }),
        electrobun.rpc?.request.pluginGetEntitlements({ pluginName }),
      ]);

      if (schemaResult) {
        setSchema(schemaResult);
        setPluginDisplayName(schemaResult.title || pluginName);
      }
      if (valuesResult) {
        setValues(valuesResult);
      }
      if (entitlementsResult) {
        setEntitlements(entitlementsResult);
      }
    } catch (error) {
      console.error("Failed to load plugin settings:", error);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadSettings();
  });

  const handleValueChange = async (key: string, value: string | number | boolean) => {
    const pluginName = getPluginName();
    if (!pluginName) return;

    // Update local state immediately
    setValues(prev => ({ ...prev, [key]: value }));

    // Persist to backend
    try {
      await electrobun.rpc?.request.pluginSetSettingValue({ pluginName, key, value });
    } catch (error) {
      console.error("Failed to save setting:", error);
    }
  };

  const getValue = (field: SettingField): string | number | boolean => {
    const v = values();
    if (field.key in v) {
      return v[field.key];
    }
    return field.default ?? (field.type === 'boolean' ? false : field.type === 'number' ? 0 : '');
  };

  const onClose = () => {
    setState("settingsPane", { type: "", data: {} });
  };

  return (
    <div
      style="background: #404040; color: #d9d9d9; height: 100vh; overflow: hidden; display: flex; flex-direction: column;"
    >
      <div style="height: 100%; display: flex; flex-direction: column;">
        <div
          class="settings-header"
          style="display: flex; flex-direction: row; height: 45px; font-size: 20px; line-height: 45px; padding: 0 10px; align-items: center;"
        >
          <h1 style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;font-weight: 400;margin: 0 0px 0 0;overflow-x: hidden;text-overflow: ellipsis;white-space: nowrap;padding: 3px 11px;font-size: 20px;line-height: 1.34;">
            {pluginDisplayName() || "Plugin Settings"}
          </h1>
          <div style="flex-grow: 1;"></div>
          <button
            type="button"
            onClick={onClose}
            style="border-color: rgb(54, 54, 54);outline: 0px;cursor: default;-webkit-user-select: none;padding: 0px 12px;font-family: inherit;font-size: 12px;position: relative;display: flex;align-items: center;justify-content: center;height: 32px;border-radius: 2px;color: rgb(235, 235, 235);background: rgb(94, 94, 94);border-width: 1px;border-style: solid;box-sizing: border-box;align-self: center;"
          >
            Close
          </button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 0; padding-bottom: 40px;">
          <Show when={loading()}>
            <div style="padding: 20px; text-align: center; color: #999;">
              Loading settings...
            </div>
          </Show>

          <Show when={!loading() && !schema()}>
            <div style="padding: 20px; text-align: center; color: #999;">
              This plugin has no configurable settings.
            </div>
          </Show>

          <Show when={!loading() && schema()}>
            <Show when={schema()?.description}>
              <div style="padding: 16px; color: #999; font-size: 12px; border-bottom: 1px solid #333;">
                {schema()?.description}
              </div>
            </Show>

            <SettingsPaneFormSection label="Settings">
              <For each={schema()?.fields || []}>
                {(field) => (
                  <SettingsPaneField label={field.label}>
                    <Switch>
                      <Match when={field.type === 'boolean'}>
                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                          <input
                            type="checkbox"
                            checked={getValue(field) as boolean}
                            onChange={(e) => handleValueChange(field.key, e.currentTarget.checked)}
                            style="margin-top: 2px; flex-shrink: 0;"
                          />
                          <Show when={field.description}>
                            <span style="font-size: 11px; color: #999; line-height: 1.4;">
                              {field.description}
                            </span>
                          </Show>
                        </div>
                      </Match>

                      <Match when={field.type === 'string'}>
                        <input
                          type="text"
                          value={getValue(field) as string}
                          onInput={(e) => handleValueChange(field.key, e.currentTarget.value)}
                          style="background: #2b2b2b;border-radius: 4px;border: 1px solid #212121;color: #d9d9d9;outline: none;cursor: text;display: block;font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif;font-size: 12px;padding-top: 8px;padding-right: 9px;padding-bottom: 8px;padding-left: 9px;line-height: 14px;width: 100%;box-sizing: border-box;"
                        />
                        <Show when={field.description}>
                          <div style="font-size: 11px; color: #999; margin-top: 4px;">
                            {field.description}
                          </div>
                        </Show>
                      </Match>

                      <Match when={field.type === 'number'}>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                          <div style="display: flex; align-items: center; gap: 12px;">
                            <input
                              type="range"
                              min={field.min ?? 0}
                              max={field.max ?? 100}
                              step={field.step ?? 1}
                              value={(getValue(field) as number).toString()}
                              onInput={(e) => handleValueChange(field.key, parseFloat(e.currentTarget.value))}
                              style="flex: 1; accent-color: #0073e6;"
                            />
                            <span style="font-size: 12px; color: #d9d9d9; min-width: 40px; text-align: right;">
                              {getValue(field)}
                            </span>
                          </div>
                          <Show when={field.description}>
                            <div style="font-size: 11px; color: #999;">
                              {field.description}
                            </div>
                          </Show>
                        </div>
                      </Match>

                      <Match when={field.type === 'select'}>
                        <select
                          value={getValue(field) as string | number}
                          onChange={(e) => {
                            const val = e.currentTarget.value;
                            // Try to parse as number if it looks like one
                            const numVal = parseFloat(val);
                            handleValueChange(field.key, isNaN(numVal) ? val : numVal);
                          }}
                          style="background: #2b2b2b; border-radius: 4px; border: 1px solid #212121; color: #d9d9d9; outline: none; cursor: pointer; display: block; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; font-size: 12px; padding: 8px 9px; line-height: 14px; width: 100%;"
                        >
                          <For each={field.options || []}>
                            {(option) => (
                              <option value={option.value} selected={option.value === getValue(field)}>
                                {option.label}
                              </option>
                            )}
                          </For>
                        </select>
                        <Show when={field.description}>
                          <div style="font-size: 11px; color: #999; margin-top: 4px;">
                            {field.description}
                          </div>
                        </Show>
                      </Match>

                      <Match when={field.type === 'color'}>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <input
                            type="color"
                            value={getValue(field) as string}
                            onInput={(e) => handleValueChange(field.key, e.currentTarget.value)}
                            style="width: 40px; height: 32px; border: 1px solid #212121; border-radius: 4px; cursor: pointer;"
                          />
                          <input
                            type="text"
                            value={getValue(field) as string}
                            onInput={(e) => handleValueChange(field.key, e.currentTarget.value)}
                            style="background: #2b2b2b;border-radius: 4px;border: 1px solid #212121;color: #d9d9d9;outline: none;font-size: 12px;padding: 8px 9px;flex: 1;"
                          />
                        </div>
                        <Show when={field.description}>
                          <div style="font-size: 11px; color: #999; margin-top: 4px;">
                            {field.description}
                          </div>
                        </Show>
                      </Match>
                    </Switch>
                  </SettingsPaneField>
                )}
              </For>
            </SettingsPaneFormSection>
          </Show>

          {/* Entitlements Section */}
          <Show when={!loading() && entitlements().length > 0}>
            <div style="margin-top: 16px; border-top: 1px solid #333; padding-top: 16px;">
              <SettingsPaneFormSection label="Declared Capabilities">
                <div style="padding: 12px 16px;">
                  <div style="background: #2a2a2a; border: 1px solid #444; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: flex-start; gap: 8px; color: #f0ad4e; font-size: 11px;">
                      <span style="font-size: 14px;">⚠️</span>
                      <div>
                        <strong>Trust Notice:</strong> These are capabilities the plugin author declares it needs.
                        They are <em>not enforced</em> by Colab. Only install plugins from sources you trust.
                      </div>
                    </div>
                  </div>

                  <For each={entitlements()}>
                    {(entitlement) => (
                      <div
                        style={{
                          display: "flex",
                          "align-items": "flex-start",
                          gap: "10px",
                          padding: "8px 0",
                          "border-bottom": "1px solid #333",
                        }}
                      >
                        <span style="font-size: 18px; line-height: 1;">{entitlement.icon}</span>
                        <div style="flex: 1;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 12px; color: #d9d9d9; font-weight: 500;">
                              {entitlement.label}
                            </span>
                            <span
                              style={{
                                "font-size": "10px",
                                padding: "2px 6px",
                                "border-radius": "3px",
                                background: entitlement.level === 'high' ? '#5c2626' :
                                           entitlement.level === 'medium' ? '#4a4026' : '#2a3a2a',
                                color: entitlement.level === 'high' ? '#f87171' :
                                       entitlement.level === 'medium' ? '#fbbf24' : '#86efac',
                              }}
                            >
                              {entitlement.level}
                            </span>
                          </div>
                          <div style="font-size: 11px; color: #888; margin-top: 2px;">
                            {entitlement.description}
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </SettingsPaneFormSection>
            </div>
          </Show>

          {/* No entitlements message */}
          <Show when={!loading() && entitlements().length === 0 && schema()}>
            <div style="margin-top: 16px; border-top: 1px solid #333; padding-top: 16px;">
              <SettingsPaneFormSection label="Declared Capabilities">
                <div style="padding: 12px 16px; color: #888; font-size: 12px;">
                  This plugin has not declared any special capabilities.
                </div>
              </SettingsPaneFormSection>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
