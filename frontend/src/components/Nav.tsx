"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Equipe" },
  { href: "/processar", label: "Testar Protótipo" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 border-b border-border-soft bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#0b0b17]/80">
      <div className="mx-auto flex max-w-5xl items-center gap-8 px-6 py-4">
        <span className="flex items-center gap-2 font-bold tracking-tight text-motiva-dark dark:text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-motiva" />
          VeroAI
        </span>
        <div className="flex gap-6 text-sm">
          {LINKS.map((link) => (
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
      </div>
    </nav>
  );
}
