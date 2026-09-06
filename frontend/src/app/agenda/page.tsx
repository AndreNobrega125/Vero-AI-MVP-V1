"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_URL,
  formatarDataBR,
  getUsuarioLogado,
  ouvirDadosAtualizados,
  statusLabel,
  statusStyle,
  textoPrevisao,
  type CronogramaResponse,
  type Usuario,
} from "@/lib/api";

export default function AgendaPage() {
  const router = useRouter();
  const [eu, setEu] = useState<Usuario | null | undefined>(undefined);
  const [data, setData] = useState<CronogramaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEu(getUsuarioLogado());
  }, []);

  // Busca silenciosa: não mexe em `loading`, então o polling não esconde a
  // agenda atrás de "Carregando…" a cada rodada.
  function buscarAgenda() {
    return fetch(`${API_URL}/api/cronograma`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        return res.json();
      })
      .then(setData);
  }

  function carregar() {
    setLoading(true);
    buscarAgenda()
      .catch(() => setError("Não foi possível carregar a agenda. A API está rodando?"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (eu === undefined) return;
    if (eu === null) {
      router.replace("/login");
      return;
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu]);

  useEffect(() => {
    if (!eu) return;
    return ouvirDadosAtualizados(() => buscarAgenda().catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu]);

  // Polling: uma solicitação de roçada feita pelo gestor em outro aparelho
  // não avisa esta aba sozinha — sem isso, só apareceria com refresh manual.
  useEffect(() => {
    if (!eu) return;
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") {
        buscarAgenda().catch(() => {});
      }
    }, 4000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu]);

  const meusTrechos = useMemo(() => {
    if (!data || !eu?.rodovia) return [];
    return data.cronograma.filter((item) =>
      (item.nome_trecho ?? "").toUpperCase().includes(eu.rodovia!),
    );
  }, [data, eu]);

  if (eu === undefined || loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted">Carregando…</p>
      </div>
    );
  }

  if (!eu) return null; // redirecionando para /login

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">
        Roçada
      </p>
      <h1 className="mt-2 text-2xl font-bold text-motiva-dark dark:text-white">
        Minha agenda
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Trechos da {eu.rodovia} sob sua responsabilidade, ordenados por
        criticidade. Somente leitura — solicitações e agendamentos são feitos
        pelo gestor em Mensagens.
      </p>

      {meusTrechos.length === 0 && (
        <p className="mt-8 text-muted">
          Nenhum trecho da {eu.rodovia} registrado ainda.
        </p>
      )}

      {meusTrechos.length > 0 && (
        <ul className="divide-y divide-border-soft/60 rounded-xl border border-border-soft dark:divide-white/10 dark:border-white/15">
          {meusTrechos.map((item) => {
            const temAcao = !!item.rocada_solicitada_em || !!item.rocada_agendada_para;
            return (
              <li key={item.video_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="flex items-center gap-2 font-medium text-motiva-dark dark:text-white">
                    <span>{item.nome_trecho || item.filename}</span>
                    {item.is_exemplo && (
                      <span className="rounded-full border border-muted/30 bg-focus-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted dark:border-white/20 dark:bg-white/10">
                        Exemplo
                      </span>
                    )}
                  </p>
                  <p className="tabular-nums text-muted">
                    km {item.km_inicio} – {item.km_fim}
                  </p>
                  {textoPrevisao(item.previsao_dias_ate_critico, item.previsao_data_critico) && (
                    <p className="mt-1 text-xs text-alert/90">
                      {textoPrevisao(item.previsao_dias_ate_critico, item.previsao_data_critico)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-muted">{item.average_height_cm} cm</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                  {temAcao && (
                    <span className="whitespace-nowrap rounded-full border border-positive/30 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive">
                      {item.rocada_solicitada_em && item.rocada_agendada_para
                        ? `Agendada · ${formatarDataBR(item.rocada_agendada_para)}`
                        : item.rocada_agendada_para
                          ? `Agendada: ${formatarDataBR(item.rocada_agendada_para)}`
                          : "Solicitada"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
