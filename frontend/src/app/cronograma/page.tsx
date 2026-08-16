"use client";

import { useEffect, useState } from "react";
import {
  API_URL,
  formatarDataBR,
  notificarDadosAtualizados,
  ouvirDadosAtualizados,
  statusStyle,
  textoPrevisao,
  type CronogramaItem,
  type CronogramaResponse,
} from "@/lib/api";

export default function CronogramaPage() {
  const [data, setData] = useState<CronogramaResponse | null>(null);
  const [maxKmDia, setMaxKmDia] = useState("20");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agendaEditId, setAgendaEditId] = useState<number | null>(null);
  const [agendaForm, setAgendaForm] = useState("");
  const [buscandoHorarioId, setBuscandoHorarioId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/cronograma?max_km_dia=${maxKmDia}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch(() =>
        setError("Não foi possível carregar o cronograma. A API está rodando?"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return ouvirDadosAtualizados(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function atualizarItem(videoId: number, patch: Partial<CronogramaItem>) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            cronograma: prev.cronograma.map((item) =>
              item.video_id === videoId ? { ...item, ...patch } : item,
            ),
          }
        : prev,
    );
  }

  async function solicitarRocada(videoId: number) {
    const res = await fetch(`${API_URL}/api/videos/${videoId}/solicitar-rocada`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      atualizarItem(videoId, { rocada_solicitada_em: updated.rocada_solicitada_em });
      notificarDadosAtualizados();
    }
  }

  async function cancelarRocada(videoId: number) {
    const res = await fetch(`${API_URL}/api/videos/${videoId}/solicitar-rocada`, { method: "DELETE" });
    if (res.ok) {
      atualizarItem(videoId, { rocada_solicitada_em: null });
      notificarDadosAtualizados();
    }
  }

  async function salvarAgendamento(videoId: number, data: string) {
    if (!data) return;
    const res = await fetch(`${API_URL}/api/videos/${videoId}/agendar-rocada`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (res.ok) {
      atualizarItem(videoId, { rocada_agendada_para: data });
      setAgendaEditId(null);
      notificarDadosAtualizados();
    }
  }

  async function cancelarAgendamento(videoId: number) {
    const res = await fetch(`${API_URL}/api/videos/${videoId}/agendar-rocada`, { method: "DELETE" });
    if (res.ok) {
      atualizarItem(videoId, { rocada_agendada_para: null });
      notificarDadosAtualizados();
    }
  }

  async function agendarQuantoAntes(videoId: number) {
    setBuscandoHorarioId(videoId);
    try {
      const resHorario = await fetch(`${API_URL}/api/proximo-horario-disponivel`);
      if (!resHorario.ok) return;
      const { data } = await resHorario.json();
      await salvarAgendamento(videoId, data);
    } finally {
      setBuscandoHorarioId(null);
    }
  }

  const dias = new Map<number, CronogramaItem[]>();
  data?.cronograma.forEach((item) => {
    const lista = dias.get(item.dia) ?? [];
    lista.push(item);
    dias.set(item.dia, lista);
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">
        Planejamento
      </p>
      <h1 className="mt-2 text-3xl font-bold text-motiva-dark dark:text-white">
        Sugestão de cronograma de roçada
      </h1>
      <p className="mt-2 text-muted">
        Ordena os trechos por criticidade da vegetação (CRÍTICO primeiro) e,
        dentro do mesmo nível, agrupa trechos próximos entre si em blocos de
        trabalho por dia — para não atrasar um trecho crítico e, ao mesmo
        tempo, minimizar o deslocamento entre trechos no mesmo dia. Só entram
        aqui trechos com localização (km) cadastrada no{" "}
        <a href="/dashboard" className="font-medium text-motiva underline underline-offset-4">
          Dashboard
        </a>
        .
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border-soft bg-focus-light/60 p-4 dark:border-white/15 dark:bg-white/5">
        <div>
          <label className="block text-xs font-medium text-muted">
            Distância máxima por dia (km)
          </label>
          <input
            type="number"
            value={maxKmDia}
            onChange={(e) => setMaxKmDia(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-border-soft bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-white/10"
          />
        </div>
        <button
          onClick={load}
          className="rounded-lg bg-motiva px-3 py-1.5 text-sm font-medium text-white"
        >
          Recalcular
        </button>
      </div>

      {loading && <p className="mt-8 text-muted">Carregando…</p>}

      {error && (
        <p className="mt-8 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}

      {!loading && !error && data && data.cronograma.length === 0 && (
        <p className="mt-8 text-muted">
          Nenhum trecho com localização cadastrada ainda. Defina o km de
          início/fim de um trecho no{" "}
          <a href="/dashboard" className="font-medium text-motiva underline underline-offset-4">
            Dashboard
          </a>{" "}
          para ele aparecer no cronograma.
        </p>
      )}

      {!loading && !error && data && data.cronograma.length > 0 && (
        <div className="mt-8 space-y-6">
          {Array.from(dias.entries()).map(([dia, itens]) => (
            <div
              key={dia}
              className="rounded-xl border border-border-soft dark:border-white/15"
            >
              <div className="flex items-center justify-between border-b border-border-soft bg-focus-light px-4 py-3 dark:border-white/15 dark:bg-white/5">
                <h2 className="font-semibold text-motiva-dark dark:text-white">
                  Dia {dia}
                </h2>
                <span className="text-xs text-muted">
                  {itens.length} trecho{itens.length > 1 ? "s" : ""}
                  {" · "}
                  {Math.round(itens.reduce((acc, i) => acc + i.distancia_anterior_km, 0) * 10) / 10} km de deslocamento
                </span>
              </div>
              <ul className="divide-y divide-border-soft/60 dark:divide-white/10">
                {itens.map((item, idx) => {
                  const expandido = expandedId === item.video_id;
                  const temAcao = !!item.rocada_solicitada_em || !!item.rocada_agendada_para;
                  return (
                    <li key={item.video_id}>
                      <button
                        onClick={() => setExpandedId(expandido ? null : item.video_id)}
                        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-focus-light dark:hover:bg-white/5"
                      >
                        <div>
                          <p className="flex items-center gap-2 font-medium">
                            <span>{item.nome_trecho || item.filename}</span>
                            {item.is_exemplo && (
                              <span className="rounded-full border border-muted/30 bg-focus-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted dark:border-white/20 dark:bg-white/10">
                                Exemplo
                              </span>
                            )}
                          </p>
                          <p className="tabular-nums text-muted">
                            km {item.km_inicio} – {item.km_fim}
                            {idx === 0 ? (
                              <span> · primeiro trecho do dia</span>
                            ) : (
                              <span> · +{item.distancia_anterior_km} km do trecho anterior</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-muted">
                            {item.average_height_cm} cm
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(item.status)}`}
                          >
                            {item.status}
                          </span>
                          {temAcao ? (
                            <span className="whitespace-nowrap rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
                              {item.rocada_solicitada_em && item.rocada_agendada_para
                                ? `Solicitada · ${formatarDataBR(item.rocada_agendada_para)}`
                                : item.rocada_agendada_para
                                  ? `Agendada: ${formatarDataBR(item.rocada_agendada_para)}`
                                  : "Solicitada"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">
                              {expandido ? "Fechar ▲" : "Agir ▼"}
                            </span>
                          )}
                        </div>
                      </button>

                      {expandido && (
                        <div className="mx-4 mb-3 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border-soft bg-focus-light/60 p-4 dark:border-white/15 dark:bg-white/5">
                          {textoPrevisao(item.previsao_dias_ate_critico, item.previsao_data_critico) && (
                            <p className="w-full text-sm text-alert/90">
                              {textoPrevisao(item.previsao_dias_ate_critico, item.previsao_data_critico)}
                            </p>
                          )}

                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                              Solicitação
                            </p>
                            {item.rocada_solicitada_em ? (
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
                                  Solicitada
                                </span>
                                <button
                                  onClick={() => cancelarRocada(item.video_id)}
                                  className="text-xs text-muted underline underline-offset-4"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => solicitarRocada(item.video_id)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                                  item.status === "CRITICO"
                                    ? "bg-negative hover:bg-negative/90"
                                    : "bg-motiva hover:bg-motiva-dark"
                                }`}
                              >
                                Solicitar roçada
                              </button>
                            )}
                          </div>

                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                              Agendamento
                            </p>
                            {item.rocada_agendada_para ? (
                              <div className="flex items-center gap-2">
                                <span className="whitespace-nowrap rounded-full border border-motiva/30 bg-motiva/10 px-2.5 py-1 text-xs font-medium text-motiva-dark dark:text-white">
                                  Agendada: {formatarDataBR(item.rocada_agendada_para)}
                                </span>
                                <button
                                  onClick={() => cancelarAgendamento(item.video_id)}
                                  className="text-xs text-muted underline underline-offset-4"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : agendaEditId === item.video_id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={agendaForm}
                                  onChange={(e) => setAgendaForm(e.target.value)}
                                  className="rounded border border-border-soft bg-white px-1.5 py-1 text-xs dark:border-white/20 dark:bg-white/10"
                                />
                                <button
                                  onClick={() => salvarAgendamento(item.video_id, agendaForm)}
                                  disabled={!agendaForm}
                                  className="rounded bg-motiva px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => setAgendaEditId(null)}
                                  className="text-xs text-muted underline"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    setAgendaEditId(item.video_id);
                                    setAgendaForm("");
                                  }}
                                  className="rounded-lg border border-motiva/30 px-3 py-1.5 text-xs font-medium text-motiva-dark hover:bg-white dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                                >
                                  Agendar
                                </button>
                                {item.status === "CRITICO" && (
                                  <button
                                    onClick={() => agendarQuantoAntes(item.video_id)}
                                    disabled={buscandoHorarioId === item.video_id}
                                    className="text-xs font-medium text-negative underline underline-offset-4 disabled:opacity-50"
                                  >
                                    {buscandoHorarioId === item.video_id ? "Buscando…" : "Assim que possível"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
