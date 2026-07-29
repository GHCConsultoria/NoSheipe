import Link from "next/link";
import { Plus } from "lucide-react";
import { obterPersonalTrainerAtual } from "@/lib/personal/auth";
import { buscarAlunosComAderencia } from "@/lib/personal/consultas";
import { estaSemRegistroHaMuitoTempo } from "@/lib/nutri/aderencia";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { sairPersonalTrainer } from "../login/actions";

/**
 * Painel de aderência: % de dias treinados na semana por aluno, com
 * destaque de quem está fora (ver limiar em src/lib/personal/aderencia.ts).
 */
export default async function PainelPersonal() {
  const personalTrainer = await obterPersonalTrainerAtual();
  const alunosComAderencia = await buscarAlunosComAderencia(personalTrainer.id);
  const vagasRestantes = personalTrainer.limitePlano - alunosComAderencia.length;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-3">
            <NoSheipeLogo size={24} />
          </div>
          <h1 className="font-display text-3xl">Olá, {personalTrainer.nome}</h1>
        </div>
        <form action={sairPersonalTrainer}>
          <button
            type="submit"
            className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
          >
            Sair
          </button>
        </form>
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        {alunosComAderencia.length} de {personalTrainer.limitePlano} alunos do plano
        {vagasRestantes <= 0 ? " — limite atingido" : ""}.
      </p>

      <div className="mt-6">
        {vagasRestantes > 0 ? (
          <Link
            href="/personal/alunos/novo"
            className="inline-flex items-center gap-1.5 rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep"
          >
            <Plus size={15} strokeWidth={2} /> Novo aluno
          </Link>
        ) : (
          <p className="text-sm text-urgent">
            Limite de {personalTrainer.limitePlano} alunos atingido — arquive alguém pra liberar uma vaga.
          </p>
        )}
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {alunosComAderencia.map(({ aluno, treinoAtivo, aderenciaSemana, foraDoTreino, diasSemRegistro }) => {
          const sumido = estaSemRegistroHaMuitoTempo(diasSemRegistro);
          return (
            <li key={aluno.id}>
              <Link
                href={`/personal/alunos/${aluno.id}`}
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
          );
        })}
      </ul>

      {alunosComAderencia.length === 0 && (
        <p className="mt-8 text-sm text-ink-faint">Nenhum aluno cadastrado ainda.</p>
      )}
    </main>
  );
}
