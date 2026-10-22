"use client";

import { useRef, useState } from "react";
import {
  API_URL,
  DURACAO_ASSUMIDA_S,
  kmDaLeitura,
  notificarDadosAtualizados,
  statusBar,
  statusLabel,
  statusStyle,
  type FotoResult,
  type ProcessResult,
} from "@/lib/api";

export default function ProcessarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultVideo, setResultVideo] = useState<ProcessResult | null>(null);
  const [resultFoto, setResultFoto] = useState<FotoResult | null>(null);
  const [kmInicio, setKmInicio] = useState("");
  const [kmFim, setKmFim] = useState("");
  const [nomeTrecho, setNomeTrecho] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const ehFoto = file?.type.startsWith("image/") ?? false;
  const result = resultVideo ?? resultFoto;

  function handleSelect(selected: File | null) {
    setResultVideo(null);
    setResultFoto(null);
    setError(null);
    setFile(selected);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultVideo(null);
    setResultFoto(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (kmInicio !== "") formData.append("km_inicio", kmInicio);
      if (kmFim !== "") formData.append("km_fim", kmFim);
      if (nomeTrecho !== "") formData.append("nome_trecho", nomeTrecho);

      const endpoint = ehFoto ? "/api/analisar-foto" : "/api/process-video";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.detail ?? `Erro ${res.status}`);
      }
      if (ehFoto) {
        setResultFoto((await res.json()) as FotoResult);
      } else {
        setResultVideo((await res.json()) as ProcessResult);
      }
      notificarDadosAtualizados();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Não foi possível processar o ${ehFoto ? "foto" : "vídeo"}. A API está rodando?`,
      );
    } finally {
      setLoading(false);
    }
  }

  const maxHeight = resultVideo
    ? Math.max(...resultVideo.readings.map((r) => r.height_cm), 1)
    : 1;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">
        Testar protótipo
      </p>
      <h1 className="mt-2 text-3xl font-bold text-motiva-dark dark:text-white">
        Análise de vegetação
      </h1>
      <p className="mt-2 text-muted">
        Envie um vídeo gravado na rodovia (extrai um frame a cada 2 segundos e
        calcula a média do trecho) ou uma foto avulsa com a régua de
        referência (análise instantânea, uma leitura só).
      </p>

      <div className="mt-8 rounded-2xl border border-border-soft bg-white p-6 shadow-sm dark:border-white/15 dark:bg-white/5">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-motiva/30 px-4 py-2 text-sm font-medium text-motiva-dark hover:bg-focus-light dark:border-white/20 dark:text-white dark:hover:bg-white/10"
          >
            Escolher vídeo ou foto
          </button>
          <span className="text-sm text-muted">
            {file ? file.name : "Nenhum arquivo selecionado"}
          </span>
        </div>

        {previewUrl && ehFoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Prévia da foto selecionada"
            className="mt-4 max-h-80 w-full rounded-lg border border-border-soft object-contain dark:border-white/15"
          />
        )}
        {previewUrl && !ehFoto && (
          <video
            src={previewUrl}
            controls
            className="mt-4 w-full rounded-lg border border-border-soft dark:border-white/15"
          />
        )}

        <div className="mt-4">
          <label className="block text-xs font-medium text-muted">
            Nome do trecho (opcional)
          </label>
          <input
            type="text"
            value={nomeTrecho}
            onChange={(e) => setNomeTrecho(e.target.value)}
            placeholder="ex: Km 50 a 51 — Trevo Sul"
            className="mt-1 w-full max-w-sm rounded-lg border border-border-soft bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-white/10"
          />
          <p className="mt-1 text-xs text-muted">
            Ajuda a identificar o trecho no dashboard. Este resultado é
            marcado como dado real (distinto dos trechos de exemplo).
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-muted">
            Localização do trecho na rodovia (opcional)
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={kmInicio}
              onChange={(e) => setKmInicio(e.target.value)}
              placeholder="km início"
              className="w-28 rounded-lg border border-border-soft bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-white/10"
            />
            <span className="text-muted">–</span>
            <input
              type="number"
              value={kmFim}
              onChange={(e) => setKmFim(e.target.value)}
              placeholder="km fim"
              className="w-28 rounded-lg border border-border-soft bg-white px-2 py-1.5 text-sm dark:border-white/20 dark:bg-white/10"
            />
          </div>
          {kmInicio !== "" && kmFim !== "" && Number(kmFim) < Number(kmInicio) && (
            <p className="mt-1 text-xs text-negative">
              O km final deve ser maior ou igual ao km inicial.
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            Sem essa informação o trecho não entra no cronograma nem no filtro
            por distância — mas dá para definir depois no Dashboard.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={
            !file ||
            loading ||
            (kmInicio !== "" && kmFim !== "" && Number(kmFim) < Number(kmInicio))
          }
          className="mt-4 rounded-lg bg-motiva px-5 py-2.5 text-sm font-medium text-white transition hover:bg-motiva-dark disabled:opacity-40"
        >
          {loading ? "Processando…" : ehFoto ? "Analisar foto" : "Analisar vegetação"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
            {error}
          </p>
        )}
      </div>

      {result && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-motiva-dark dark:text-white">
              {resultVideo
                ? resultVideo.nome_trecho || "Resultado da análise"
                : nomeTrecho || "Resultado da análise"}
              {resultVideo?.km_inicio !== null && resultVideo?.km_fim != null && resultVideo && (
                <span className="ml-2 text-sm font-normal text-muted">
                  · km {resultVideo.km_inicio} – {resultVideo.km_fim}
                </span>
              )}
            </h2>
            <button
              onClick={() => {
                handleSelect(null);
                setKmInicio("");
                setKmFim("");
                setNomeTrecho("");
              }}
              className="text-sm font-medium text-motiva underline underline-offset-4"
            >
              Analisar outro {ehFoto ? "arquivo" : "vídeo"}
            </button>
          </div>

          {resultFoto && (
            <>
              {resultFoto.fonte === "mirella_api" && (
                <p className="mt-2 inline-block rounded-full border border-motiva/30 bg-motiva/10 px-3 py-1 text-xs font-medium text-motiva-dark dark:text-white">
                  Analisado pelo modelo com medição por régua
                </p>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div
                  className={`rounded-xl border p-5 ${statusStyle(resultFoto.status_veroai)}`}
                >
                  <p className="text-sm opacity-70">Status do trecho</p>
                  <p className="mt-1 text-3xl font-bold">
                    {resultFoto.rotulo ?? statusLabel(resultFoto.status_veroai)}
                  </p>
                </div>
                <div className="rounded-xl border border-border-soft bg-white p-5 dark:border-white/15 dark:bg-white/5">
                  <p className="text-sm text-muted">Altura estimada</p>
                  <p className="mt-1 text-3xl font-bold text-motiva-dark dark:text-white">
                    {resultFoto.altura_estimada_cm}
                    <span className="ml-1 text-lg font-normal text-muted">cm</span>
                  </p>
                </div>
              </div>

              {resultFoto.motivo && (
                <p className="mt-3 text-sm text-muted">{resultFoto.motivo}</p>
              )}

              {resultFoto.imagem_anotada_base64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultFoto.imagem_anotada_base64}
                  alt="Imagem anotada pela análise"
                  className="mt-4 w-full rounded-lg border border-border-soft dark:border-white/15"
                />
              )}
            </>
          )}

          {resultVideo && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border-soft bg-white p-5 dark:border-white/15 dark:bg-white/5">
                  <p className="text-sm text-muted">Altura média</p>
                  <p className="mt-1 text-3xl font-bold text-motiva-dark dark:text-white">
                    {resultVideo.average_height_cm}
                    <span className="ml-1 text-lg font-normal text-muted">cm</span>
                  </p>
                </div>
                <div
                  className={`rounded-xl border p-5 ${statusStyle(resultVideo.status)}`}
                >
                  <p className="text-sm opacity-70">Status do trecho</p>
                  <p className="mt-1 text-3xl font-bold">{statusLabel(resultVideo.status)}</p>
                </div>
                <div className="rounded-xl border border-border-soft bg-white p-5 dark:border-white/15 dark:bg-white/5">
                  <p className="text-sm text-muted">Frames analisados</p>
                  <p className="mt-1 text-3xl font-bold text-motiva-dark dark:text-white">
                    {resultVideo.readings.length}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Leituras ao longo do trecho
                </h3>
                <span className="text-xs text-muted">
                  Duração assumida: {DURACAO_ASSUMIDA_S}s · captura a cada 2s
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {resultVideo.readings.map((reading) => {
                  const km = kmDaLeitura(reading.timestamp_s, resultVideo.km_inicio, resultVideo.km_fim);
                  return (
                    <div
                      key={reading.timestamp_s}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="w-14 shrink-0 tabular-nums text-muted">
                        {reading.timestamp_s}s
                      </span>
                      <span className="w-16 shrink-0 tabular-nums text-muted">
                        {km !== null ? `km ${km}` : "—"}
                      </span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-focus-light dark:bg-white/10">
                        <div
                          className={`h-full rounded ${statusBar(reading.status)}`}
                          style={{
                            width: `${(reading.height_cm / maxHeight) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right tabular-nums">
                        {reading.height_cm} cm
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <p className="mt-6 text-sm text-muted">
            Resultado salvo na plataforma. Veja o histórico no{" "}
            <a href="/dashboard" className="font-medium text-motiva underline underline-offset-4">
              Dashboard
            </a>
            .
          </p>
        </section>
      )}
    </div>
  );
}
