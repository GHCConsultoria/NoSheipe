import { notFound } from "next/navigation";
import { buscarClientePorToken, buscarHistoricoDeDias } from "@/lib/cliente/consultas";
import { estaForaDaMeta } from "@/lib/nutri/aderencia";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export const dynamic = "force-dynamic";

const FORMATADOR_DIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

export default async function HistoricoCliente({ params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  if (!cliente || !cliente.consentimentoEm) {
    notFound();
  }

  const historico = await buscarHistoricoDeDias(cliente.id);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      {/* Sem link de "voltar": a barra do rodapé já leva pra qualquer aba. */}
      <div className="mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-2xl">Seu histórico</h1>
      <p className="mt-1 text-sm text-ink-soft">Últimos 14 dias com registro.</p>

      {historico.length === 0 ? (
        <p className="mt-8 text-sm text-ink-faint">Nenhum registro ainda.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {historico.map((dia) => {
            // diaChave é yyyy-mm-dd em SP; o T12:00 evita o dia "voltar" um
            // ao ser reinterpretado como UTC na formatação.
            const data = new Date(`${dia.diaChave}T12:00:00Z`);
            const fora = estaForaDaMeta(dia.saldo.kcal.percentual);
            return (
              <li key={dia.diaChave} className={`paper-card rounded-sm p-4 ${fora ? "border-l-[3px] border-l-urgent-line" : ""}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm capitalize">{FORMATADOR_DIA.format(data)}</p>
                  <span className={`font-data text-xs ${fora ? "text-urgent" : "text-ink-soft"}`}>
                    {dia.saldo.kcal.percentual}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {dia.saldo.kcal.consumido} / {dia.saldo.kcal.meta} kcal · {dia.saldo.proteina.consumido}g P ·{" "}
                  {dia.saldo.carbo.consumido}g C · {dia.saldo.gordura.consumido}g G
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
                  <div
                    className={`h-full ${dia.saldo.kcal.percentual > 100 ? "bg-urgent" : "bg-sheipe"}`}
                    style={{ width: `${Math.min(dia.saldo.kcal.percentual, 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
