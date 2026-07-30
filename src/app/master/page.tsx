import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buscarClientes, buscarMetricasGerais, buscarProfissionais } from "@/lib/master/consultas";
import { NumeroAnimado } from "@/components/shared/NumeroAnimado";
import { ehErroDeAutenticacao, obterMasterAtual } from "@/lib/profissional/auth";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export const dynamic = "force-dynamic";

const FORMATADOR_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

/**
 * Painel administrativo, somente leitura.
 *
 * Mostra como o produto está sendo usado — quantos profissionais, quantos
 * clientes, quanto registro entrando. Não mostra nada do que o cliente
 * comeu, pesou ou treinou: isso é dado de saúde de terceiro, e a operação
 * não precisa dele pra saber se o negócio está de pé.
 *
 * A checagem de permissão precisa estar AQUI, e não só no layout: layout e
 * page renderizam em paralelo, então um notFound() só no layout troca o
 * status pra 404 mas não impede esta página de consultar o banco e
 * serializar o resultado no payload — a resposta sai 404 com os dados
 * dentro. Medido, não suposto. O layout continua como segunda barreira.
 */
export default async function PainelMaster() {
  let master;
  try {
    master = await obterMasterAtual();
  } catch (erro) {
    if (ehErroDeAutenticacao(erro)) {
      redirect("/pro/login");
    }
    throw erro;
  }
  if (!master) {
    notFound();
  }

  const [metricas, profissionais, clientes] = await Promise.all([
    buscarMetricasGerais(),
    buscarProfissionais(),
    buscarClientes(),
  ]);

  return (
    <main className="entrada-aba mx-auto max-w-3xl px-6 py-16">
      <Link href="/pro" className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe">
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
      <div className="mt-6 mb-3">
        <NoSheipeLogo size={24} />
      </div>
      <h1 className="font-display text-3xl">Administração</h1>
      <p className="mt-1 text-sm text-ink-soft">Somente leitura. Nada aqui altera dado de ninguém.</p>

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Uso do produto</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Profissionais" valor={metricas.profissionais} />
          <Numero rotulo="Clientes ativos" valor={metricas.clientesAtivos} />
          <Numero rotulo="Acompanhamentos" valor={metricas.vinculosAtivos} />
          <Numero rotulo="Registros 7 dias" valor={metricas.registros7dias} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Nutricionistas" valor={metricas.profissionaisNutricionistas} discreto />
          <Numero rotulo="Personais" valor={metricas.profissionaisPersonais} discreto />
          <Numero rotulo="Clientes arquivados" valor={metricas.clientesArquivados} discreto />
          <Numero rotulo="Registros 30 dias" valor={metricas.registros30dias} discreto />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Vínculos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Nutrição" valor={metricas.vinculosNutricao} discreto />
          <Numero rotulo="Treino" valor={metricas.vinculosTreino} discreto />
          <Numero rotulo="Aguardando aceite" valor={metricas.vinculosPendentes} discreto />
          <Numero rotulo="Compartilhados" valor={metricas.clientesCompartilhados} discreto />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          &ldquo;Compartilhados&rdquo; são clientes atendidos por mais de um profissional ao mesmo tempo.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Profissionais</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-rule text-ink-faint">
                <th className="py-2 pr-3 font-normal">Nome</th>
                <th className="py-2 pr-3 font-normal">Atuação</th>
                <th className="py-2 pr-3 text-right font-normal">Clientes</th>
                <th className="py-2 pr-3 text-right font-normal">Pendentes</th>
                <th className="py-2 text-right font-normal">Desde</th>
              </tr>
            </thead>
            <tbody>
              {profissionais.map((p) => (
                <tr key={p.id} className="border-b border-rule/60">
                  <td className="py-2.5 pr-3">
                    <span className="block">{p.nome}</span>
                    <span className="block text-xs text-ink-faint">{p.email}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-ink-soft">
                    {[p.ehNutricionista && "nutri", p.ehPersonal && "personal", p.ehMaster && "master"]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="font-data py-2.5 pr-3 text-right">
                    {p.clientesAtivos}
                    <span className="text-ink-faint">/{p.limitePlano}</span>
                  </td>
                  <td className="font-data py-2.5 pr-3 text-right text-ink-soft">{p.pendentes || "—"}</td>
                  <td className="font-data py-2.5 text-right text-xs text-ink-faint">
                    {FORMATADOR_DATA.format(p.criadoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {profissionais.length === 0 && <p className="text-sm text-ink-faint">Nenhum profissional cadastrado.</p>}
      </section>

      <section className="mt-10">
        <h2 className="eyebrow mb-1">Clientes</h2>
        <p className="mb-3 text-xs text-attention">
          Abrir um cliente mostra dado de saúde dele — refeições, peso e as anotações de todos os profissionais que o
          atendem. Use só quando a operação exigir.
        </p>
        <ul className="flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/master/clientes/${c.id}`}
                className="tatil paper-card block rounded-sm p-4 transition-colors hover:border-sheipe"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-base leading-snug">
                    {c.nome}
                    {c.status !== "ATIVO" && <span className="eyebrow ml-2 text-ink-faint">arquivado</span>}
                  </p>
                  <span className="font-data shrink-0 text-xs text-ink-faint">
                    {c.refeicoes + c.sessoes} registros
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  {c.acompanhantes.length > 0
                    ? c.acompanhantes
                        .map((a) => `${a.nome} (${a.tipo === "NUTRICAO" ? "dieta" : "treino"})`)
                        .join(" · ")
                    : "sem profissional ativo"}
                </p>
                {c.ultimoRegistroEm && (
                  <p className="mt-1 text-xs text-ink-faint">
                    último registro em {FORMATADOR_DATA.format(c.ultimoRegistroEm)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {clientes.length === 0 && <p className="text-sm text-ink-faint">Nenhum cliente cadastrado.</p>}
      </section>
    </main>
  );
}

function Numero({ rotulo, valor, discreto = false }: { rotulo: string; valor: number; discreto?: boolean }) {
  return (
    <div className="paper-card rounded-sm p-4">
      <p className="eyebrow">{rotulo}</p>
      <p className={`font-display ${discreto ? "text-xl" : "text-3xl"} mt-1`}>
        <NumeroAnimado valor={valor} />
      </p>
    </div>
  );
}
