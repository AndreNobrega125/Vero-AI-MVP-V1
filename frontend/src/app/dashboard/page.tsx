"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  API_URL,
  statusBar,
  statusStyle,
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

  useEffect(() => {
    fetch(`${API_URL}/api/videos`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        return res.json();
      })
      .then(setVideos)
      .catch(() =>
        setError("Não foi possível carregar os dados. A API está rodando?"),
      )
      .finally(() => setLoading(false));
  }, []);

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

      {loading && <p className="mt-8 text-muted">Carregando…</p>}

      {error && (
        <p className="mt-8 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="mt-8 text-muted">
          Nenhum trecho registrado ainda. Processe um vídeo em{" "}
          <a href="/processar" className="font-medium text-motiva underline underline-offset-4">
            Testar Protótipo
          </a>
          .
        </p>
      )}

      {filtered.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border-soft dark:border-white/15">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-soft bg-focus-light text-xs uppercase tracking-wide text-muted dark:border-white/15 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium">Trecho / arquivo</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Altura média</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((video) => (
                <Fragment key={video.id}>
                  <tr
                    onClick={() => toggleRow(video.id)}
                    className="cursor-pointer border-b border-border-soft/60 bg-white hover:bg-focus-light dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium">{video.filename}</td>
                    <td className="px-4 py-3 text-muted">{video.created_at}</td>
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
                  </tr>
                  {expandedId === video.id && (
                    <tr>
                      <td colSpan={4} className="bg-focus-light/60 px-4 py-4 dark:bg-white/[.03]">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                          Leituras do trecho
                        </p>
                        {readings[video.id] ? (
                          <div className="space-y-1.5">
                            {readings[video.id].map((r) => (
                              <div
                                key={r.timestamp_s}
                                className="flex items-center gap-3"
                              >
                                <span className="w-14 shrink-0 tabular-nums text-muted">
                                  {r.timestamp_s}s
                                </span>
                                <div className="h-4 flex-1 overflow-hidden rounded bg-white dark:bg-white/10">
                                  <div
                                    className={`h-full rounded ${statusBar(r.status)}`}
                                    style={{
                                      width: `${Math.min(100, (r.height_cm / 80) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="w-20 shrink-0 text-right tabular-nums">
                                  {r.height_cm} cm
                                </span>
                              </div>
                            ))}
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
