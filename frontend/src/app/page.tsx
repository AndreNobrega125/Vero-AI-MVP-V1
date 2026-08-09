import { TEAM } from "@/lib/team";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-motiva">
        Challenge Motiva
      </p>
      <h1 className="mt-2 text-4xl font-bold text-motiva-dark dark:text-white">
        {TEAM.groupName}
      </h1>

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl border border-border-soft bg-white p-4 dark:border-white/15 dark:bg-white/5">
          <dt className="text-muted">Número do grupo</dt>
          <dd className="mt-1 text-lg font-semibold text-motiva-dark dark:text-white">
            {TEAM.groupNumber || "a definir"}
          </dd>
        </div>
        <div className="rounded-xl border border-border-soft bg-white p-4 dark:border-white/15 dark:bg-white/5">
          <dt className="text-muted">Turma</dt>
          <dd className="mt-1 text-lg font-semibold text-motiva-dark dark:text-white">
            {TEAM.turma}
          </dd>
        </div>
      </dl>

      <h2 className="mt-10 text-lg font-semibold text-motiva-dark dark:text-white">
        Integrantes
      </h2>
      <ul className="mt-4 divide-y divide-border-soft overflow-hidden rounded-xl border border-border-soft bg-white dark:divide-white/10 dark:border-white/15 dark:bg-white/5">
        {TEAM.members.map((member) => (
          <li
            key={member.rm}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="font-medium">{member.name}</span>
            <span className="text-sm text-muted">
              RM {member.rm} · {member.turma}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
