/**
 * i18n type definitions.
 *
 * English (en.ts) is the canonical dictionary shape. Every other
 * language file must implement this exact interface — TypeScript will
 * error at build time if a language file is missing a key or has an
 * extra one, keeping all dictionaries structurally in sync.
 *
 * IMPORTANT: this covers UI/system text only. Never add keys here for
 * user-entered content (incident descriptions, filenames, etc.) — that
 * content is never translated, by design.
 */

export type LanguageCode = "en" | "pt-BR" | "es"
export type LanguagePreference = "system" | LanguageCode

export interface Dictionary {
  evidenceHint: EvidenceHintDict
  categories: CategoryDict
  relativeTime: RelativeTimeDict
  miscUi: MiscUiDict
  recordsPage: RecordsPageDict
  incidentFormExtra: IncidentFormExtraDict
  incidentRecord: IncidentRecordDict
  incidentForm: IncidentFormDict
  patterns: PatternsDict
  pdfExport: PdfExportDict

  common: {
    save: string
    cancel: string
    delete: string
    confirm: string
    edit: string
    close: string
    loading: string
    error: string
    yes: string
    no: string
    ok: string
    back: string
    download: string
    saving: string
  }

  nav: {
    records: string
    patterns: string
    vault: string
    newIncident: string
  }

  vault: {
    title: string
    locked: string
    unlocked: string
    lockNow: string
    createPasscode: string
    confirmPasscode: string
    incorrectPasscode: string
    passcodesDoNotMatch: string
    couldNotCreateVault: string
    investigatorIdentity: string
    fullName: string
    governmentId: string
    idDocument: string
    attachIdDocument: string
    idDocumentTooLarge: string
    downloadIdDocument: string
    removeIdDocument: string
    organization: string
    phone: string
    email: string
    saveIdentity: string
    autoLockTitle: string
    autoLockDescription: string
    sealAllTitle: string
    sealAllDescription: string
    sealAllButton: string
    sealAllNoneUnsealed: string
    sealingProgress: string
    language: string
  }

  backup: {
    includeIdDocumentExport: string
    includeIdDocumentRestore: string
    exportBackup: string
    importBackup: string
    exporting: string
    merging: string
    restoring: string
    restoreTitle: string
    mergeTitle: string
    restoreSubtitle: string
    mergeSubtitle: string
    backupSaved: string
    backupRestored: string
    mergeComplete: string
    mergeAdded: string
    mergeDuplicates: string
    mergeDiverged: string
    mergeEvidenceAdded: string
    dismiss: string
    stagePreparing: string
    stageMetadata: string
    stageEvidence: string
    stageFinishing: string
    stageSaving: string
    incorrectPasscodeOrCorrupted: string
  }

  auditLog: {
    title: string
    noActivity: string
    showAll: string
    showLess: string
    incidentCreated: string
    incidentEdited: string
    incidentSealed: string
    incidentDeleted: string
    evidenceDownloaded: string
    pdfExported: string
    backupExported: string
    backupRestored: string
    backupMerged: string
  }
}

export interface IncidentFormDict {
  category: string
  title: string
  description: string
  date: string
  gps: string
  evidence: string
  cancel: string
  saveIncident: string
}

export interface IncidentRecordDict {
  allRecords: string
  sealed: string
  unsealed: string
  description: string
  noDescription: string
  evidence: string
  decryptedInMemory: string
  noAttachments: string
  sealEvidence: string
  sealedCannotDelete: string
  confirmDelete: string
  cancel: string
  deleteRecord: string
  edit: string
  saveChanges: string
  pdf: string
  exporting: string
  decryptingAttachments: string
  readyToSaveShare: string
  downloadFailed: string
  evidenceSeal: string
  sealedAt: string
}

export interface IncidentFormExtraDict {
  photo: string
  screenshot: string
  uploadAudio: string
  uploadDocument: string
  capture: string
  removeLocation: string
  removeAttachment: string
  noLocationAttached: string
  descriptionPlaceholder: string
  locating: string
  geoNotAvailable: string
  geoPermissionDenied: string
  selectCategory: string
  enterTitle: string
  couldNotSaveIncident: string
  encrypting: string
  cancel: string
}

export interface RecordsPageDict {
  title: string
  searchPlaceholder: string
  toggleFilters: string
  category: string
  allCategories: string
  from: string
  to: string
  sealedStatus: string
  all: string
  sealedOnly: string
  unsealedOnly: string
  onlyGpsRecords: string
  clearFilters: string
  noIncidentsYet: string
  noRecordsMatchFilters: string
  exportAllPdf: string
  exportingAllPdf: string
  exportingAllPdfProgress: string
  exportAllPdfFailed: string
  packageAll: string
  packagingAll: string
  packagingAllProgress: string
  packageAllFailed: string
}

export interface MiscUiDict {
  gpsTagged: string
  noDescriptionShort: string
  stopRecording: string
  logIncidentTitle: string
  logIncidentDescription: string
  shortSummaryPlaceholder: string
  recordVoiceNote: string
  sealed: string
  noAttachments: string
}

export interface RelativeTimeDict {
  justNow: string
  minutesAgo: string
  hoursAgo: string
  daysAgo: string
}

export interface CategoryDict {
  surveillanceName: string
  surveillanceDesc: string
  personalTrackingName: string
  personalTrackingDesc: string
  gaslightingName: string
  gaslightingDesc: string
  deviceAnomalyName: string
  deviceAnomalyDesc: string
  poisoningName: string
  poisoningDesc: string
  legalName: string
  legalDesc: string
  categoryLabel: string
  unknown: string
}

export interface EvidenceHintDict {
  selectCategoryPlaceholder: string
  evidenceDisclaimer: string
}

export interface PatternsDict {
  title: string
  description: string
  recordsAnalyzed: string
  neverRun: string
  lastRun: string
  run: string
  empty: string
  caution: string

  severity: {
    info: string
    notable: string
    high: string
  }

  weekdays: {
    "0": string
    "1": string
    "2": string
    "3": string
    "4": string
    "5": string
    "6": string
  }

  timeBlocks: {
    dawn: string
    morning: string
    afternoon: string
    evening: string
    night: string
  }

  alertTitles: {
    repeatedTime: string
    repeatedLocation: string
    frequencySpike: string
    categoryCluster: string
    weekdayCluster: string
    weekdayTimeCluster: string
    activityTrendIncreasing: string
    activityTrendDecreasing: string
    activityTrendStable: string
  }

  alertText: {
    repeatedTime: string
    repeatedLocation: string
    frequencySpike: string
    categoryCluster: string
    weekdayCluster: string
    weekdayTimeCluster: string
    activityTrendIncreasing: string
    activityTrendDecreasing: string
    activityTrendStable: string
  }

  alertDetail: {
    repeatedTime: string
    repeatedLocation: string
    frequencySpike: string
    categoryCluster: string
    weekdayCluster: string
    weekdayTimeCluster: string
    activityTrendIncreasing: string
    activityTrendDecreasing: string
    activityTrendStable: string
  }
}

export interface PdfExportDict {
  investigatorIdentity: string
  name: string
  governmentId: string
  organization: string
  phone: string
  email: string
  untitledIncident: string
  category: string
  occurred: string
  logged: string
  status: string
  sealed: string
  unsealed: string
  gps: string
  description: string
  noDescriptionProvided: string
  evidenceCount: string
  noAttachments: string
  imageEmbedFailed: string
  documentPlaceholder: string
  voicePlaceholder: string
  evidenceSeal: string
  sealedAt: string
  footer: string
  bulkReportTitle: string
  generatedAt: string
}
