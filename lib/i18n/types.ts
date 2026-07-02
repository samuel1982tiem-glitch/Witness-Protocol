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

/** What gets persisted as the user's preference. "system" means: follow device locale. */
export type LanguagePreference = "system" | LanguageCode

export interface Dictionary {
  incidentForm: IncidentFormDict
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
