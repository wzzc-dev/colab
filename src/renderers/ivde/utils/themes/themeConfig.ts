
export interface ThemeConfig {
  body: string;
  topBar: string;
  statusBar: string;
  sidebar: string;
  sidebarText: string;
  settingsPanel: string;
  settingsHeader: string;
  settingsSection: string;
  settingsInputBg: string;
  settingsInputBorder: string;
  settingsInputText: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  buttonBg: string;
  buttonText: string;
  buttonHover: string;
  buttonDisabled: string;
  infoBoxBg: string;
  infoBoxText: string;
  editorBreadcrumb: string;
  editorBreadcrumbHighlight: string;
  toolbarSearchBtnBg: string;
  toolbarInputBg: string;
  toolbarInputBorder: string;
  toolbarInputText: string;
  toolbarMenuBg: string;
  toolbarMenuBorder: string;
  toolbarSectionTitle: string;
  toolbarSectionBorder: string;
  findInputBg: string;
  findInputBorder: string;
  findInputText: string;
  filterToggleBg: string;
  filterToggleText: string;
  filterIconFilter: string;
  sidebarToggleBg: string;
  sidebarToggleBorder: string;
  sidebarToggleIcon: string;
  settingsPaneBorder: string;
  paneTopBarSelected: string;
  paneTopBarUnselected: string;
  
  // New color variables for index.tsx
  paneSplitControlsShadow: string;
  buttonDarkBg: string;
  buttonDarkBorder: string;
  buttonDarkText: string;
  paneSplitBorder: string;
  paneSplitHover: string;
  tabCloseBg: string;
  tabCloseBorder: string;
  tabCloseText: string;
  
  // Additional color variables for pane content
  emptyPaneBg: string;
  emptyPaneText: string;
  dropTargetBg: string;
  dropTargetText: string;
  
  // Tab colors
  tabDropTargetBg: string;
  tabActiveBg: string;
  tabHoverBg: string;
  tabInactiveBg: string;
  tabActiveText: string;
  tabInactiveText: string;
  tabActiveBorder: string;
  tabInactiveBorder: string;
  tabShadow: string;
  tabBorder: string;
  tabCloseHoverBg: string;
  
  // Pane splitter colors
  paneSplitterBg: string;
  paneSplitterHoverBg: string;
  paneSplitterShadow: string;
  
  // Sidebar resize handle colors
  sidebarResizeHandleBg: string;
  sidebarResizeHandleHoverBg: string;
  
  // Top bar button colors
  topBarButtonBorder: string;
  
  // Tab content colors
  tabContentBg: string;
  tabContentText: string;
  
  // Menu and button colors
  menuHoverBg: string;
  menuHoverText: string;
  menuItemSelectedBg: string;
  menuItemHoverBg: string;
  menuItemText: string;
  updateButtonBg: string;
  updateButtonHoverBg: string;
  updateButtonActiveBg: string;
  updateButtonErrorBg: string;
  updateButtonErrorHoverBg: string;
  updateButtonErrorActiveBg: string;
  browserBtnBg: string;
  browserBtnHoverBg: string;
  browserBtnShadow: string;
  
  // Workspace menu colors
  workspaceMenuText: string;
  workspaceMenuBg: string;
  workspaceMenuBorder: string;
  actionButtonText: string;
  actionButtonErrorText: string;
  
  // File tree colors
  fileTreeIndicatorBg: string;
  fileTreeIconColor: string;

  // File tree specific colors
  fileTreeButtonBg: string;
  fileTreeButtonHoverBg: string;
  fileTreeButtonBorder: string;
  fileTreeButtonHoverBorder: string;
  fileTreeButtonText: string;
  fileTreeButtonHoverText: string;
  fileTreeItemHoverBg: string;
  fileTreeItemSelectedBg: string;
  fileTreeItemCloseBg: string;
  fileTreeItemCloseHoverBg: string;
  fileTreeItemCloseBorder: string;
  fileTreeItemCloseText: string;
  fileTreeItemCloseHoverText: string;
  fileTreeFilterToggleBg: string;
  fileTreeFolderDropTargetBg: string;
  fileTreeDirtyIndicator: string;
  
  // Settings colors
  settingsBodyBg: string;
  settingsStatusBoxBg: string;
  settingsStatusDisconnectedColor: string;
  settingsButtonErrorBg: string;
  settingsButtonSuccessBg: string;
  settingsButtonSuccessText: string;
  settingsButtonSecondaryBg: string;
  
  // Plugin marketplace colors
  marketplaceBodyBg: string;
  marketplaceTabInactiveBg: string;
  marketplacePluginItemBg: string;
  marketplacePluginItemActiveBg: string;
  marketplacePluginItemActiveText: string;
  marketplacePluginItemInactiveBg: string;
  marketplacePluginItemInactiveText: string;
  marketplaceTabActiveBorder: string;
  
  // GitHub repo selector colors
  githubTextDefault: string;
  githubErrorBg: string;
  githubErrorText: string;
  githubItemBorder: string;
  githubItemSelectedBg: string;
  githubItemHoverBg: string;
  githubItemSelectedText: string;
  githubItemDefaultText: string;
  githubRepoBranchSelectedBg: string;
  githubRepoBranchDefaultBg: string;
  githubRepoBranchSelectedText: string;
  githubRepoBranchHoverText: string;
  githubRepoBranchHoverBg: string;
  githubRepoBranchDefaultText: string;
  githubTagBg: string;
  githubTagText: string;
  githubRepoOwnerText: string;
  
  // Status bar colors
  statusBarBorder: string;
  statusBarItemDefaultColor: string;
  statusBarSuccessColor: string;
  statusBarWarningColor: string;
  statusBarErrorColor: string;
  statusBarPendingColor: string;
  statusBarDisconnectedColor: string;
  statusBarIndicatorBorder: string;
  statusBarIndicatorHighlight: string;
  
  // Dialog colors
  dialogOverlayBg: string;
  dialogBg: string;
  dialogBorder: string;
  dialogText: string;
  dialogTextSecondary: string;
  dialogDangerText: string;
  dialogButtonCancelBg: string;
  dialogButtonCancelBorder: string;
  dialogButtonCancelText: string;
  dialogButtonCancelHoverBg: string;
  dialogButtonConfirmBg: string;
  dialogButtonConfirmBorder: string;
  dialogButtonConfirmText: string;
  dialogButtonConfirmHoverBg: string;
  dialogButtonDangerBg: string;
  dialogButtonDangerBorder: string;
  dialogButtonDangerHoverBg: string;
}