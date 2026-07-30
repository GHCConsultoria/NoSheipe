import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import { contarVinculosAtivos } from "@/lib/profissional/consultas";
import { NumeroAnimado } from "@/components/shared/NumeroAnimado";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";
import { sairProfissional } from "../../login/actions";

export const dynamic = "force-dynamic";

const FORMATADOR_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Conta do profissional.
 *
 * Nasceu junto com a barra de abas: o cabeçalho do painel acumulava "Sair"
 * e "Admin" espremidos no canto, e o tema flutuava sobre o conteúdo. Com
 * uma aba própria, cada um desses tem lugar — e o painel volta a ser só a
 * lista de clientes.
 *
 * Espelha o Perfil do cliente de propósito: nos dois lados, a terceira aba
 * é "quem sou eu aqui e o que controlo".
 */
export default async function ContaDoProfissional() {
  const profissional = await obterProfissionalAtual();
  const ativos = await contarVinculosAtivos(profissional.id);

  const atuacoes = [
    profissional.ehNutricionista && `Nutricionista${profissional.crn ? ` · ${profissional.crn}` : ""}`,
    profissional.ehPersonal && `Personal trainer${profissional.cref ? ` · ${profissional.cref}` : ""}`,
  ].filter(Boolean) as string[];

  const percentual = profissional.limitePlano > 0 ? Math.round((ativos / profissional.limitePlano) * 100) : 0;

  return (
    <main className="entrada-aba mx-auto max-w-2xl px-6 py-10 sm:py-16">
      <h1 className="font-display text-3xl">{profissional.nome}</h1>
      <p className="mt-1 text-sm text-ink-soft">{profissional.email}</p>

      <section className="paper-card mt-6 rounded-sm p-5">
        <h2 className="eyebrow mb-3">Atuação</h2>
        <ul className="flex flex-col gap-1 text-sm text-ink-soft">
          {atuacoes.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-faint">
          Na conta desde {FORMATADOR_DATA.format(profissional.criadoEm)}.
        </p>
      </section>

      <section className="paper-card mt-4 rounded-sm p-5">
        <h2 className="eyebrow mb-3">Plano</h2>
        <p className="font-display text-2xl">
          <NumeroAnimado valor={ativos} />
          <span className="text-ink-faint"> / {profissional.limitePlano}</span>
        </p>
        <p className="mt-1 text-sm text-ink-soft">acompanhamentos ativos</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-rule">
          <div
            className={`barra-preenche h-full ${percentual >= 100 ? "bg-urgent" : "bg-sheipe"}`}
            style={{ width: `${Math.min(percentual, 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Um cliente que você acompanha nos dois lados ocupa duas vagas — nutrição e treino contam separado.
        </p>
      </section>

      {profissional.ehMaster && (
        <section className="paper-card mt-4 rounded-sm p-5">
          <h2 className="eyebrow mb-3">Administração</h2>
          <Link
            href="/master"
            className="tatil inline-flex items-center gap-1.5 rounded-sm border border-rule px-3 py-2 text-sm text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
          >
            <ShieldCheck size={15} strokeWidth={1.75} /> Abrir painel administrativo
          </Link>
        </section>
      )}

      <section className="paper-card mt-4 flex items-center justify-between gap-3 rounded-sm p-5">
        <div>
          <h2 className="eyebrow">Aparência</h2>
          <p className="mt-1 text-sm text-ink-soft">Tema claro ou escuro</p>
        </div>
        <ThemeToggle inline />
      </section>

      <form action={sairProfissional} className="mt-6">
        <button
          type="submit"
          className="tatil rounded-sm border border-rule px-4 py-2 text-sm text-ink-soft transition-colors hover:border-urgent-line hover:text-urgent"
        >
          Sair da conta
        </button>
      </form>
    </main>
  );
}
