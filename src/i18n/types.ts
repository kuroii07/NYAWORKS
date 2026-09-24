import type { DensityId } from "../density/types";
import type {
  MotionPreference,
  SettingsTabId
} from "../settings/types";

export type ToolId =
  | "textLayer"
  | "solidLayer"
  | "shapeLayer"
  | "threeDObject"
  | "adjustmentLayer"
  | "precompose"
  | "camera"
  | "light"
  | "nullObject"
  | "newProjectFolder"
  | "organizeProject"
  | "duplicateComp"
  | "packageLayers"
  | "fitComp"
  | "findFootage"
  | "removeUnused"
  | "duplicateLayer"
  | "linkParent"
  | "unlinkParent"
  | "moveUp"
  | "moveDown"
  | "reverseOrder"
  | "soloLayers"
  | "addKeyframe"
  | "graphEditor"
  | "steppedAnimation"
  | "loopAnimation"
  | "sequenceAnimation"
  | "timeOffset"
  | "easingControl"
  | "newText"
  | "textLayout"
  | "splitText"
  | "rectangle"
  | "circle"
  | "star"
  | "path"
  | "effects"
  | "adjust"
  | "quickPreset"
  | "layerStyles"
  | "linkEffects"
  | "audioResponse"
  | "moreTools";

export type ToolGroupId =
  | "compositionProject"
  | "layerActions"
  | "animationTime"
  | "textShapes"
  | "effectsPresets";

export interface UiCopy {
  navigationAria: string;
  navigation: {
    home: string;
    ai: string;
    projects: string;
    compositions: string;
    layers: string;
    animation: string;
    text: string;
    shapes: string;
    effects: string;
    media: string;
  };
  topbar: {
    whatsNewAria: string;
    whatsNewTitle: string;
    languageAria: string;
    languageTitle: string;
    settingsAria: string;
    settingsTitle: string;
    themeAria: string;
    themeTitle: string;
    themeHeading: string;
  };
  languageMenu: {
    heading: string;
  };
  home: {
    searchPlaceholder: string;
    searchAria: string;
    bannerLead: string;
    bannerAccent: string;
    bannerSubtitle: string;
    shortcutHeading: string;
    edit: string;
    editAria: string;
    editTitle: string;
    quickToolsAria: string;
    createPanelTitle: string;
    spacePanelTitle: string;
    createSwitchAria: string;
    anchorSwitchAria: string;
    anchorGridAria: string;
    anchorLabel: string;
    plannedAriaSuffix: string;
    plannedTitleSuffix: string;
    toolGroupsAria: string;
    groupTitles: Record<ToolGroupId, string>;
    toolLabels: Record<ToolId, string>;
  };
  placeholder: {
    ai: string;
    projects: string;
    compositions: string;
    layers: string;
    animation: string;
    text: string;
    shapes: string;
    effects: string;
    media: string;
    settings: string;
    heading: string;
    body: string;
    currentTheme: string;
  };
  settings: {
    navigationAria: string;
    tabs: Record<SettingsTabId, string>;
    general: {
      generalSection: string;
      startupPage: string;
      homePage: string;
      rememberLastPage: string;
      autoCheckUpdates: string;
      density: string;
      densityOptions: Record<DensityId, string>;
      interactionSection: string;
      tooltips: string;
      tooltipDelay: string;
      motion: string;
      motionOptions: Record<MotionPreference, string>;
      showWhatsNew: string;
      confirmDangerousActions: string;
      appearanceSection: string;
      currentTheme: string;
      currentLanguage: string;
      interfaceBrightness: string;
      homeBanner: string;
      resetAllSettings: string;
      resetAction: string;
      resetDialogTitle: string;
      resetDialogBody: string;
      resetConfirm: string;
      resetCancel: string;
      autoSaveNote: string;
    };
    about: {
      productTagline: string;
      developmentBadge: string;
      productSection: string;
      version: string;
      extensionId: string;
      supportedLanguages: string;
      supportedLanguagesValue: string;
      updateSection: string;
      updateChannel: string;
      updateChannelValue: string;
      automaticUpdates: string;
      automaticUpdatesValue: string;
      openRepository: string;
      compatibilitySection: string;
      afterEffects: string;
      currentAfterEffects: string;
      hostDisconnected: string;
      runtime: string;
      hostVerification: string;
      hostVerificationValue: string;
      licensingSection: string;
      licenseStatus: string;
      licenseNotConfigured: string;
      licenseType: string;
      licenseTypePending: string;
      currentDevice: string;
      deviceUnavailable: string;
      purchaseLicense: string;
      activateLicense: string;
      manageDevices: string;
      helpSection: string;
      documentation: string;
      videoTutorials: string;
      feedback: string;
      officialWebsite: string;
      diagnosticsSection: string;
      exportDiagnostics: string;
      openDataDirectory: string;
      privacyPolicy: string;
      openSourceLicenses: string;
      userAgreement: string;
      notConfiguredAction: string;
      hostOnlyAction: string;
      privacySection: string;
      localPreferences: string;
      localPreferencesValue: string;
      aiData: string;
      aiDataValue: string;
      thanksSection: string;
      thanksBody: string;
    };
    comingSoon: {
      heading: string;
      body: string;
    };
  };
  whatsNew: {
    title: string;
    version: string;
    releaseDate: string;
    features: string;
    improvements: string;
    fixes: string;
    close: string;
  };
  updateDialog: {
    title: string;
    currentVersion: string;
    availableVersion: string;
    summaryFallback: string;
    update: string;
    notNow: string;
  };
}
