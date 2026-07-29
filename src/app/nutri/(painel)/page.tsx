import Link from "next/link";
import { obterNutricionistaAtual } from "@/lib/nutri/auth";
import { buscarPacientesComAderencia } from "@/lib/nutri/consultas";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { sairNutricionista } from "../login/actions";

/**
 * Painel de aderência: % da meta batida hoje/semana por paciente, com
 * destaque de quem está fora (ver limiar em src/lib/nutri/aderencia.ts).
 */
export default async function PainelNutri() {
  const nutricionista = await obterNutricionistaAtual();
  const pacientesComAderencia = await buscarPacientesComAderencia(nutricionista.id);
  const vagasRestantes = nutricionista.limitePlano - pacientesComAderencia.length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-3">
            <NoSheipeLogo size={24} />
          </div>
          <h1 className="font-display text-3xl">Olá, {nutricionista.nome}</h1>
        </div>
        <form action={sairNutricionista}>
          <button
            type="submit"
            className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
          >
            Sair
          </button>
        </form>
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        {pacientesComAderencia.length} de {nutricionista.limitePlano} pacientes do plano
        {vagasRestantes <= 0 ? " — limite atingido" : ""}.
      </p>

      <div className="mt-6">
        {vagasRestantes > 0 ? (
          <Link
            href="/nutri/pacientes/novo"
            className="inline-block rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep"
          >
            + Novo paciente
          </Link>
        ) : (
          <p className="text-sm text-urgent">
            Limite de {nutricionista.limitePlano} pacientes atingido — arquive alguém pra liberar uma vaga.
          </p>
        )}
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {pacientesComAderencia.map(({ paciente, saldoHoje, saldoSemana, foraDaMeta }) => (
          <li key={paciente.id}>
            <Link
              href={`/nutri/pacientes/${paciente.id}`}
              className={`paper-card block rounded-sm p-4 transition-colors hover:border-sheipe ${
                foraDaMeta ? "border-l-[3px] border-l-urgent-line" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-lg leading-snug">{paciente.nome}</p>
                {foraDaMeta && <span className="eyebrow shrink-0 text-urgent">fora da meta</span>}
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                Meta: {paciente.metaKcal} kcal · {paciente.metaProteina}g P · {paciente.metaCarbo}g C ·{" "}
                {paciente.metaGordura}g G
              </p>
              <div className="mt-2 flex gap-4 text-xs">
                <span className={foraDaMeta ? "text-urgent" : "text-ink-soft"}>Hoje: {saldoHoje.kcal.percentual}%</span>
                <span className="text-ink-soft">Semana: {saldoSemana.kcal.percentual}%</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {pacientesComAderencia.length === 0 && (
        <p className="mt-8 text-sm text-ink-faint">Nenhum paciente cadastrado ainda.</p>
      )}
    </main>
  );
}
