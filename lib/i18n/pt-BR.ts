// Witness Protocol
// Copyright (C) 2026 Samuel Matias Tiem
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
  decryptingAttachments: "Descriptografando anexos…",
  readyToSaveShare: "Pronto para salvar/compartilhar:\n{name}",
  downloadFailed: "Falha ao baixar: {error}\n\nSe isso persistir, permita o acesso ao armazenamento para este aplicativo nas Configurações do Android.",
  evidenceSeal: "Selo de evidência", sealedAt: "Selado {time}",
  sealedCannotDelete: "Registros selados são permanentes e não podem ser excluídos.",
  confirmDelete: "Confirmar exclusão", cancel: "Cancelar", deleteRecord: "Excluir registro",
  edit: "Editar", saveChanges: "Salvar alterações", pdf: "PDF", exporting: "Exportando…",
}

export const incidentFormExtraPtBR = {
  photo: "Foto", screenshot: "Captura de tela", uploadAudio: "Enviar arquivo de áudio",
  uploadDocument: "Enviar documento", capture: "Capturar",
  removeLocation: "Remover localização", removeAttachment: "Remover anexo",
  descriptionPlaceholder: "O que aconteceu? Inclua os detalhes enquanto estão frescos.",
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
  exportAllPdf: "Exportar tudo como PDF",
  exportingAllPdf: "Exportando incidentes…",
  exportingAllPdfProgress: "Exportando lote {current} de {total}…",
  exportAllPdfFailed: "Falha ao exportar o PDF: {error}",
  packageAll: "Pacote",
  packagingAll: "Empacotando incidentes…",
  packagingAllProgress: "Empacotando {current} de {total}…",
  packageAllFailed: "Falha ao gerar o pacote: {error}",
}

export const diaryPagePtBR = {
  title: "Diário",
  noEntriesYet: "Nenhuma entrada de diário ainda. Toque no botão vermelho para gravar uma.",
  hasAudio: "Áudio",
  noAudio: "Sem áudio",
  includeInPackage: "Incluir diário na exportação do Pacote",
}

export const diaryEntryPtBR = {
  allEntries: "Diário",
  notFound: "Este registro não foi encontrado. Ele pode ter sido excluído, ou o cofre precisa ser desbloqueado.",
  textLabel: "Notas",
  textPlaceholder: "Adicione uma nota sobre esta gravação…",
  saveText: "Salvar",
  audioLabel: "Gravação",
  recordedAt: "Gravado {time}",
  deleteEntry: "Excluir entrada",
  confirmDelete: "Confirmar exclusão",
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

export const evidenceHintPtBR = {
  selectCategoryPlaceholder: "Selecione a categoria",
  evidenceDisclaimer: "As imagens têm os metadados EXIF removidos, são hasheadas com SHA-256 e criptografadas antes do armazenamento.",
}

export const ptBR: Dictionary = {
  evidenceHint: evidenceHintPtBR,
  categories: categoriesPtBR,
  relativeTime: relativeTimePtBR,
  miscUi: miscUiPtBR,
  recordsPage: recordsPagePtBR,
  diaryPage: diaryPagePtBR,
  diaryEntry: diaryEntryPtBR,
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
    diary: "Diário",
  },

  vault: {
    title: "Witness Protocol",
    locked: "Seu cofre está bloqueado.",
    unlocked: "Cofre desbloqueado",
    lockNow: "Bloquear cofre agora",
    systemLanguage: "Sistema",
    minuteSingular: "minuto",
    minutesPlural: "minutos",
    createPasscode: "Crie sua senha",
    confirmPasscode: "Confirme sua senha",
    incorrectPasscode: "Senha do cofre incorreta.",
    passcodesDoNotMatch: "As senhas não coincidem.",
    couldNotCreateVault: "Não foi possível criar o cofre.",
    investigatorIdentity: "Identidade do Investigador",
    fullName: "Nome completo",
    governmentId: "Documento de identidade",
    idDocument: "Documento de Identidade",
    attachIdDocument: "Anexar Documento de Identidade",
    idDocumentTooLarge: "O arquivo é muito grande. Escolha um arquivo com menos de 10 MB.",
    downloadIdDocument: "Baixar",
    removeIdDocument: "Remover",
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
    includeIdDocumentExport: "Incluir documento de identidade",
    includeIdDocumentRestore: "Incluir documento de identidade",
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
    mergeIdentityImported: "Identidade do investigador importada",
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
    diaryEntryCreated: "Entrada de diário criada",
  },

  patterns: {
    title: "Revisão de padrões",
    description:
      "Análise local, no próprio dispositivo, dos seus registros. Apenas observações e correlações — nunca afirmações sobre causa ou intenção.",
    recordsAnalyzed: "{count} registro{plural} analisado{plural}",
    neverRun: "Execute a análise para atualizar as observações.",
    lastRun: "Última execução {time}",
    run: "Executar",
    empty:
      "Ainda não há observações. Registre alguns incidentes e depois execute a análise. Os achados aparecerão aqui como correlações estatísticas neutras.",
    caution:
      "Esta ferramenta relata correlações dentro do seu próprio histórico. Ela não identifica pessoas, não atribui culpa e não infere intenção externa. Interprete os achados com cautela.",

    severity: {
      info: "informativo",
      notable: "relevante",
      high: "alto",
    },

    weekdays: {
      "0": "domingo",
      "1": "segunda-feira",
      "2": "terça-feira",
      "3": "quarta-feira",
      "4": "quinta-feira",
      "5": "sexta-feira",
      "6": "sábado",
    },

    timeBlocks: {
      dawn: "madrugada",
      morning: "manhã",
      afternoon: "tarde",
      evening: "fim da tarde",
      night: "noite",
    },

    alertTitles: {
      repeatedTime: "Padrão repetido de horário",
      repeatedLocation: "Padrão repetido de localização",
      frequencySpike: "Pico de frequência",
      categoryCluster: "Concentração por categoria",
      activityTrendIncreasing: "Tendência de atividade em alta",
      activityTrendDecreasing: "Tendência de atividade em queda",
      activityTrendStable: "Tendência de atividade estável",
      weekdayCluster: "Padrão repetido por dia da semana",
      weekdayTimeCluster: "Padrão repetido por dia/horário",
    },

    alertText: {
      repeatedTime:
        "{count} registros foram anotados no período da {block}.",
      repeatedLocation:
        "{count} registros foram anotados na mesma célula aproximada de localização ({cell}).",
      frequencySpike:
        "Foi detectado um pico em {day}, com {count} registros anotados.",
      categoryCluster:
        "{category} representa {share}% de todos os registros anotados.",
      activityTrendIncreasing:
        "Os registros recentes sugerem uma tendência de aumento na frequência dos relatos.",
      activityTrendDecreasing:
        "Os registros recentes sugerem uma tendência de queda na frequência dos relatos.",
      activityTrendStable:
        "Os registros recentes sugerem uma tendência estável na frequência dos relatos.",
      weekdayCluster:
        "{count} registros foram anotados em {day}.",
      weekdayTimeCluster:
        "{count} registros foram anotados em {day}, no período da {block}.",
    },

    alertDetail: {
      repeatedTime: "{share}% de todos os incidentes ocorrem nesta janela de horário.",
      repeatedLocation: "Coordenadas arredondadas para ~110m de precisão.",
      frequencySpike: "A média diária é {average} (±{std}).",
      categoryCluster: "{count} de {total} incidentes no total.",
      weekdayCluster: "{share}% de todos os incidentes ocorrem no mesmo dia da semana.",
      weekdayTimeCluster:
        "{count} incidentes ({share}% do registro) compartilham este dia da semana/horário.",
      activityTrendIncreasing:
        "Mudança estimada de {perWeek} incidentes/semana ao longo de {spanDays} dias.",
      activityTrendDecreasing:
        "Mudança estimada de {perWeek} incidentes/semana ao longo de {spanDays} dias.",
      activityTrendStable: "Mudança de {perWeek} incidentes/semana.",
    },
  },

  pdfExport: {
    investigatorIdentity: "Identidade do Investigador",
    name: "Nome:", governmentId: "Documento de identificação:", organization: "Organização:",
    phone: "Telefone:", email: "E-mail:",
    untitledIncident: "Incidente sem título",
    category: "Categoria:", occurred: "Ocorreu em:", logged: "Registrado em:", status: "Status:",
    sealed: "Selado", unsealed: "Não selado", gps: "GPS:",
    description: "Descrição", noDescriptionProvided: "Nenhuma descrição fornecida.",
    evidenceCount: "Evidência ({count})", noAttachments: "Nenhum anexo neste registro.",
    imageEmbedFailed: "[Não foi possível inserir a imagem]",
    documentPlaceholder: "[Documento - veja a exportação de arquivo separada]",
    voicePlaceholder: "[Gravação de voz - veja a exportação de arquivo separada]",
    evidenceSeal: "Selo de Evidência", sealedAt: "Selado em: {time}",
    footer: "Gerado pelo Witness Protocol · {date} · Página {page} de {total}",
    bulkReportTitle: "Relatório de Incidentes — {count} registro(s)",
    generatedAt: "Gerado em {date}",
  },

  report: {
    title: "Relatório de Incidentes",
    generatedOn: "Gerado em:",
    timelineHeading: "Linha do Tempo de Incidentes",
    patternsHeading: "Resumo de Padrões",
    noIncidents: "Nenhum incidente neste período.",
    noPatterns: "Nenhum padrão detectado neste período.",
    footer: "Gerado pelo Witness Protocol",
    signatureLine: "Assinatura",
    optionsTitle: "Opções do Relatório",
    dateFrom: "Data inicial",
    dateTo: "Data final",
    categoriesLabel: "Categorias a incluir",
    allCategories: "Todas as categorias",
    includeEvidence: "Incluir lista de evidências",
    formatLabel: "Formato",
    formatPlainText: "Texto simples (.txt)",
    formatRichText: "Texto rico (impressão/PDF)",
    generate: "Gerar Relatório",
    generating: "Gerando…",
    generateFailed: "Falha ao gerar o relatório: {error}",
    noIncidentsToReport: "Nenhum incidente corresponde aos filtros selecionados.",
  },

  heatMap: {
    title: "Mapa de Calor",
    consentTitle: "Este recurso requer acesso à internet",
    consentBody: "O mapa de calor carrega imagens de mapa de um provedor online. Seus dados de incidentes nunca são enviados a lugar nenhum -- apenas solicitações genéricas de blocos de mapa para a área que você está visualizando. Todo o resto neste aplicativo permanece totalmente offline e no dispositivo.",
    consentProceed: "Sim, continuar",
    showHeatOverlay: "Mostrar sobreposição de calor",
    noGpsIncidents: "Nenhum incidente com localização GPS para exibir.",
    viewIncident: "Ver incidente",
  },
}
