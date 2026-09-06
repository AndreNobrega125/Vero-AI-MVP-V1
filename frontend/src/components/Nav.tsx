"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { corAvatar, getUsuarioLogado, iniciais, logout, type Usuario } from "@/lib/api";

const LINKS_GESTOR = [
  { href: "/processar", label: "Testar Protótipo" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cronograma", label: "Cronograma" },
  { href: "/mensagens", label: "Mensagens" },
];

const LINKS_ENCARREGADO = [
  { href: "/agenda", label: "Minha Agenda" },
  { href: "/mensagens", label: "Mensagens" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const logado = getUsuarioLogado();
    setUsuario(logado);

    if (pathname === "/login") return;

    if (!logado) {
      router.replace("/login");
      return;
    }

    const links = logado.papel === "gestor" ? LINKS_GESTOR : LINKS_ENCARREGADO;
    if (!links.some((l) => l.href === pathname)) {
      router.replace(links[0].href);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Fecha o menu mobile sempre que a rota muda (evita ficar aberto ao navegar).
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  if (pathname === "/login" || usuario === undefined) {
    return null;
  }

  if (!usuario) {
    return null;
  }

  const links = usuario.papel === "gestor" ? LINKS_GESTOR : LINKS_ENCARREGADO;

  function sair() {
    logout();
    router.replace("/login");
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-border-soft bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#0b0b17]/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href={links[0].href}
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight text-motiva-dark dark:text-white"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-motiva" />
          VeroAI
        </Link>

        {/* Links: linha horizontal a partir de md; escondidos em telas estreitas */}
        <div className="hidden flex-1 gap-6 text-sm md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "relative font-semibold text-motiva after:absolute after:-bottom-[17px] after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-motiva"
                  : "text-muted hover:text-motiva dark:text-white/70 dark:hover:text-white"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ${corAvatar(usuario.nome)}`}
          >
            {iniciais(usuario.nome)}
          </span>
          <span className="text-xs text-muted">{usuario.nome}</span>
          <button
            onClick={sair}
            className="ml-2 text-xs text-muted underline hover:text-motiva"
          >
            Sair
          </button>
        </div>

        {/* Abaixo de md: avatar + botão de menu, sem os links soltos na linha */}
        <div className="flex items-center gap-3 md:hidden">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${corAvatar(usuario.nome)}`}
          >
            {iniciais(usuario.nome)}
          </span>
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-soft text-motiva-dark dark:border-white/20 dark:text-white"
          >
            {menuAberto ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuAberto && (
        <div className="border-t border-border-soft px-4 py-3 md:hidden dark:border-white/10">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  pathname === link.href
                    ? "bg-motiva/10 font-semibold text-motiva"
                    : "text-muted hover:bg-focus-light dark:text-white/70 dark:hover:bg-white/10"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3 dark:border-white/10">
            <span className="text-xs text-muted">{usuario.nome}</span>
            <button onClick={sair} className="text-xs text-muted underline hover:text-motiva">
              Sair
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
