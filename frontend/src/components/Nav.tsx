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
    <nav className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto max-w-5xl flex items-center gap-6 px-6 py-4">
        <span className="font-bold tracking-tight">VeroAI</span>
        <div className="flex gap-4 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "font-semibold underline underline-offset-4"
                  : "opacity-70 hover:opacity-100"
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
