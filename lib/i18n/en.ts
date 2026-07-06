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
  exportAllPdf: "Export all as PDF",
  exportingAllPdf: "Exporting incidents…",
  exportingAllPdfProgress: "Exporting batch {current} of {total}…",
  exportAllPdfFailed: "PDF export failed: {error}",
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

export const categoriesEn = {
  surveillanceName: "Surveillance",
  surveillanceDesc: "Observation, recording, or monitoring activity.",
  personalTrackingName: "Personal Tracking",
  personalTrackingDesc: "Following, location tracking, or movement monitoring.",
  gaslightingName: "Gaslighting",
  gaslightingDesc: "Manipulation, denial, or distortion of events.",
  deviceAnomalyName: "Device Anomaly",
  deviceAnomalyDesc: "Unexpected device behavior or technical irregularities.",
  poisoningName: "Poisoning and Threats",
  poisoningDesc: "Suspected contamination of food, water, or environment.",
  legalName: "Legal",
  legalDesc: "Legal documents, notices, or proceedings.",
  categoryLabel: "Category",
  unknown: "Unknown",
}

export const evidenceHintEn = {
  selectCategoryPlaceholder: "Select category",
  evidenceDisclaimer: "Images are stripped of EXIF metadata, hashed with SHA-256, and encrypted before storage.",
}

export const en: Dictionary = {
  evidenceHint: evidenceHintEn,
  categories: categoriesEn,
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

  patterns: {
    title: "Pattern review",
    description:
      "Local, on-device analysis of your own records. Observations and correlations only — never claims about cause or intent.",
    recordsAnalyzed: "{count} record{plural} analyzed",
    neverRun: "Run analysis to refresh observations.",
    lastRun: "Last run {time}",
    run: "Run",
    empty:
      "No observations yet. Log a few incidents, then run the analysis. Findings will appear here as neutral statistical correlations.",
    caution:
      "This tool reports correlations within your own log. It does not identify people, assign blame, or infer external intent. Interpret findings with care.",

    severity: {
      info: "info",
      notable: "notable",
      high: "high",
    },

    weekdays: {
      "0": "Sunday",
      "1": "Monday",
      "2": "Tuesday",
      "3": "Wednesday",
      "4": "Thursday",
      "5": "Friday",
      "6": "Saturday",
    },

    timeBlocks: {
      dawn: "dawn",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night",
    },

    alertTitles: {
      repeatedTime: "Repeated time pattern",
      repeatedLocation: "Repeated location pattern",
      frequencySpike: "Frequency spike",
      categoryCluster: "Category cluster",
      activityTrendIncreasing: "Activity trend increasing",
      activityTrendDecreasing: "Activity trend decreasing",
      activityTrendStable: "Stable activity trend",
      weekdayCluster: "Repeated weekday pattern",
      weekdayTimeCluster: "Repeated weekday/time pattern",
    },

    alertText: {
      repeatedTime:
        "{count} records were logged during the {block} time block.",
      repeatedLocation:
        "{count} records were logged in the same approximate location cell ({cell}).",
      frequencySpike:
        "A spike was detected on {day}, with {count} records logged.",
      categoryCluster:
        "{category} represents {share}% of all logged records.",
      activityTrendIncreasing:
        "Recent records suggest an upward trend in logging frequency.",
      activityTrendDecreasing:
        "Recent records suggest a downward trend in logging frequency.",
      activityTrendStable:
        "Recent records suggest a stable logging frequency trend.",
      weekdayCluster:
        "{count} records were logged on {day}.",
      weekdayTimeCluster:
        "{count} records were logged on {day} during the {block} time block.",
    },

    alertDetail: {
      repeatedTime: "{share}% of all incidents fall in this hour window.",
      repeatedLocation: "Coordinates rounded to ~110m precision.",
      frequencySpike: "Daily average is {average} (±{std}).",
      categoryCluster: "{count} of {total} total incidents.",
      weekdayCluster: "{share}% of all incidents fall on the same weekday.",
      weekdayTimeCluster:
        "{count} incidents ({share}% of the log) share this weekday/time block.",
      activityTrendIncreasing:
        "Estimated change of {perWeek} incidents/week across {spanDays} days.",
      activityTrendDecreasing:
        "Estimated change of {perWeek} incidents/week across {spanDays} days.",
      activityTrendStable: "Change of {perWeek} incidents/week.",
    },
  },
}
