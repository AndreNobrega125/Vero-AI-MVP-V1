import { TEAM } from "@/lib/team";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm uppercase tracking-widest opacity-60">
        Challenge Motiva
      </p>
      <h1 className="mt-2 text-4xl font-bold">{TEAM.groupName}</h1>

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="opacity-60">Número do grupo</dt>
          <dd className="font-medium">
            {TEAM.groupNumber || "a definir"}
          </dd>
        </div>
        <div>
          <dt className="opacity-60">Turma</dt>
          <dd className="font-medium">{TEAM.turma}</dd>
        </div>
      </dl>

      <h2 className="mt-10 text-lg font-semibold">Integrantes</h2>
      <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
        {TEAM.members.map((member) => (
          <li key={member.rm} className="flex items-center justify-between py-3">
            <span>{member.name}</span>
            <span className="text-sm opacity-60">
              RM {member.rm} · {member.turma}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
