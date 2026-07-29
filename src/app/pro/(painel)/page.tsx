import Link from "next/link";
import { Plus } from "lucide-react";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import {
  buscarPacientesComAderencia,
  buscarAlunosComAderencia,
  contarClientesAtivos,
} from "@/lib/profissional/consultas";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { sairProfissional } from "../login/actions";

/**
 * Painel único do profissional. As seções aparecem conforme as capacidades
 * dele: só nutrição, só treino, ou as duas — é isto que substitui os dois
 * painéis separados de antes.
 */
export default async function Painel() {
  const profissional = await obterProfissionalAtual();

  // Busca só o que a capacidade justifica: um personal não paga o custo de
  // varrer pacientes que ele nunca teria.
  const [pacientes, alunos, totalAtivos] = await Promise.all([
    profissional.ehNutricionista ? buscarPacientesComAderencia(profissional.id) : Promise.resolve([]),
    profissional.ehPersonal ? buscarAlunosComAderencia(profissional.id) : Promise.resolve([]),
    contarClientesAtivos(profissional.id),
  ]);

  const vagasRestantes = profissional.limitePlano - totalAtivos;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-3">
            <NoSheipeLogo size={24} />
          </div>
          <h1 className="font-display text-3xl">Olá, {profissional.nome}</h1>
        </div>
        <form action={sairProfissional}>
          <button
            type="submit"
            className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
          >
            Sair
          </button>
        </form>
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        {totalAtivos} de {profissional.limitePlano} do plano
        {vagasRestantes <= 0 ? " — limite atingido" : ""}.
      </p>

      {vagasRestantes <= 0 && (
        <p className="mt-4 text-sm text-urgent">
          Limite de {profissional.limitePlano} atingido — arquive alguém pra liberar uma vaga.
        </p>
      )}

      {profissional.ehNutricionista && (
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow">Pacientes · nutrição</h2>
            {vagasRestantes > 0 && (
              <Link
                href="/pro/pacientes/novo"
                className="inline-flex items-center gap-1.5 rounded-sm bg-sheipe px-3 py-1.5 text-xs font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep"
              >
                <Plus size={14} strokeWidth={2} /> Novo paciente
              </Link>
            )}
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {pacientes.map(({ paciente, saldoHoje, saldoSemana, foraDaMeta, diasSemRegistro, sumido }) => (
              <li key={paciente.id}>
                <Link
                  href={`/pro/pacientes/${paciente.id}`}
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
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className={foraDaMeta ? "text-urgent" : "text-ink-soft"}>
                      Hoje: {saldoHoje.kcal.percentual}%
                    </span>
                    <span className="text-ink-soft">Semana: {saldoSemana.kcal.percentual}%</span>
                    {sumido && <span className="text-attention">sem registrar há {diasSemRegistro} dias</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pacientes.length === 0 && <p className="mt-4 text-sm text-ink-faint">Nenhum paciente cadastrado ainda.</p>}
        </section>
      )}

      {profissional.ehPersonal && (
        <section className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 className="eyebrow">Alunos · treino</h2>
            {vagasRestantes > 0 && (
              <Link
                href="/pro/alunos/novo"
                className="inline-flex items-center gap-1.5 rounded-sm bg-sheipe px-3 py-1.5 text-xs font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep"
              >
                <Plus size={14} strokeWidth={2} /> Novo aluno
              </Link>
            )}
          </div>

          <ul className="mt-4 flex flex-col gap-3">
            {alunos.map(({ aluno, treinoAtivo, aderenciaSemana, foraDoTreino, diasSemRegistro, sumido }) => (
              <li key={aluno.id}>
                <Link
                  href={`/pro/alunos/${aluno.id}`}
                  className={`paper-card block rounded-sm p-4 transition-colors hover:border-sheipe ${
                    foraDoTreino ? "border-l-[3px] border-l-urgent-line" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-lg leading-snug">{aluno.nome}</p>
                    {foraDoTreino && <span className="eyebrow shrink-0 text-urgent">fora do treino</span>}
                  </div>
                  {treinoAtivo ? (
                    <>
                      <p className="mt-1 text-xs text-ink-faint">
                        {treinoAtivo.nome} · meta {treinoAtivo.diasPorSemana}x/semana
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className={foraDoTreino ? "text-urgent" : "text-ink-soft"}>
                          Semana: {aderenciaSemana?.diasTreinados}/{aderenciaSemana?.diasPorSemana} dias (
                          {aderenciaSemana?.percentual}%)
                        </span>
                        {sumido && <span className="text-attention">sem treinar há {diasSemRegistro} dias</span>}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-attention">Nenhum treino prescrito ainda</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {alunos.length === 0 && <p className="mt-4 text-sm text-ink-faint">Nenhum aluno cadastrado ainda.</p>}
        </section>
      )}
    </main>
  );
}
