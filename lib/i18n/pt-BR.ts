import type { Dictionary } from "./types"

/** Portuguese (Brazil) */
export const incidentFormPtBR = {
  category: "Categoria", title: "Título", description: "Descrição",
  date: "Data e hora", gps: "Coordenadas GPS", evidence: "Anexos de evidência",
  cancel: "Cancelar", saveIncident: "Salvar incidente",
}

export const incidentRecordPtBR = {
  allRecords: "Todos os registros", sealed: "Selado", unsealed: "Não selado",
  description: "Descrição", noDescription: "Nenhuma descrição fornecida.",
  evidence: "Evidência", decryptedInMemory: "Descriptografado apenas na memória.",
  noAttachments: "Nenhum anexo neste registro.", sealEvidence: "Selar evidência",
  sealedCannotDelete: "Registros selados são permanentes e não podem ser excluídos.",
  confirmDelete: "Confirmar exclusão", cancel: "Cancelar", deleteRecord: "Excluir registro",
  edit: "Editar", saveChanges: "Salvar alterações", pdf: "PDF", exporting: "Exportando…",
}

export const incidentFormExtraPtBR = {
  photo: "Foto", screenshot: "Captura de tela", uploadAudio: "Enviar arquivo de áudio",
  uploadDocument: "Enviar documento", capture: "Capturar",
  removeLocation: "Remover localização", removeAttachment: "Remover anexo",
  noLocationAttached: "Nenhuma localização anexada.", locating: "Localizando…",
  geoNotAvailable: "Geolocalização não está disponível neste dispositivo.",
  geoPermissionDenied: "Permissão de localização negada ou indisponível.",
  selectCategory: "Selecione uma categoria.", enterTitle: "Digite um título.",
  couldNotSaveIncident: "Não foi possível salvar o incidente.", encrypting: "Criptografando…",
  cancel: "Cancelar",
}

export const recordsPagePtBR = {
  title: "Registros", searchPlaceholder: "Buscar título ou descrição",
  toggleFilters: "Alternar filtros", category: "Categoria", allCategories: "Todas as categorias",
  from: "De", to: "Até", sealedStatus: "Status de selo", all: "Todos",
  sealedOnly: "Apenas selados", unsealedOnly: "Apenas não selados",
  onlyGpsRecords: "Apenas registros com localização GPS", clearFilters: "Limpar filtros",
  noIncidentsYet: "Nenhum incidente registrado ainda.",
  noRecordsMatchFilters: "Nenhum registro corresponde aos filtros atuais.",
}

export const miscUiPtBR = {
  noDescriptionShort: "Sem descrição.",
  gpsTagged: "GPS marcado",
  stopRecording: "Parar gravação",
  logIncidentTitle: "Registrar incidente",
  logIncidentDescription: "Documente um evento. Todos os campos permanecem neste dispositivo e são criptografados antes do armazenamento.",
  shortSummaryPlaceholder: "Breve resumo do incidente",
  recordVoiceNote: "Gravar nota de voz",
  sealed: "Selado",
  noAttachments: "Sem anexos",
}

export const relativeTimePtBR = {
  justNow: "agora mesmo",
  minutesAgo: "há {n}m",
  hoursAgo: "há {n}h",
  daysAgo: "há {n}d",
}

export const categoriesPtBR = {
  surveillanceName: "Vigilância",
  surveillanceDesc: "Observação, gravação ou atividade de monitoramento.",
  personalTrackingName: "Rastreamento Pessoal",
  personalTrackingDesc: "Seguimento, rastreamento de localização ou monitoramento de movimento.",
  gaslightingName: "Gaslighting",
  gaslightingDesc: "Manipulação, negação ou distorção de eventos.",
  deviceAnomalyName: "Anomalia de Dispositivo",
  deviceAnomalyDesc: "Comportamento inesperado do dispositivo ou irregularidades técnicas.",
  poisoningName: "Envenenamento e Ameaças",
  poisoningDesc: "Suspeita de contaminação de alimentos, água ou ambiente.",
  legalName: "Jurídico",
  legalDesc: "Documentos legais, notificações ou processos.",
  categoryLabel: "Categoria",
  unknown: "Desconhecido",
}

export const ptBR: Dictionary = {
  categories: categoriesPtBR,
  relativeTime: relativeTimePtBR,
  miscUi: miscUiPtBR,
  recordsPage: recordsPagePtBR,
  incidentForm: incidentFormPtBR,
  incidentRecord: incidentRecordPtBR,
  incidentFormExtra: incidentFormExtraPtBR,
  common: {
    save: "Salvar",
    cancel: "Cancelar",
    delete: "Excluir",
    confirm: "Confirmar",
    edit: "Editar",
    close: "Fechar",
    loading: "Carregando…",
    error: "Erro",
    yes: "Sim",
    no: "Não",
    ok: "OK",
    back: "Voltar",
    download: "Baixar",
    saving: "Salvando…",
  },

  nav: {
    records: "Registros",
    patterns: "Padrões",
    vault: "Cofre",
    newIncident: "Novo",
  },

  vault: {
    title: "Witness Protocol",
    locked: "Seu cofre está bloqueado.",
    unlocked: "Cofre desbloqueado",
    lockNow: "Bloquear cofre agora",
    createPasscode: "Crie sua senha",
    confirmPasscode: "Confirme sua senha",
    incorrectPasscode: "Senha do cofre incorreta.",
    passcodesDoNotMatch: "As senhas não coincidem.",
    couldNotCreateVault: "Não foi possível criar o cofre.",
    investigatorIdentity: "Identidade do Investigador",
    fullName: "Nome completo",
    governmentId: "Documento de identidade",
    organization: "Organização",
    phone: "Telefone",
    email: "E-mail",
    saveIdentity: "Salvar Identidade",
    autoLockTitle: "Bloqueio automático por inatividade",
    autoLockDescription:
      "O cofre bloqueia automaticamente após {minutes} minuto{plural}.",
    sealAllTitle: "Selar todos os registros não selados",
    sealAllDescription: "{count} incidente{plural} ainda não selado{plural}.",
    sealAllButton: "Selar todos ({count})",
    sealAllNoneUnsealed: "Todos os incidentes estão selados.",
    sealingProgress: "Selando {processed} de {total}",
    language: "Idioma",
  },

  backup: {
    exportBackup: "Exportar Backup",
    importBackup: "Importar Backup",
    exporting: "Exportando…",
    merging: "Mesclando…",
    restoring: "Restaurando…",
    restoreTitle: "Restaurar backup",
    mergeTitle: "Mesclar backup",
    restoreSubtitle: "Digite o PIN do cofre usado para criar este backup.",
    mergeSubtitle:
      "Digite o PIN usado para criar o backup que você está mesclando.",
    backupSaved: "Backup salvo:\n{fileName}",
    backupRestored: "Backup restaurado com sucesso.",
    mergeComplete: "Mesclagem concluída",
    mergeAdded: "{count} novo{plural} registro{plural} adicionado{plural}",
    mergeDuplicates: "{count} duplicata{plural} ignorada{plural}",
    mergeDiverged:
      "{count} registro{plural} adicionado{plural} como novo (mesmo ID, conteúdo diferente)",
    mergeEvidenceAdded: "{count} arquivo{plural} de evidência importado{plural}",
    dismiss: "Dispensar",
    stagePreparing: "Preparando…",
    stageMetadata: "Exportando metadados…",
    stageEvidence: "Criptografando evidências…",
    stageFinishing: "Compilando ZIP…",
    stageSaving: "Salvando arquivo…",
    incorrectPasscodeOrCorrupted:
      "Senha incorreta ou arquivo de backup corrompido.",
  },

  auditLog: {
    title: "Registro de auditoria",
    noActivity: "Nenhuma atividade registrada ainda.",
    showAll: "Mostrar tudo ({count})",
    showLess: "Mostrar menos",
    incidentCreated: "Incidente criado",
    incidentEdited: "Incidente editado",
    incidentSealed: "Incidente selado",
    incidentDeleted: "Incidente excluído",
    evidenceDownloaded: "Evidência baixada",
    pdfExported: "PDF exportado",
    backupExported: "Backup exportado",
    backupRestored: "Backup restaurado",
    backupMerged: "Backup mesclado",
  },
}
