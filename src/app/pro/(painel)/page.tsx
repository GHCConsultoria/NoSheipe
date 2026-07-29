import Link from "next/link";
import { Plus } from "lucide-react";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import {
  buscarClientesDoProfissional,
  buscarSolicitacoesEnviadas,
  contarVinculosAtivos,
} from "@/lib/profissional/consultas";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { AdicionarPorCodigo } from "@/components/cliente/AdicionarPorCodigo";
import { sairProfissional } from "../login/actions";

/**
 * Painel do profissional: um cliente por linha, com os indicadores de cada
 * lado que ELE acompanha. Quem só cuida do treino não vê nada de nutrição,
 * mesmo que o cliente tenha um nutricionista.
 */
export default async function Painel() {
  const profissional = await obterProfissionalAtual();
  const [clientes, totalAtivos, solicitacoes] = await Promise.all([
    buscarClientesDoProfissional(profissional.id),
    contarVinculosAtivos(profissional.id),
    buscarSolicitacoesEnviadas(profissional.id),
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
        <div className="flex shrink-0 items-center gap-2">
          {/* Só quem tem ehMaster no banco vê o link — a rota já devolve
              404 pros outros, mas não faz sentido mostrar. */}
          {profissional.ehMaster && (
            <Link
              href="/master"
              className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
            >
              Admin
            </Link>
          )}
          <form action={sairProfissional}>
            <button
              type="submit"
              className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
            >
              Sair
            </button>
          </form>
        </div>
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        {totalAtivos} de {profissional.limitePlano} acompanhamentos do plano
        {vagasRestantes <= 0 ? " — limite atingido" : ""}.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {vagasRestantes > 0 ? (
          <>
            <Link
              href="/pro/clientes/novo"
              className="inline-flex w-fit items-center gap-1.5 rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep"
            >
              <Plus size={15} strokeWidth={2} /> Novo cliente
            </Link>
            <AdicionarPorCodigo
              ehNutricionista={profissional.ehNutricionista}
              ehPersonal={profissional.ehPersonal}
            />
          </>
        ) : (
          <p className="text-sm text-urgent">
            Limite de {profissional.limitePlano} atingido — encerre um acompanhamento pra liberar vaga.
          </p>
        )}
      </div>

      {solicitacoes.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Aguardando o cliente aceitar</h2>
          <ul className="flex flex-col gap-2">
            {solicitacoes.map((s) => (
              <li key={s.id} className="paper-card flex items-baseline justify-between gap-3 rounded-sm p-4">
                <p className="text-sm">{s.clienteNome}</p>
                <span className="eyebrow shrink-0 text-ink-faint">
                  {s.tipo === "NUTRICAO" ? "dieta" : "treino"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-8 flex flex-col gap-3">
        {clientes.map(({ cliente, nutricao, treino }) => {
          const emAlerta = Boolean(nutricao?.foraDaMeta || treino?.foraDoTreino);
          return (
            <li key={cliente.id}>
              <Link
                href={`/pro/clientes/${cliente.id}`}
                className={`paper-card block rounded-sm p-4 transition-colors hover:border-sheipe ${
                  emAlerta ? "border-l-[3px] border-l-urgent-line" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-lg leading-snug">{cliente.nome}</p>
                  <div className="flex shrink-0 gap-2">
                    {nutricao && <span className="eyebrow text-ink-faint">dieta</span>}
                    {treino && <span className="eyebrow text-ink-faint">treino</span>}
                  </div>
                </div>

                {nutricao && (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                    <span className="eyebrow">Dieta</span>
                    <span className={nutricao.foraDaMeta ? "text-urgent" : "text-ink-soft"}>
                      hoje {nutricao.saldoHoje.kcal.percentual}%
                    </span>
                    <span className="text-ink-soft">semana {nutricao.saldoSemana.kcal.percentual}%</span>
                    {nutricao.sumido && (
                      <span className="text-attention">sem registrar há {nutricao.diasSemRegistro} dias</span>
                    )}
                  </div>
                )}

                {treino && (
                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                    <span className="eyebrow">Treino</span>
                    {treino.treino && treino.aderenciaSemana ? (
                      <>
                        <span className={treino.foraDoTreino ? "text-urgent" : "text-ink-soft"}>
                          {treino.aderenciaSemana.diasTreinados}/{treino.aderenciaSemana.diasPorSemana} dias (
                          {treino.aderenciaSemana.percentual}%)
                        </span>
                        {treino.sumido && (
                          <span className="text-attention">sem treinar há {treino.diasSemRegistro} dias</span>
                        )}
                      </>
                    ) : (
                      <span className="text-attention">nenhum treino prescrito</span>
                    )}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {clientes.length === 0 && <p className="mt-8 text-sm text-ink-faint">Nenhum cliente cadastrado ainda.</p>}
    </main>
  );
}
