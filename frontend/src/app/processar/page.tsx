"use client";

import { useRef, useState } from "react";
import {
  API_URL,
  statusStyle,
  type ProcessResult,
} from "@/lib/api";

export default function ProcessarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(selected: File | null) {
    setResult(null);
    setError(null);
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/process-video`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? `Erro ${res.status}`);
      }
      setResult((await res.json()) as ProcessResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível processar o vídeo. A API está rodando?",
      );
    } finally {
      setLoading(false);
    }
  }

  const maxHeight = result
    ? Math.max(...result.readings.map((r) => r.height_cm), 1)
    : 1;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Teste do protótipo</h1>
      <p className="mt-2 opacity-70">
        Envie um vídeo gravado na rodovia. O sistema extrai um frame a cada 2
        segundos, estima a altura da vegetação em cada frame e calcula a média
        do trecho.
      </p>

      <div className="mt-8 rounded-xl border border-black/10 p-6 dark:border-white/15">
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Escolher vídeo
          </button>
          <span className="text-sm opacity-70">
            {file ? file.name : "Nenhum arquivo selecionado"}
          </span>
        </div>

        {previewUrl && (
          <video
            src={previewUrl}
            controls
            className="mt-4 w-full rounded-lg border border-black/10 dark:border-white/15"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          className="mt-4 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-40"
        >
          {loading ? "Processando…" : "Analisar vegetação"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {result && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Resultado da análise</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 p-5 dark:border-white/15">
              <p className="text-sm opacity-60">Altura média</p>
              <p className="mt-1 text-3xl font-bold">
                {result.average_height_cm}
                <span className="ml-1 text-lg font-normal opacity-60">cm</span>
              </p>
            </div>
            <div
              className={`rounded-xl border p-5 ${statusStyle(result.status)}`}
            >
              <p className="text-sm opacity-70">Status do trecho</p>
              <p className="mt-1 text-3xl font-bold">{result.status}</p>
            </div>
            <div className="rounded-xl border border-black/10 p-5 dark:border-white/15">
              <p className="text-sm opacity-60">Frames analisados</p>
              <p className="mt-1 text-3xl font-bold">
                {result.readings.length}
              </p>
            </div>
          </div>

          <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide opacity-60">
            Leituras ao longo do trecho
          </h3>
          <div className="mt-3 space-y-1.5">
            {result.readings.map((reading) => (
              <div
                key={reading.timestamp_s}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-14 shrink-0 tabular-nums opacity-60">
                  {reading.timestamp_s}s
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-black/5 dark:bg-white/10">
                  <div
                    className={`h-full rounded ${
                      reading.status === "CRITICO"
                        ? "bg-red-500"
                        : reading.status === "ALERTA"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${(reading.height_cm / maxHeight) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right tabular-nums">
                  {reading.height_cm} cm
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm opacity-60">
            Resultado salvo na plataforma. Veja o histórico no{" "}
            <a href="/dashboard" className="underline underline-offset-4">
              Dashboard
            </a>
            .
          </p>
        </section>
      )}
    </div>
  );
}
