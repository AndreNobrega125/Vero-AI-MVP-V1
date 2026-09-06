"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_URL,
  corAvatar,
  getUsuarioLogado,
  iniciais,
  setUsuarioLogado,
  type Usuario,
} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const logado = getUsuarioLogado();
    if (logado) {
      router.replace(logado.papel === "gestor" ? "/dashboard" : "/mensagens");
      return;
    }
    fetch(`${API_URL}/api/usuarios`)
      .then((r) => r.json())
      .then(setUsuarios)
      .catch(() => setError("Não foi possível carregar as contas. A API está rodando?"))
      .finally(() => setLoading(false));
  }, [router]);

  function entrarComo(usuario: Usuario) {
    setUsuarioLogado(usuario);
    router.push(usuario.papel === "gestor" ? "/dashboard" : "/mensagens");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-motiva" />
        <span className="font-bold tracking-tight text-motiva-dark dark:text-white">VeroAI</span>
      </div>

      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">Acesso</p>
      <h1 className="mt-2 text-2xl font-bold text-motiva-dark dark:text-white">
        Entrar como
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Simulação para demonstração — sem senha. Escolha a conta para ver a
        plataforma pela ótica do gestor ou do encarregado de roçada.
      </p>

      {loading && <p className="text-sm text-muted">Carregando…</p>}

      {error && (
        <p className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {usuarios.map((usuario) => (
            <button
              key={usuario.id}
              onClick={() => entrarComo(usuario)}
              className="flex items-center gap-3 rounded-2xl border border-border-soft bg-white px-4 py-3 text-left transition hover:border-motiva/40 hover:bg-focus-light dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${corAvatar(usuario.nome)}`}
              >
                {iniciais(usuario.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-motiva-dark dark:text-white">
                  {usuario.nome}
                </p>
                <p className="truncate text-xs text-muted">
                  {usuario.cargo_detalhe ?? usuario.papel}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-motiva/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-motiva">
                {usuario.papel}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
