"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_URL,
  corAvatar,
  dataHoraChat,
  formatarDataBR,
  getUsuarioLogado,
  horaChat,
  iniciais,
  notificarDadosAtualizados,
  ouvirDadosAtualizados,
  statusLabel,
  statusStyle,
  sugerirMensagem,
  type Mensagem,
  type Usuario,
  type VideoRow,
} from "@/lib/api";

export default function MensagensPage() {
  const router = useRouter();
  const [eu, setEu] = useState<Usuario | null | undefined>(undefined);

  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [contatos, setContatos] = useState<Usuario[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contato, setContato] = useState<Usuario | null>(null);
  // Em telas estreitas só cabe uma coluna por vez: começa mostrando a lista
  // de contatos; ao escolher um, troca pra conversa. Em sm+ as duas colunas
  // ficam sempre visíveis lado a lado (ver classes `sm:flex` abaixo) e este
  // estado deixa de ter efeito.
  const [mostrarContatosMobile, setMostrarContatosMobile] = useState(true);
  const [trechoId, setTrechoId] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [painelSolicitacao, setPainelSolicitacao] = useState(false);
  const [dataSolicitada, setDataSolicitada] = useState("");

  const fimDaConversaRef = useRef<HTMLDivElement>(null);
  // Trava síncrona contra clique duplo: `enviando` (estado do React) só
  // reflete no DOM depois de um re-render, então dois cliques a poucos
  // milissegundos de distância podem passar pela checagem `disabled` antes
  // de o React re-renderizar. Uma ref é lida/escrita na hora, sem esperar
  // re-render, e bloqueia isso de verdade.
  const ocupadoRef = useRef(false);

  useEffect(() => {
    setEu(getUsuarioLogado());
  }, []);

  // Busca silenciosa: atualiza os dados sem trocar a tela pra "Carregando…"
  // — usada pelo polling e pelo BroadcastChannel, onde recarregar a tela
  // inteira a cada poucos segundos apagaria o que a pessoa está digitando.
  function buscarDados(usuarioLogado: Usuario) {
    const papelContato = usuarioLogado.papel === "gestor" ? "encarregado" : "gestor";
    return Promise.all([
      fetch(`${API_URL}/api/videos`).then((r) => r.json()),
      fetch(`${API_URL}/api/usuarios?papel=${papelContato}`).then((r) => r.json()),
      fetch(`${API_URL}/api/mensagens`).then((r) => r.json()),
    ]).then(([v, c, m]) => {
      setVideos(v);
      setContatos(c);
      setMensagens(m);
      setContato((atual) => atual ?? c[0] ?? null);
    });
  }

  function carregarTudo(usuarioLogado: Usuario) {
    setLoading(true);
    buscarDados(usuarioLogado)
      .catch(() => setError("Não foi possível carregar os dados. A API está rodando?"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (eu === undefined) return;
    if (eu === null) {
      router.replace("/login");
      return;
    }
    carregarTudo(eu);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu]);

  useEffect(() => {
    if (!eu) return;
    return ouvirDadosAtualizados(() => buscarDados(eu).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu]);

  // Polling: sem isso, duas pessoas em aparelhos diferentes (gestor no PC,
  // encarregado no celular, por exemplo) só veem mensagem nova dando refresh
  // manual — o BroadcastChannel acima só sincroniza abas do mesmo navegador.
  // Só roda com a aba visível, pra não gastar requisição à toa em segundo plano.
  useEffect(() => {
    if (!eu) return;
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") {
        buscarDados(eu).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eu]);

  // Independente de quem está logado, a conversa fica sempre "endereçada"
  // ao nome do encarregado (é como a tabela `mensagens` já guardava os dados
  // antes de existir login: destinatario = nome do encarregado, dos dois
  // lados da conversa).
  const nomeThread = eu?.papel === "gestor" ? (contato?.nome ?? null) : (eu?.nome ?? null);
  const rodoviaFiltro = eu?.papel === "gestor" ? (contato?.rodovia ?? null) : (eu?.rodovia ?? null);

  const trechosDoContato = useMemo(() => {
    if (!rodoviaFiltro) return videos;
    return videos.filter((v) => (v.nome_trecho ?? "").toUpperCase().includes(rodoviaFiltro));
  }, [videos, rodoviaFiltro]);

  useEffect(() => {
    if (trechosDoContato.length > 0 && !trechosDoContato.some((v) => v.id === trechoId)) {
      setTrechoId(trechosDoContato[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trechosDoContato]);

  const conversas = useMemo(() => {
    const mapa = new Map<string, Mensagem[]>();
    for (const m of mensagens) {
      const lista = mapa.get(m.destinatario) ?? [];
      lista.push(m);
      mapa.set(m.destinatario, lista);
    }
    return mapa;
  }, [mensagens]);

  const mensagensConversa = nomeThread ? (conversas.get(nomeThread) ?? []) : [];
  const trechoAtual = videos.find((v) => v.id === trechoId) ?? null;

  useEffect(() => {
    fimDaConversaRef.current?.scrollIntoView({ block: "end" });
  }, [mensagensConversa.length, contato]);

  function adicionarMensagem(nova: Mensagem) {
    // O broadcast de "dados atualizados" também é recebido por esta mesma
    // aba (BroadcastChannel entrega para qualquer listener, mesmo na mesma
    // página), então um carregarTudo() pode buscar essa mensagem do
    // servidor antes deste retorno local terminar — evita duplicar a bolha
    // quando isso acontece.
    setMensagens((prev) => (prev.some((m) => m.id === nova.id) ? prev : [...prev, nova]));
  }

  async function postarMensagem(payload: Record<string, unknown>) {
    const res = await fetch(`${API_URL}/api/mensagens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    ocupadoRef.current = false;
    if (!res.ok) return;
    const { mensagem }: { mensagem: Mensagem } = await res.json();
    adicionarMensagem(mensagem);
    notificarDadosAtualizados();
  }

  async function enviarTexto() {
    if (!eu || !nomeThread || !trechoId || !texto.trim()) return;
    if (ocupadoRef.current) return; // trava síncrona — ver comentário na declaração de ocupadoRef
    ocupadoRef.current = true;
    setEnviando(true);
    try {
      await postarMensagem({
        video_id: trechoId,
        destinatario: nomeThread,
        cargo: (eu.papel === "gestor" ? contato?.cargo_detalhe : eu.cargo_detalhe) ?? null,
        mensagem: texto.trim(),
        remetente: eu.papel,
        tipo: "texto",
      });
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  async function abrirPainelSolicitacao() {
    setPainelSolicitacao(true);
    try {
      const res = await fetch(`${API_URL}/api/proximo-horario-disponivel`);
      if (res.ok) {
        const { data } = await res.json();
        setDataSolicitada(data);
      }
    } catch {
      // segue sem sugestão de data
    }
  }

  async function enviarSolicitacao() {
    if (!eu || !nomeThread || !trechoId || !trechoAtual || !dataSolicitada) return;
    if (ocupadoRef.current) return; // trava síncrona — ver comentário na declaração de ocupadoRef
    ocupadoRef.current = true;
    setEnviando(true);
    try {
      await fetch(`${API_URL}/api/videos/${trechoId}/agendar-rocada`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataSolicitada }),
      });
      await postarMensagem({
        video_id: trechoId,
        destinatario: nomeThread,
        cargo: contato?.cargo_detalhe ?? null,
        mensagem: sugerirMensagem(trechoAtual.nome_trecho, trechoAtual.status, trechoAtual.average_height_cm),
        remetente: eu.papel,
        tipo: "solicitacao",
        data_solicitada: dataSolicitada,
      });
      setPainelSolicitacao(false);
    } finally {
      setEnviando(false);
    }
  }

  if (eu === undefined || loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted">Carregando…</p>
      </div>
    );
  }

  if (!eu) return null; // redirecionando para /login

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">
        Comunicação
      </p>
      <h1 className="mt-2 text-2xl font-bold text-motiva-dark dark:text-white">
        Mensagens
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Simulação para demonstração — não há integração real com SMS, WhatsApp
        ou e-mail. As mensagens ficam registradas aqui, e solicitar uma roçada
        também agenda a data no trecho.
      </p>

      <div className="flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-border-soft sm:h-[70vh] sm:flex-row dark:border-white/15">
        {/* Lista de contatos — em telas estreitas ocupa a tela toda até um
            contato ser escolhido; a partir de sm fica sempre visível ao lado
            da conversa (classes `sm:flex` sobrepõem o hidden/flex do mobile). */}
        <aside
          className={`${mostrarContatosMobile ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col overflow-y-auto border-r border-border-soft bg-focus-light/50 sm:flex sm:w-72 sm:shrink-0 sm:flex-none dark:border-white/15 dark:bg-white/5`}
        >
          {contatos.map((c) => {
            const chaveThread = eu.papel === "gestor" ? c.nome : eu.nome;
            const msgs = conversas.get(chaveThread) ?? [];
            const ultima = msgs[msgs.length - 1];
            const selecionado = contato?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setContato(c);
                  setPainelSolicitacao(false);
                  setMostrarContatosMobile(false);
                }}
                className={`flex w-full items-center gap-3 border-b border-border-soft/60 px-3 py-3 text-left transition dark:border-white/10 ${
                  selecionado
                    ? "bg-motiva/10 dark:bg-motiva/20"
                    : "hover:bg-white dark:hover:bg-white/5"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${corAvatar(c.nome)}`}
                >
                  {iniciais(c.nome)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-motiva-dark dark:text-white">
                    {c.nome}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {ultima ? (ultima.tipo === "solicitacao" ? "📋 Solicitação de roçada" : ultima.mensagem) : c.cargo_detalhe}
                  </p>
                </div>
                {ultima && (
                  <span className="shrink-0 text-[10px] text-muted">{horaChat(ultima.enviada_em)}</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Conversa — some no mobile enquanto a lista de contatos está aberta */}
        <section
          className={`${mostrarContatosMobile ? "hidden" : "flex"} min-h-0 flex-1 flex-col bg-white sm:flex dark:bg-transparent`}
        >
          {contato && (
            <>
              <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3 dark:border-white/15">
                <button
                  onClick={() => setMostrarContatosMobile(true)}
                  aria-label="Voltar para a lista de contatos"
                  className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-focus-light sm:hidden dark:hover:bg-white/10"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${corAvatar(contato.nome)}`}
                >
                  {iniciais(contato.nome)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-motiva-dark dark:text-white">
                    {contato.nome}
                  </p>
                  <p className="truncate text-xs text-muted">{contato.cargo_detalhe}</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-focus-light/30 px-4 py-4 dark:bg-transparent">
                {mensagensConversa.length === 0 && (
                  <p className="mt-6 text-center text-sm text-muted">
                    Nenhuma mensagem ainda. Diga oi para {contato.nome.split(" ")[0]}.
                  </p>
                )}
                <div className="space-y-2.5">
                  {mensagensConversa.map((m) => (
                    <Bolha
                      key={m.id}
                      mensagem={m}
                      souEu={m.remetente === eu.papel}
                      nomeTrecho={videos.find((v) => v.id === m.video_id)?.nome_trecho ?? null}
                    />
                  ))}
                </div>
                <div ref={fimDaConversaRef} />
              </div>

              <div className="border-t border-border-soft p-3 dark:border-white/15">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <select
                    value={trechoId ?? ""}
                    onChange={(e) => setTrechoId(Number(e.target.value))}
                    className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-xs dark:border-white/20 dark:bg-white/10"
                  >
                    {trechosDoContato.map((v) => (
                      <option key={v.id} value={v.id}>
                        {(v.nome_trecho || v.filename) + ` — ${v.average_height_cm}cm`}
                      </option>
                    ))}
                  </select>
                  {eu.papel === "gestor" && (
                    <button
                      onClick={abrirPainelSolicitacao}
                      disabled={enviando}
                      className="rounded-lg border border-motiva/30 px-3 py-1.5 text-xs font-medium text-motiva-dark hover:bg-focus-light disabled:opacity-40 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                    >
                      📋 Solicitar roçada
                    </button>
                  )}
                </div>

                {painelSolicitacao && trechoAtual && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-motiva/30 bg-motiva/5 p-2 dark:bg-white/5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusStyle(trechoAtual.status)}`}
                    >
                      {statusLabel(trechoAtual.status)}
                    </span>
                    <span className="text-xs text-muted">{trechoAtual.average_height_cm}cm</span>
                    <label className="text-xs text-muted">Data:</label>
                    <input
                      type="date"
                      value={dataSolicitada}
                      onChange={(e) => setDataSolicitada(e.target.value)}
                      className="rounded border border-border-soft bg-white px-1.5 py-1 text-xs dark:border-white/20 dark:bg-white/10"
                    />
                    <button
                      onClick={enviarSolicitacao}
                      disabled={enviando || !dataSolicitada}
                      className="rounded bg-motiva px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                    >
                      Enviar solicitação
                    </button>
                    <button
                      onClick={() => setPainelSolicitacao(false)}
                      className="text-xs text-muted underline"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !enviando) enviarTexto();
                    }}
                    placeholder="Escreva uma mensagem…"
                    className="flex-1 rounded-full border border-border-soft bg-white px-4 py-2 text-sm disabled:opacity-60 dark:border-white/20 dark:bg-white/10"
                  />
                  <button
                    onClick={enviarTexto}
                    disabled={enviando || !texto.trim()}
                    className="rounded-full bg-motiva px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Bolha({
  mensagem,
  souEu,
  nomeTrecho,
}: {
  mensagem: Mensagem;
  souEu: boolean;
  nomeTrecho: string | null;
}) {
  if (mensagem.tipo === "solicitacao") {
    return (
      <div className={`flex ${souEu ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[80%] rounded-2xl border border-motiva/30 bg-motiva/10 px-4 py-3 text-sm dark:bg-motiva/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-motiva">
            📋 Solicitação de roçada
          </p>
          {nomeTrecho && <p className="mt-1 font-medium text-motiva-dark dark:text-white">{nomeTrecho}</p>}
          <p className="mt-1">{mensagem.mensagem}</p>
          {mensagem.data_solicitada && (
            <p className="mt-1.5 text-xs font-medium text-motiva-dark dark:text-white">
              Data agendada: {formatarDataBR(mensagem.data_solicitada)}
            </p>
          )}
          <p className="mt-1 text-right text-[10px] text-muted">{dataHoraChat(mensagem.enviada_em)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${souEu ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          souEu
            ? "rounded-br-sm bg-motiva text-white"
            : "rounded-bl-sm border border-border-soft bg-white text-motiva-dark dark:border-white/15 dark:bg-white/10 dark:text-white"
        }`}
      >
        <p>{mensagem.mensagem}</p>
        <p className={`mt-1 text-right text-[10px] ${souEu ? "text-white/70" : "text-muted"}`}>
          {horaChat(mensagem.enviada_em)}
        </p>
      </div>
    </div>
  );
}
