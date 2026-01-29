import type { ThemeConfig } from './themeConfig';
import  { darkTheme } from './darkTheme';
import { lightTheme } from './lightTheme';
import { defaultTheme } from './defaultTheme';

export type ThemeType = 'default' | 'dark' | 'light';

export const THEME_CONFIGS: Record<ThemeType, ThemeConfig> = {
  default: defaultTheme,
  dark: darkTheme,
  light: lightTheme
};

export const applyTheme = (theme: ThemeType) => {
  const config = THEME_CONFIGS[theme];
  const root = document.documentElement;
  root.style.setProperty('--color-body', config.body);
  root.style.setProperty('--color-top-bar', config.topBar);
  root.style.setProperty('--color-status-bar', config.statusBar);
  root.style.setProperty('--color-sidebar', config.sidebar);
  root.style.setProperty('--color-sidebar-text', config.sidebarText);
  root.style.setProperty('--color-settings', config.settingsPanel);
  root.style.setProperty('--color-settings-header', config.settingsHeader);
  root.style.setProperty('--color-settings-section', config.settingsSection);
  root.style.setProperty('--color-settings-input-bg', config.settingsInputBg);
  root.style.setProperty('--color-settings-input-border', config.settingsInputBorder);
  root.style.setProperty('--color-settings-input-text', config.settingsInputText);
  root.style.setProperty('--color-text', config.text);
  root.style.setProperty('--color-text-secondary', config.textSecondary);
  root.style.setProperty('--color-text-tertiary', config.textTertiary);
  root.style.setProperty('--color-button-bg', config.buttonBg);
  root.style.setProperty('--color-button-text', config.buttonText);
  root.style.setProperty('--color-button-hover', config.buttonHover);
  root.style.setProperty('--color-button-disabled', config.buttonDisabled);
  root.style.setProperty('--color-info-box-bg', config.infoBoxBg);
  root.style.setProperty('--color-info-box-text', config.infoBoxText);
  root.style.setProperty('--color-editor-breadcrumb', config.editorBreadcrumb);
  root.style.setProperty('--color-editor-breadcrumb-highlight', config.editorBreadcrumbHighlight);
  root.style.setProperty('--color-toolbar-search-btn-bg', config.toolbarSearchBtnBg);
  root.style.setProperty('--color-toolbar-input-bg', config.toolbarInputBg);
  root.style.setProperty('--color-toolbar-input-border', config.toolbarInputBorder);
  root.style.setProperty('--color-toolbar-input-text', config.toolbarInputText);
  root.style.setProperty('--color-toolbar-menu-bg', config.toolbarMenuBg);
  root.style.setProperty('--color-toolbar-menu-border', config.toolbarMenuBorder);
  root.style.setProperty('--color-toolbar-section-title', config.toolbarSectionTitle);
  root.style.setProperty('--color-toolbar-section-border', config.toolbarSectionBorder);
  root.style.setProperty('--color-find-input-bg', config.findInputBg);
  root.style.setProperty('--color-find-input-border', config.findInputBorder);
  root.style.setProperty('--color-find-input-text', config.findInputText);
  root.style.setProperty('--color-filter-toggle-bg', config.filterToggleBg);
  root.style.setProperty('--color-filter-toggle-text', config.filterToggleText);
  root.style.setProperty('--color-filter-icon-filter', config.filterIconFilter);
  root.style.setProperty('--color-sidebar-toggle-bg', config.sidebarToggleBg);
  root.style.setProperty('--color-sidebar-toggle-border', config.sidebarToggleBorder);
  root.style.setProperty('--color-sidebar-toggle-icon', config.sidebarToggleIcon);
  root.style.setProperty('--color-settings-pane-border', config.settingsPaneBorder);
  root.style.setProperty('--color-pane-top-bar-selected', config.paneTopBarSelected);
  root.style.setProperty('--color-pane-top-bar-unselected', config.paneTopBarUnselected);
  
  // New color variables for index.tsx
  root.style.setProperty('--color-pane-split-controls-shadow', config.paneSplitControlsShadow);
  root.style.setProperty('--color-button-dark-bg', config.buttonDarkBg);
  root.style.setProperty('--color-button-dark-border', config.buttonDarkBorder);
  root.style.setProperty('--color-button-dark-text', config.buttonDarkText);
  root.style.setProperty('--color-pane-split-border', config.paneSplitBorder);
  root.style.setProperty('--color-pane-split-hover', config.paneSplitHover);
  root.style.setProperty('--color-tab-close-bg', config.tabCloseBg);
  root.style.setProperty('--color-tab-close-border', config.tabCloseBorder);
  root.style.setProperty('--color-tab-close-text', config.tabCloseText);
  
  // Additional color variables for pane content
  root.style.setProperty('--color-empty-pane-bg', config.emptyPaneBg);
  root.style.setProperty('--color-empty-pane-text', config.emptyPaneText);
  root.style.setProperty('--color-drop-target-bg', config.dropTargetBg);
  root.style.setProperty('--color-drop-target-text', config.dropTargetText);
  
  // Tab colors
  root.style.setProperty('--color-tab-drop-target-bg', config.tabDropTargetBg);
  root.style.setProperty('--color-tab-active-bg', config.tabActiveBg);
  root.style.setProperty('--color-tab-hover-bg', config.tabHoverBg);
  root.style.setProperty('--color-tab-inactive-bg', config.tabInactiveBg);
  root.style.setProperty('--color-tab-active-text', config.tabActiveText);
  root.style.setProperty('--color-tab-inactive-text', config.tabInactiveText);
  root.style.setProperty('--color-tab-active-border', config.tabActiveBorder);
  root.style.setProperty('--color-tab-inactive-border', config.tabInactiveBorder);
  root.style.setProperty('--color-tab-shadow', config.tabShadow);
  root.style.setProperty('--color-tab-border', config.tabBorder);
  root.style.setProperty('--color-tab-close-hover-bg', config.tabCloseHoverBg);
  
  // Tab content colors
  root.style.setProperty('--color-tab-content-bg', config.tabContentBg);
  root.style.setProperty('--color-tab-content-text', config.tabContentText);
  
  // Menu and button colors
  root.style.setProperty('--color-menu-hover-bg', config.menuHoverBg);
  root.style.setProperty('--color-menu-hover-text', config.menuHoverText);
  root.style.setProperty('--color-menu-item-selected-bg', config.menuItemSelectedBg);
  root.style.setProperty('--color-menu-item-hover-bg', config.menuItemHoverBg);
  root.style.setProperty('--color-menu-item-text', config.menuItemText);
  root.style.setProperty('--color-update-button-bg', config.updateButtonBg);
  root.style.setProperty('--color-update-button-hover-bg', config.updateButtonHoverBg);
  root.style.setProperty('--color-update-button-active-bg', config.updateButtonActiveBg);
  root.style.setProperty('--color-update-button-error-bg', config.updateButtonErrorBg);
  root.style.setProperty('--color-update-button-error-hover-bg', config.updateButtonErrorHoverBg);
  root.style.setProperty('--color-update-button-error-active-bg', config.updateButtonErrorActiveBg);
  root.style.setProperty('--color-browser-btn-bg', config.browserBtnBg);
  root.style.setProperty('--color-browser-btn-hover-bg', config.browserBtnHoverBg);
  root.style.setProperty('--color-browser-btn-shadow', config.browserBtnShadow);
  
  // Workspace menu colors
  root.style.setProperty('--color-workspace-menu-text', config.workspaceMenuText);
  root.style.setProperty('--color-workspace-menu-bg', config.workspaceMenuBg);
  root.style.setProperty('--color-workspace-menu-border', config.workspaceMenuBorder);
  root.style.setProperty('--color-action-button-text', config.actionButtonText);
  root.style.setProperty('--color-action-button-error-text', config.actionButtonErrorText);
  
  // File tree colors
  root.style.setProperty('--color-file-tree-indicator-bg', config.fileTreeIndicatorBg);
  root.style.setProperty('--color-file-tree-icon-color', config.fileTreeIconColor);
  root.style.setProperty('--color-file-tree-button-bg', config.fileTreeButtonBg);
  root.style.setProperty('--color-file-tree-button-hover-bg', config.fileTreeButtonHoverBg);
  root.style.setProperty('--color-file-tree-button-border', config.fileTreeButtonBorder);
  root.style.setProperty('--color-file-tree-button-hover-border', config.fileTreeButtonHoverBorder);
  root.style.setProperty('--color-file-tree-button-text', config.fileTreeButtonText);
  root.style.setProperty('--color-file-tree-button-hover-text', config.fileTreeButtonHoverText);
  root.style.setProperty('--color-file-tree-item-hover-bg', config.fileTreeItemHoverBg);
  root.style.setProperty('--color-file-tree-item-selected-bg', config.fileTreeItemSelectedBg);
  root.style.setProperty('--color-file-tree-item-close-bg', config.fileTreeItemCloseBg);
  root.style.setProperty('--color-file-tree-item-close-hover-bg', config.fileTreeItemCloseHoverBg);
  root.style.setProperty('--color-file-tree-item-close-border', config.fileTreeItemCloseBorder);
  root.style.setProperty('--color-file-tree-item-close-text', config.fileTreeItemCloseText);
  root.style.setProperty('--color-file-tree-item-close-hover-text', config.fileTreeItemCloseHoverText);
  root.style.setProperty('--color-file-tree-filter-toggle-bg', config.fileTreeFilterToggleBg);
  root.style.setProperty('--color-file-tree-folder-drop-target-bg', config.fileTreeFolderDropTargetBg);
  root.style.setProperty('--color-file-tree-dirty-indicator', config.fileTreeDirtyIndicator);
  
  // Settings colors
  root.style.setProperty('--color-settings-body-bg', config.settingsBodyBg);
  root.style.setProperty('--color-settings-status-box-bg', config.settingsStatusBoxBg);
  root.style.setProperty('--color-settings-status-disconnected-color', config.settingsStatusDisconnectedColor);
  root.style.setProperty('--color-settings-button-error-bg', config.settingsButtonErrorBg);
  root.style.setProperty('--color-settings-button-success-bg', config.settingsButtonSuccessBg);
  root.style.setProperty('--color-settings-button-success-text', config.settingsButtonSuccessText);
  root.style.setProperty('--color-settings-button-secondary-bg', config.settingsButtonSecondaryBg);
  
  // Plugin marketplace colors
  root.style.setProperty('--color-marketplace-body-bg', config.marketplaceBodyBg);
  root.style.setProperty('--color-marketplace-tab-inactive-bg', config.marketplaceTabInactiveBg);
  root.style.setProperty('--color-marketplace-plugin-item-bg', config.marketplacePluginItemBg);
  root.style.setProperty('--color-marketplace-plugin-item-active-bg', config.marketplacePluginItemActiveBg);
  root.style.setProperty('--color-marketplace-plugin-item-active-text', config.marketplacePluginItemActiveText);
  root.style.setProperty('--color-marketplace-plugin-item-inactive-bg', config.marketplacePluginItemInactiveBg);
  root.style.setProperty('--color-marketplace-plugin-item-inactive-text', config.marketplacePluginItemInactiveText);
  root.style.setProperty('--color-marketplace-tab-active-border', config.marketplaceTabActiveBorder);
  
  // Status bar colors
  root.style.setProperty('--color-status-bar-border', config.statusBarBorder);
  root.style.setProperty('--color-status-bar-item-default', config.statusBarItemDefaultColor);
  root.style.setProperty('--color-status-bar-success', config.statusBarSuccessColor);
  root.style.setProperty('--color-status-bar-warning', config.statusBarWarningColor);
  root.style.setProperty('--color-status-bar-error', config.statusBarErrorColor);
  root.style.setProperty('--color-status-bar-pending', config.statusBarPendingColor);
  root.style.setProperty('--color-status-bar-disconnected', config.statusBarDisconnectedColor);
  root.style.setProperty('--color-status-bar-indicator-border', config.statusBarIndicatorBorder);
  root.style.setProperty('--color-status-bar-indicator-highlight', config.statusBarIndicatorHighlight);
  
  // Dialog colors
  root.style.setProperty('--color-dialog-overlay-bg', config.dialogOverlayBg);
  root.style.setProperty('--color-dialog-bg', config.dialogBg);
  root.style.setProperty('--color-dialog-border', config.dialogBorder);
  root.style.setProperty('--color-dialog-text', config.dialogText);
  root.style.setProperty('--color-dialog-text-secondary', config.dialogTextSecondary);
  root.style.setProperty('--color-dialog-danger-text', config.dialogDangerText);
  root.style.setProperty('--color-dialog-button-cancel-bg', config.dialogButtonCancelBg);
  root.style.setProperty('--color-dialog-button-cancel-border', config.dialogButtonCancelBorder);
  root.style.setProperty('--color-dialog-button-cancel-text', config.dialogButtonCancelText);
  root.style.setProperty('--color-dialog-button-cancel-hover-bg', config.dialogButtonCancelHoverBg);
  root.style.setProperty('--color-dialog-button-confirm-bg', config.dialogButtonConfirmBg);
  root.style.setProperty('--color-dialog-button-confirm-border', config.dialogButtonConfirmBorder);
  root.style.setProperty('--color-dialog-button-confirm-text', config.dialogButtonConfirmText);
  root.style.setProperty('--color-dialog-button-confirm-hover-bg', config.dialogButtonConfirmHoverBg);
  root.style.setProperty('--color-dialog-button-danger-bg', config.dialogButtonDangerBg);
  root.style.setProperty('--color-dialog-button-danger-border', config.dialogButtonDangerBorder);
  root.style.setProperty('--color-dialog-button-danger-hover-bg', config.dialogButtonDangerHoverBg);
  
  // GitHub repo selector colors
  root.style.setProperty('--color-github-text-default', config.githubTextDefault);
  root.style.setProperty('--color-github-error-bg', config.githubErrorBg);
  root.style.setProperty('--color-github-error-text', config.githubErrorText);
  root.style.setProperty('--color-github-item-border', config.githubItemBorder);
  root.style.setProperty('--color-github-item-selected-bg', config.githubItemSelectedBg);
  root.style.setProperty('--color-github-item-hover-bg', config.githubItemHoverBg);
  root.style.setProperty('--color-github-item-selected-text', config.githubItemSelectedText);
  root.style.setProperty('--color-github-item-default-text', config.githubItemDefaultText);
  root.style.setProperty('--color-github-repo-branch-selected-bg', config.githubRepoBranchSelectedBg);
  root.style.setProperty('--color-github-repo-branch-default-bg', config.githubRepoBranchDefaultBg);
  root.style.setProperty('--color-github-repo-branch-selected-text', config.githubRepoBranchSelectedText);
  root.style.setProperty('--color-github-repo-branch-hover-text', config.githubRepoBranchHoverText);
  root.style.setProperty('--color-github-repo-branch-hover-bg', config.githubRepoBranchHoverBg);
  root.style.setProperty('--color-github-repo-branch-default-text', config.githubRepoBranchDefaultText);
  root.style.setProperty('--color-github-tag-bg', config.githubTagBg);
  root.style.setProperty('--color-github-tag-text', config.githubTagText);
  root.style.setProperty('--color-github-repo-owner-text', config.githubRepoOwnerText);
  
  // Pane splitter colors
  root.style.setProperty('--color-pane-splitter-bg', config.paneSplitterBg);
  root.style.setProperty('--color-pane-splitter-hover-bg', config.paneSplitterHoverBg);
  root.style.setProperty('--color-pane-splitter-shadow', config.paneSplitterShadow);
  
  // Sidebar resize handle colors
  root.style.setProperty('--color-sidebar-resize-handle-bg', config.sidebarResizeHandleBg);
  root.style.setProperty('--color-sidebar-resize-handle-hover-bg', config.sidebarResizeHandleHoverBg);
  
  // Top bar button colors
  root.style.setProperty('--color-top-bar-button-border', config.topBarButtonBorder);
};
