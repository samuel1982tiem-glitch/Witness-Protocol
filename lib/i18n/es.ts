import type { Dictionary } from "./types"

/** Spanish — neutral/general, intended to work reasonably across regions. */
export const incidentFormEs = {
  category: "Categoría", title: "Título", description: "Descripción",
  date: "Fecha y hora", gps: "Coordenadas GPS", evidence: "Archivos de evidencia",
  cancel: "Cancelar", saveIncident: "Guardar incidente",
}

export const incidentRecordEs = {
  allRecords: "Todos los registros", sealed: "Sellado", unsealed: "No sellado",
  description: "Descripción", noDescription: "No se proporcionó descripción.",
  evidence: "Evidencia", decryptedInMemory: "Descifrado solo en memoria.",
  noAttachments: "No hay archivos adjuntos en este registro.", sealEvidence: "Sellar evidencia",
  sealedCannotDelete: "Los registros sellados son permanentes y no se pueden eliminar.",
  confirmDelete: "Confirmar eliminación", cancel: "Cancelar", deleteRecord: "Eliminar registro",
  edit: "Editar", saveChanges: "Guardar cambios", pdf: "PDF", exporting: "Exportando…",
}

export const incidentFormExtraEs = {
  photo: "Foto", screenshot: "Captura de pantalla", uploadAudio: "Subir archivo de audio",
  uploadDocument: "Subir documento", capture: "Capturar",
  removeLocation: "Eliminar ubicación", removeAttachment: "Eliminar archivo adjunto",
  noLocationAttached: "Sin ubicación adjunta.", locating: "Localizando…",
  geoNotAvailable: "La geolocalización no está disponible en este dispositivo.",
  geoPermissionDenied: "Permiso de ubicación denegado o no disponible.",
  selectCategory: "Selecciona una categoría.", enterTitle: "Ingresa un título.",
  couldNotSaveIncident: "No se pudo guardar el incidente.", encrypting: "Cifrando…",
  cancel: "Cancelar",
}

export const recordsPageEs = {
  title: "Registros", searchPlaceholder: "Buscar título o descripción",
  toggleFilters: "Alternar filtros", category: "Categoría", allCategories: "Todas las categorías",
  from: "Desde", to: "Hasta", sealedStatus: "Estado de sellado", all: "Todos",
  sealedOnly: "Solo sellados", unsealedOnly: "Solo no sellados",
  onlyGpsRecords: "Solo registros con ubicación GPS", clearFilters: "Borrar filtros",
  noIncidentsYet: "Aún no hay incidentes registrados.",
  noRecordsMatchFilters: "Ningún registro coincide con los filtros actuales.",
}

export const es: Dictionary = {
  recordsPage: recordsPageEs,
  incidentForm: incidentFormEs,
  incidentRecord: incidentRecordEs,
  incidentFormExtra: incidentFormExtraEs,
  common: {
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    confirm: "Confirmar",
    edit: "Editar",
    close: "Cerrar",
    loading: "Cargando…",
    error: "Error",
    yes: "Sí",
    no: "No",
    ok: "Aceptar",
    back: "Atrás",
    download: "Descargar",
    saving: "Guardando…",
  },

  nav: {
    records: "Registros",
    patterns: "Patrones",
    vault: "Bóveda",
    newIncident: "Nuevo",
  },

  vault: {
    title: "Witness Protocol",
    locked: "Tu bóveda está bloqueada.",
    unlocked: "Bóveda desbloqueada",
    lockNow: "Bloquear bóveda ahora",
    createPasscode: "Crea tu contraseña",
    confirmPasscode: "Confirma tu contraseña",
    incorrectPasscode: "Contraseña de la bóveda incorrecta.",
    passcodesDoNotMatch: "Las contraseñas no coinciden.",
    couldNotCreateVault: "No se pudo crear la bóveda.",
    investigatorIdentity: "Identidad del Investigador",
    fullName: "Nombre completo",
    governmentId: "Documento de identidad",
    organization: "Organización",
    phone: "Teléfono",
    email: "Correo electrónico",
    saveIdentity: "Guardar Identidad",
    autoLockTitle: "Bloqueo automático por inactividad",
    autoLockDescription:
      "La bóveda se bloquea automáticamente después de {minutes} minuto{plural}.",
    sealAllTitle: "Sellar todos los registros no sellados",
    sealAllDescription: "{count} incidente{plural} aún sin sellar.",
    sealAllButton: "Sellar todos ({count})",
    sealAllNoneUnsealed: "Todos los incidentes están sellados.",
    sealingProgress: "Sellando {processed} de {total}",
    language: "Idioma",
  },

  backup: {
    exportBackup: "Exportar Copia de Seguridad",
    importBackup: "Importar Copia de Seguridad",
    exporting: "Exportando…",
    merging: "Fusionando…",
    restoring: "Restaurando…",
    restoreTitle: "Restaurar copia de seguridad",
    mergeTitle: "Fusionar copia de seguridad",
    restoreSubtitle:
      "Ingresa el PIN de la bóveda usado para crear esta copia de seguridad.",
    mergeSubtitle:
      "Ingresa el PIN usado para crear la copia de seguridad que estás fusionando.",
    backupSaved: "Copia de seguridad guardada:\n{fileName}",
    backupRestored: "Copia de seguridad restaurada con éxito.",
    mergeComplete: "Fusión completada",
    mergeAdded: "{count} registro{plural} nuevo{plural} añadido{plural}",
    mergeDuplicates: "{count} duplicado{plural} omitido{plural}",
    mergeDiverged:
      "{count} registro{plural} añadido{plural} como nuevo (mismo ID, contenido diferente)",
    mergeEvidenceAdded: "{count} archivo{plural} de evidencia importado{plural}",
    dismiss: "Descartar",
    stagePreparing: "Preparando…",
    stageMetadata: "Exportando metadatos…",
    stageEvidence: "Cifrando evidencia…",
    stageFinishing: "Compilando ZIP…",
    stageSaving: "Guardando archivo…",
    incorrectPasscodeOrCorrupted:
      "Contraseña incorrecta o archivo de copia de seguridad dañado.",
  },

  auditLog: {
    title: "Registro de auditoría",
    noActivity: "Aún no hay actividad registrada.",
    showAll: "Mostrar todo ({count})",
    showLess: "Mostrar menos",
    incidentCreated: "Incidente creado",
    incidentEdited: "Incidente editado",
    incidentSealed: "Incidente sellado",
    incidentDeleted: "Incidente eliminado",
    evidenceDownloaded: "Evidencia descargada",
    pdfExported: "PDF exportado",
    backupExported: "Copia de seguridad exportada",
    backupRestored: "Copia de seguridad restaurada",
    backupMerged: "Copia de seguridad fusionada",
  },
}
