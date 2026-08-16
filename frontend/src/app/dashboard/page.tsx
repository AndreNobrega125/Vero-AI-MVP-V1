"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  API_URL,
  DURACAO_ASSUMIDA_S,
  formatarDataBR,
  kmDaLeitura,
  notificarDadosAtualizados,
  ouvirDadosAtualizados,
  statusBar,
  statusRecommendation,
  statusStyle,
  textoPrevisao,
  type Reading,
  type VideoRow,
} from "@/lib/api";

const FILTERS = ["TODOS", "CRITICO", "ALERTA", "OK"] as const;
type Filter = (typeof FILTERS)[number];

export default function DashboardPage() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("TODOS");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [readings, setReadings] = useState<Record<number, Reading[]>>({});
  const [kmRef, setKmRef] = useState("");
  const [raioKm, setRaioKm] = useState("");
  const [locEditId, setLocEditId] = useState<number | null>(null);
  const [locForm, setLocForm] = useState({ km_inicio: "", km_fim: "" });
  const [agendaEditId, setAgendaEditId] = useState<number | null>(null);
  const [agendaForm, setAgendaForm] = useState("");
  const [buscandoHorarioId, setBuscandoHorarioId] = useState<number | null>(null);

  function loadVideos() {
    setLoading(true);
    const params = new URLSearchParams();
    if (kmRef !== "" && raioKm !== "") {
      params.set("km_ref", kmRef);
      params.set("raio_km", raioKm);
    }
    const query = params.toString();
    fetch(`${API_URL}/api/videos${query ? `?${query}` : ""}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        return res.json();
      })
      .then(setVideos)
      .catch(() =>
        setError("Não foi possível carregar os dados. A API está rodando?"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return ouvirDadosAtualizados(loadVideos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvarLocalizacao(id: number) {
    const km_inicio = parseFloat(locForm.km_inicio);
    const km_fim = parseFloat(locForm.km_fim);
    if (Number.isNaN(km_inicio) || Number.isNaN(km_fim)) return;
    if (km_fim < km_inicio) return;
    const res = await fetch(`${API_URL}/api/videos/${id}/localizacao`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ km_inicio, km_fim }),
    });
    if (res.ok) {
      const updated = await res.json();
      setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)));
      setLocEditId(null);
      notificarDadosAtualizados();
    }
  }

  async function solicitarRocada(id: number) {
    const res = await fetch(`${API_URL}/api/videos/${id}/solicitar-rocada`, { method: "POST" });
    if (res.ok) {
      const updated = await res.json();
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
      notificarDadosAtualizados();
    }
  }

  async function cancelarRocada(id: number) {
    const res = await fetch(`${API_URL}/api/videos/${id}/solicitar-rocada`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
      notificarDadosAtualizados();
    }
  }

  async function salvarAgendamento(id: number, data: string) {
    if (!data) return;
    const res = await fetch(`${API_URL}/api/videos/${id}/agendar-rocada`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (res.ok) {
      const updated = await res.json();
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
      setAgendaEditId(null);
      notificarDadosAtualizados();
    }
  }

  async function cancelarAgendamento(id: number) {
    const res = await fetch(`${API_URL}/api/videos/${id}/agendar-rocada`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
      notificarDadosAtualizados();
    }
  }

  async function agendarQuantoAntes(id: number) {
    setBuscandoHorarioId(id);
    try {
      const resHorario = await fetch(`${API_URL}/api/proximo-horario-disponivel`);
      if (!resHorario.ok) return;
      const { data } = await resHorario.json();
      await salvarAgendamento(id, data);
    } finally {
      setBuscandoHorarioId(null);
    }
  }

  async function toggleRow(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!readings[id]) {
      const res = await fetch(`${API_URL}/api/videos/${id}/readings`);
      if (res.ok) {
        const data = await res.json();
        setReadings((prev) => ({ ...prev, [id]: data.readings }));
      }
    }
  }

  const filtered = useMemo(
    () => (filter === "TODOS" ? videos : videos.filter((v) => v.status === filter)),
    [videos, filter],
  );

  const kpis = useMemo(() => {
    if (videos.length === 0) {
      return { total: 0, media: 0, criticos: 0 };
    }
    return {
      total: videos.length,
      media:
        Math.round(
          (videos.reduce((acc, v) => acc + v.average_height_cm, 0) /
            videos.length) *
            10,
        ) / 10,
      criticos: videos.filter((v) => v.status === "CRITICO").length,
    };
  }, [videos]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">
        Plataforma de dados
      </p>
      <h1 className="mt-2 text-3xl font-bold text-motiva-dark dark:text-white">
        Dashboard de trechos
      </h1>
      <p className="mt-2 text-muted">
        Acompanhamento dos trechos analisados pelo VeroAI. Cada registro
        corresponde a um vídeo processado, com a altura média da vegetação e a
        criticidade do trecho.
      </p>
      <p className="mt-1 text-sm">
        <a
          href="/cronograma"
          className="font-medium text-motiva underline underline-offset-4"
        >
          Ver sugestão de cronograma de roçada →
        </a>
      </p>

      {!loading && !error && videos.length > 0 && (
        <p className="mt-4 rounded-lg border border-motiva/20 bg-motiva/5 px-4 py-3 text-sm text-motiva-dark dark:border-white/15 dark:bg-white/5 dark:text-white">
          {kpis.criticos > 0
            ? `${kpis.criticos} de ${kpis.total} trecho${kpis.total > 1 ? "s" : ""} analisado${kpis.total > 1 ? "s" : ""} ${kpis.criticos > 1 ? "estão" : "está"} em estado CRÍTICO e precisa${kpis.criticos > 1 ? "m" : ""} de roçada prioritária.`
            : `Nenhum trecho em estado crítico no momento — altura média geral de ${kpis.media}cm.`}
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border-soft bg-white p-5 dark:border-white/15 dark:bg-white/5">
          <p className="text-sm text-muted">Trechos analisados</p>
          <p className="mt-1 text-3xl font-bold text-motiva-dark dark:text-white">
            {kpis.total}
          </p>
        </div>
        <div className="rounded-xl border border-border-soft bg-white p-5 dark:border-white/15 dark:bg-white/5">
          <p className="text-sm text-muted">Altura média geral</p>
          <p className="mt-1 text-3xl font-bold text-motiva-dark dark:text-white">
            {kpis.media}
            <span className="ml-1 text-lg font-normal text-muted">cm</span>
          </p>
        </div>
        <div className="rounded-xl border border-negative/30 bg-negative/10 p-5">
          <p className="text-sm text-negative/80">Trechos críticos</p>
          <p className="mt-1 text-3xl font-bold text-negative">
            {kpis.criticos}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              filter === f
                ? "border-transparent bg-motiva text-white"
                : "border-border-soft text-muted hover:bg-focus-light dark:border-white/20 dark:hover:bg-white/10"
            }`}
          >
            {f === "TODOS" ? "Todos" : f}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border-soft bg-focus-light/60 p-4 dark:border-white/15 dark:bg-white/5">
        <div>
          <label className="block text-xs font-medium text-muted">
            Km de referência
          </label>
          <input
            type="number"
            value={kmRef}
            onChange={(e) => setKmRef(e.target.value)}
            placeholder="ex: 42"
            className="mt-1 w-28 rounded-lg border border-border-soft bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-white/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">
            Raio (km)
          </label>
          <input
            type="number"
            value={raioKm}
            onChange={(e) => setRaioKm(e.target.value)}
            placeholder="ex: 10"
            className="mt-1 w-24 rounded-lg border border-border-soft bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-white/10"
          />
        </div>
        <button
          onClick={loadVideos}
          className="rounded-lg bg-motiva px-3 py-1.5 text-sm font-medium text-white"
        >
          Filtrar por distância
        </button>
        {(kmRef !== "" || raioKm !== "") && (
          <button
            onClick={() => {
              setKmRef("");
              setRaioKm("");
              loadVideos();
            }}
            className="text-sm text-muted underline underline-offset-4"
          >
            Limpar
          </button>
        )}
        <p className="w-full text-xs text-muted">
          Mostra apenas trechos cujo ponto médio (km_inicio–km_fim) está a até
          o raio informado do km de referência. Trechos sem localização
          cadastrada não entram no filtro.
        </p>
      </div>

      {loading && <p className="mt-8 text-muted">Carregando…</p>}

      {error && (
        <p className="mt-8 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && videos.length === 0 && (
        <p className="mt-8 text-muted">
          Nenhum trecho registrado ainda. Processe um vídeo em{" "}
          <a href="/processar" className="font-medium text-motiva underline underline-offset-4">
            Testar Protótipo
          </a>
          .
        </p>
      )}

      {!loading && !error && filtered.length === 0 && videos.length > 0 && kmRef !== "" && raioKm !== "" && (
        <p className="mt-8 text-muted">
          Nenhum trecho a até {raioKm} km do km {kmRef}.{" "}
          <button
            onClick={() => {
              setKmRef("");
              setRaioKm("");
              loadVideos();
            }}
            className="font-medium text-motiva underline underline-offset-4"
          >
            Limpar filtro de distância
          </button>
          .
        </p>
      )}

      {!loading && !error && filtered.length === 0 && videos.length > 0 && !(kmRef !== "" && raioKm !== "") && (
        <p className="mt-8 text-muted">
          Nenhum trecho com status {filter}.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border-soft dark:border-white/15">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-soft bg-focus-light text-xs uppercase tracking-wide text-muted dark:border-white/15 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium">Trecho / arquivo</th>
                <th className="px-4 py-3 font-medium">Localização (km)</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Altura média</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Roçada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((video) => (
                <Fragment key={video.id}>
                  <tr
                    onClick={() => toggleRow(video.id)}
                    className="cursor-pointer border-b border-border-soft/60 bg-white hover:bg-focus-light dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{video.nome_trecho || video.filename}</span>
                        {!!video.is_exemplo && (
                          <span className="rounded-full border border-muted/30 bg-focus-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted dark:border-white/20 dark:bg-white/10">
                            Exemplo
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {locEditId === video.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={locForm.km_inicio}
                            onChange={(e) =>
                              setLocForm((f) => ({ ...f, km_inicio: e.target.value }))
                            }
                            placeholder="início"
                            className="w-16 rounded border border-border-soft bg-white px-1.5 py-1 text-xs dark:border-white/20 dark:bg-white/10"
                          />
                          <span>–</span>
                          <input
                            type="number"
                            value={locForm.km_fim}
                            onChange={(e) =>
                              setLocForm((f) => ({ ...f, km_fim: e.target.value }))
                            }
                            placeholder="fim"
                            className="w-16 rounded border border-border-soft bg-white px-1.5 py-1 text-xs dark:border-white/20 dark:bg-white/10"
                          />
                          <button
                            onClick={() => salvarLocalizacao(video.id)}
                            disabled={
                              locForm.km_inicio === "" ||
                              locForm.km_fim === "" ||
                              parseFloat(locForm.km_fim) < parseFloat(locForm.km_inicio)
                            }
                            className="rounded bg-motiva px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setLocEditId(null)}
                            className="text-xs text-muted underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : video.km_inicio !== null && video.km_fim !== null ? (
                        <button
                          onClick={() => {
                            setLocEditId(video.id);
                            setLocForm({
                              km_inicio: String(video.km_inicio),
                              km_fim: String(video.km_fim),
                            });
                          }}
                          className="tabular-nums underline decoration-dotted underline-offset-4"
                        >
                          {video.km_inicio} – {video.km_fim} km
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setLocEditId(video.id);
                            setLocForm({ km_inicio: "", km_fim: "" });
                          }}
                          className="text-xs font-medium text-motiva underline underline-offset-4"
                        >
                          Definir localização
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{video.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {video.average_height_cm} cm
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(video.status)}`}
                      >
                        {video.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {video.rocada_solicitada_em && video.rocada_agendada_para ? (
                        <span className="whitespace-nowrap rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
                          Solicitada · {formatarDataBR(video.rocada_agendada_para)}
                        </span>
                      ) : video.rocada_agendada_para ? (
                        <span className="whitespace-nowrap rounded-full border border-motiva/30 bg-motiva/10 px-2.5 py-1 text-xs font-medium text-motiva-dark dark:text-white">
                          Agendada: {formatarDataBR(video.rocada_agendada_para)}
                        </span>
                      ) : video.rocada_solicitada_em ? (
                        <span className="whitespace-nowrap rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
                          Solicitada
                        </span>
                      ) : (
                        <span className="text-xs text-muted">
                          Sem ação — clique para agir
                        </span>
                      )}
                    </td>
                  </tr>
                  {expandedId === video.id && (
                    <tr>
                      <td colSpan={6} className="bg-focus-light/60 px-4 py-4 dark:bg-white/[.03]">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border-soft bg-white p-4 dark:border-white/15 dark:bg-white/5">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Recomendação
                            </p>
                            <p className="mt-1 font-medium text-motiva-dark dark:text-white">
                              {statusRecommendation(video.status)}
                            </p>
                            {textoPrevisao(video.previsao_dias_ate_critico, video.previsao_data_critico) && (
                              <p className="mt-1 text-sm text-alert/90">
                                {textoPrevisao(video.previsao_dias_ate_critico, video.previsao_data_critico)}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                                Solicitação
                              </p>
                              {video.rocada_solicitada_em ? (
                                <div className="flex items-center gap-2">
                                  <span className="whitespace-nowrap rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
                                    Solicitada em {video.rocada_solicitada_em.slice(0, 16)}
                                  </span>
                                  <button
                                    onClick={() => cancelarRocada(video.id)}
                                    className="text-xs text-muted underline underline-offset-4"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => solicitarRocada(video.id)}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
                                    video.status === "CRITICO"
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
                              {video.rocada_agendada_para ? (
                                <div className="flex items-center gap-2">
                                  <span className="whitespace-nowrap rounded-full border border-motiva/30 bg-motiva/10 px-2.5 py-1 text-xs font-medium text-motiva-dark dark:text-white">
                                    Agendada: {formatarDataBR(video.rocada_agendada_para)}
                                  </span>
                                  <button
                                    onClick={() => cancelarAgendamento(video.id)}
                                    className="text-xs text-muted underline underline-offset-4"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : agendaEditId === video.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={agendaForm}
                                    onChange={(e) => setAgendaForm(e.target.value)}
                                    className="rounded border border-border-soft bg-white px-1.5 py-1 text-xs dark:border-white/20 dark:bg-white/10"
                                  />
                                  <button
                                    onClick={() => salvarAgendamento(video.id, agendaForm)}
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
                                      setAgendaEditId(video.id);
                                      setAgendaForm("");
                                    }}
                                    className="rounded-lg border border-motiva/30 px-3 py-1.5 text-xs font-medium text-motiva-dark hover:bg-focus-light dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                                  >
                                    Agendar
                                  </button>
                                  {video.status === "CRITICO" && (
                                    <button
                                      onClick={() => agendarQuantoAntes(video.id)}
                                      disabled={buscandoHorarioId === video.id}
                                      className="text-xs font-medium text-negative underline underline-offset-4 disabled:opacity-50"
                                    >
                                      {buscandoHorarioId === video.id ? "Buscando…" : "Assim que possível"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-xs font-medium text-muted dark:border-white/15 dark:bg-white/10">
                            Duração assumida: {DURACAO_ASSUMIDA_S}s
                          </span>
                          <span className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-xs font-medium text-muted dark:border-white/15 dark:bg-white/10">
                            Captura a cada 2s
                          </span>
                          <span className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-xs font-medium text-muted dark:border-white/15 dark:bg-white/10">
                            {readings[video.id]?.length ?? "…"} leituras
                          </span>
                          {video.km_inicio !== null && video.km_fim !== null && (
                            <span className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-xs font-medium text-muted dark:border-white/15 dark:bg-white/10">
                              Trecho: {video.km_inicio} – {video.km_fim} km
                            </span>
                          )}
                        </div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                          Leituras do trecho
                        </p>
                        {readings[video.id] ? (
                          <div className="space-y-1.5">
                            {readings[video.id].map((r) => {
                              const km = kmDaLeitura(r.timestamp_s, video.km_inicio, video.km_fim);
                              return (
                                <div
                                  key={r.timestamp_s}
                                  className="flex items-center gap-3"
                                >
                                  <span className="w-14 shrink-0 tabular-nums text-muted">
                                    {r.timestamp_s}s
                                  </span>
                                  <span className="w-16 shrink-0 tabular-nums text-muted">
                                    {km !== null ? `km ${km}` : "—"}
                                  </span>
                                  <div className="h-4 flex-1 overflow-hidden rounded bg-white dark:bg-white/10">
                                    <div
                                      className={`h-full rounded ${statusBar(r.status)}`}
                                      style={{
                                        width: `${Math.min(100, (r.height_cm / 35) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="w-20 shrink-0 text-right tabular-nums">
                                    {r.height_cm} cm
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-muted">Carregando leituras…</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-border-soft bg-white p-6 text-sm dark:border-white/15 dark:bg-white/5">
        <h2 className="font-semibold text-motiva-dark dark:text-white">
          Como a Motiva usa esses dados
        </h2>
        <ul className="mt-3 space-y-2 text-muted">
          <li>
            Priorizar a roçada nos trechos marcados como{" "}
            <strong className="text-negative">CRÍTICO</strong>, em vez de
            percorrer a rodovia inteira.
          </li>
          <li>
            Acompanhar a evolução da vegetação ao longo do tempo e antecipar a
            próxima manutenção.
          </li>
          <li>
            Comprovar com dados objetivos (altura em cm por trecho) o
            cumprimento das metas de conservação da faixa de domínio.
          </li>
        </ul>
      </div>
    </div>
  );
}
