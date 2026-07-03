import type { Dictionary } from "./types"

/**
 * English — canonical dictionary. This is the source of truth for the
 * Dictionary shape; every other language file must match it exactly.
 */
export const incidentFormEn = {
  category: "Category", title: "Title", description: "Description",
  date: "Date and time", gps: "GPS coordinates", evidence: "Evidence attachments",
  cancel: "Cancel", saveIncident: "Save incident",
}

export const incidentRecordEn = {
  allRecords: "All records", sealed: "Sealed", unsealed: "Unsealed",
  description: "Description", noDescription: "No description provided.",
  evidence: "Evidence", decryptedInMemory: "Decrypted in memory only.",
  noAttachments: "No attachments on this record.", sealEvidence: "Seal evidence",
  sealedCannotDelete: "Sealed records are permanent and cannot be deleted.",
  confirmDelete: "Confirm delete", cancel: "Cancel", deleteRecord: "Delete record",
  edit: "Edit", saveChanges: "Save changes", pdf: "PDF", exporting: "Exporting…",
}

export const incidentFormExtraEn = {
  photo: "Photo", screenshot: "Screenshot", uploadAudio: "Upload audio file",
  uploadDocument: "Upload document", capture: "Capture",
  removeLocation: "Remove location", removeAttachment: "Remove attachment",
  noLocationAttached: "No location attached.", locating: "Locating…",
  geoNotAvailable: "Geolocation is not available on this device.",
  geoPermissionDenied: "Location permission denied or unavailable.",
  selectCategory: "Select a category.", enterTitle: "Enter a title.",
  couldNotSaveIncident: "Could not save the incident.", encrypting: "Encrypting…",
  cancel: "Cancel",
}

export const recordsPageEn = {
  title: "Records", searchPlaceholder: "Search title or description",
  toggleFilters: "Toggle filters", category: "Category", allCategories: "All categories",
  from: "From", to: "To", sealedStatus: "Sealed status", all: "All",
  sealedOnly: "Sealed only", unsealedOnly: "Unsealed only",
  onlyGpsRecords: "Only records with GPS location", clearFilters: "Clear filters",
  noIncidentsYet: "No incidents recorded yet.",
  noRecordsMatchFilters: "No records match the current filters.",
}

export const miscUiEn = {
  noDescriptionShort: "No description.",
  gpsTagged: "GPS tagged",
  stopRecording: "Stop recording",
  logIncidentTitle: "Log incident",
  logIncidentDescription: "Document an event. All fields stay on this device and are encrypted before storage.",
  shortSummaryPlaceholder: "Short summary of the incident",
  recordVoiceNote: "Record voice note",
  sealed: "Sealed",
  noAttachments: "No attachments",
}

export const relativeTimeEn = {
  justNow: "just now",
  minutesAgo: "{n}m ago",
  hoursAgo: "{n}h ago",
  daysAgo: "{n}d ago",
}

export const en: Dictionary = {
  relativeTime: relativeTimeEn,
  miscUi: miscUiEn,
  recordsPage: recordsPageEn,
  incidentForm: incidentFormEn,
  incidentRecord: incidentRecordEn,
  incidentFormExtra: incidentFormExtraEn,
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
    edit: "Edit",
    close: "Close",
    loading: "Loading…",
    error: "Error",
    yes: "Yes",
    no: "No",
    ok: "OK",
    back: "Back",
    download: "Download",
    saving: "Saving…",
  },

  nav: {
    records: "Records",
    patterns: "Patterns",
    vault: "Vault",
    newIncident: "New",
  },

  vault: {
    title: "Witness Protocol",
    locked: "Your vault is locked.",
    unlocked: "Vault unlocked",
    lockNow: "Lock vault now",
    createPasscode: "Create your passcode",
    confirmPasscode: "Confirm your passcode",
    incorrectPasscode: "Incorrect vault passcode.",
    passcodesDoNotMatch: "Passcodes do not match.",
    couldNotCreateVault: "Could not create the vault.",
    investigatorIdentity: "Investigator Identity",
    fullName: "Full name",
    governmentId: "Government ID",
    organization: "Organization",
    phone: "Phone",
    email: "Email",
    saveIdentity: "Save Identity",
    autoLockTitle: "Inactivity auto-lock",
    autoLockDescription:
      "Vault locks automatically after {minutes} minute{plural}.",
    sealAllTitle: "Seal all unsealed records",
    sealAllDescription: "{count} incident{plural} not yet sealed.",
    sealAllButton: "Seal all ({count})",
    sealAllNoneUnsealed: "All incidents are sealed.",
    sealingProgress: "Sealing {processed} of {total}",
    language: "Language",
  },

  backup: {
    exportBackup: "Export Backup",
    importBackup: "Import Backup",
    exporting: "Exporting…",
    merging: "Merging…",
    restoring: "Restoring…",
    restoreTitle: "Restore backup",
    mergeTitle: "Merge backup",
    restoreSubtitle: "Enter the vault PIN used to create this backup.",
    mergeSubtitle:
      "Enter the PIN used to create the backup you're merging in.",
    backupSaved: "Backup saved:\n{fileName}",
    backupRestored: "Backup restored successfully.",
    mergeComplete: "Merge complete",
    mergeAdded: "{count} new record{plural} added",
    mergeDuplicates: "{count} duplicate{plural} skipped",
    mergeDiverged:
      "{count} record{plural} added as new (matching ID but different content)",
    mergeEvidenceAdded: "{count} evidence file{plural} imported",
    dismiss: "Dismiss",
    stagePreparing: "Preparing…",
    stageMetadata: "Exporting metadata…",
    stageEvidence: "Encrypting evidence…",
    stageFinishing: "Building ZIP…",
    stageSaving: "Saving file…",
    incorrectPasscodeOrCorrupted: "Incorrect passcode or corrupted backup file.",
  },

  auditLog: {
    title: "Audit log",
    noActivity: "No activity recorded yet.",
    showAll: "Show all ({count})",
    showLess: "Show less",
    incidentCreated: "Incident created",
    incidentEdited: "Incident edited",
    incidentSealed: "Incident sealed",
    incidentDeleted: "Incident deleted",
    evidenceDownloaded: "Evidence downloaded",
    pdfExported: "PDF exported",
    backupExported: "Backup exported",
    backupRestored: "Backup restored",
    backupMerged: "Backup merged",
  },
}
