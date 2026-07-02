import type { Dictionary } from "./types"

/**
 * English — canonical dictionary. This is the source of truth for the
 * Dictionary shape; every other language file must match it exactly.
 */
export const en: Dictionary = {
  incidentForm: incidentFormEn,
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
export const incidentFormEn = {
  category: "Category", title: "Title", description: "Description",
  date: "Date and time", gps: "GPS coordinates", evidence: "Evidence attachments",
  cancel: "Cancel", saveIncident: "Save incident",
}
