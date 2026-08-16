export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Reading = {
  timestamp_s: number;
  height_cm: number;
  status: string;
  color: string;
};

export type ProcessResult = {
  video_id: number;
  filename: string;
  nome_trecho: string | null;
  average_height_cm: number;
  status: string;
  color: string;
  km_inicio: number | null;
  km_fim: number | null;
  readings: Reading[];
};

export type VideoRow = {
  id: number;
  filename: string;
  nome_trecho: string | null;
  is_exemplo: number;
  created_at: string;
  average_height_cm: number;
  status: string;
  km_inicio: number | null;
  km_fim: number | null;
  rocada_solicitada_em: string | null;
  rocada_agendada_para: string | null;
  previsao_dias_ate_critico: number | null;
  previsao_data_critico: string | null;
};

export type CronogramaItem = {
  video_id: number;
  filename: string;
  nome_trecho: string | null;
  is_exemplo: boolean;
  km_inicio: number;
  km_fim: number;
  status: string;
  average_height_cm: number;
  dia: number;
  distancia_anterior_km: number;
  rocada_solicitada_em: string | null;
  rocada_agendada_para: string | null;
  previsao_dias_ate_critico: number | null;
  previsao_data_critico: string | null;
};

export type CronogramaResponse = {
  max_km_dia: number;
  total_dias: number;
  cronograma: CronogramaItem[];
};

export const STATUS_STYLES: Record<string, string> = {
  CRITICO: "bg-negative/10 text-negative border-negative/30",
  ALERTA: "bg-alert/15 text-[#946200] border-alert/40 dark:text-alert",
  OK: "bg-positive/10 text-positive border-positive/30",
};

export const STATUS_BAR: Record<string, string> = {
  CRITICO: "bg-negative",
  ALERTA: "bg-alert",
  OK: "bg-positive",
};

export function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? "bg-black/5 dark:bg-white/10 border-black/10";
}

export function statusBar(status: string) {
  return STATUS_BAR[status] ?? "bg-muted";
}

export const STATUS_RECOMMENDATION: Record<string, string> = {
  CRITICO: "Priorizar roçada imediata",
  ALERTA: "Agendar roçada nos próximos dias",
  OK: "Sem ação necessária",
};

export function statusRecommendation(status: string) {
  return STATUS_RECOMMENDATION[status] ?? "—";
}

/** Duração assumida do trecho filmado, para estimar a posição em km de cada
 * leitura ao longo do vídeo (o processamento real não mede velocidade —
 * é uma aproximação de demonstração). */
export const DURACAO_ASSUMIDA_S = 60;

export function textoPrevisao(diasAteCritico: number | null, dataCritico: string | null): string | null {
  if (diasAteCritico === null) return null;
  if (diasAteCritico === 0) return null;
  const dataFormatada = dataCritico
    ? new Date(dataCritico + "T00:00:00").toLocaleDateString("pt-BR")
    : null;
  return `Previsão: atinge CRÍTICO em ~${diasAteCritico} dia${diasAteCritico > 1 ? "s" : ""}${dataFormatada ? ` (${dataFormatada})` : ""}`;
}

export function formatarDataBR(data: string): string {
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

export function kmDaLeitura(
  timestamp_s: number,
  km_inicio: number | null,
  km_fim: number | null,
): number | null {
  if (km_inicio === null || km_fim === null) return null;
  const fracao = Math.min(1, timestamp_s / DURACAO_ASSUMIDA_S);
  return Math.round((km_inicio + fracao * (km_fim - km_inicio)) * 100) / 100;
}

/** Canal para o Dashboard e o Cronograma avisarem um ao outro (mesma
 * origem, abas diferentes) sempre que um trecho é alterado — solicitar
 * roçada, agendar, editar localização ou processar um vídeo novo. */
const CANAL_DADOS = "veroai-dados-atualizados";

export function notificarDadosAtualizados() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const canal = new BroadcastChannel(CANAL_DADOS);
  canal.postMessage("atualizado");
  canal.close();
}

export function ouvirDadosAtualizados(callback: () => void): () => void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return () => {};
  }
  const canal = new BroadcastChannel(CANAL_DADOS);
  canal.onmessage = () => callback();
  return () => canal.close();
}
