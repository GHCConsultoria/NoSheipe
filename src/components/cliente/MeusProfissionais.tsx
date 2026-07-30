"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, X } from "lucide-react";
import { aceitarVinculo, encerrarVinculo, recusarVinculo } from "@/lib/cliente/publico";

interface Vinculo {
  id: string;
  tipo: "NUTRICAO" | "TREINO";
  profissionalNome: string;
}

interface Props {
  token: string;
  codigoConvite: string;
  ativos: Vinculo[];
  solicitacoes: Vinculo[];
}

function rotuloDoTipo(tipo: Vinculo["tipo"]): string {
  return tipo === "NUTRICAO" ? "nutrição" : "treino";
}

/**
 * Quem acompanha o cliente, e quem pediu pra acompanhar.
 *
 * A aprovação mora aqui, na página do cliente, e não no painel de quem
 * pediu: são os dados de saúde dele, então quem decide compartilhar é ele.
 */
export function SolicitacoesPendentes({ token, solicitacoes }: { token: string; solicitacoes: Vinculo[] }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (solicitacoes.length === 0) return null;

  function responder(acao: typeof aceitarVinculo, vinculoId: string) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await acao({ token, vinculoId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-6">
      <h2 className="eyebrow mb-3">Pediram pra te acompanhar</h2>
      <ul className="flex flex-col gap-3">
        {solicitacoes.map((s) => (
          <li key={s.id} className="paper-card rounded-sm border-l-[3px] border-l-sheipe p-4">
            <p className="text-sm">
              <span className="font-display">{s.profissionalNome}</span> quer acompanhar seu {rotuloDoTipo(s.tipo)}.
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              Se você aceitar, essa pessoa passa a ver os seus registros de {rotuloDoTipo(s.tipo)}. Dá pra encerrar
              depois, quando quiser.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={pendente}
                onClick={() => responder(aceitarVinculo, s.id)}
                className="inline-flex items-center gap-1.5 rounded-sm bg-sheipe px-3 py-1.5 text-xs font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
              >
                <Check size={13} strokeWidth={2} /> Aceitar
              </button>
              <button
                type="button"
                disabled={pendente}
                onClick={() => responder(recusarVinculo, s.id)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-urgent-line hover:text-urgent disabled:opacity-50"
              >
                <X size={13} strokeWidth={2} /> Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {erro && <p className="mt-2 text-sm text-urgent">{erro}</p>}
    </section>
  );
}

/** Lista de quem acompanha hoje + o código que convida alguém novo. */
export function MeusProfissionais({ token, codigoConvite, ativos }: Omit<Props, "solicitacoes">) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  function encerrar(vinculo: Vinculo) {
    const confirmado = window.confirm(
      `Encerrar o acompanhamento de ${vinculo.profissionalNome}? Essa pessoa deixa de ver seus registros de ` +
        `${rotuloDoTipo(vinculo.tipo)}. Seu histórico não é apagado.`,
    );
    if (!confirmado) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await encerrarVinculo({ token, vinculoId: vinculo.id });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3">Quem te acompanha</h2>

      {ativos.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {ativos.map((v) => (
            <li key={v.id} className="paper-card flex items-center justify-between gap-3 rounded-sm p-4">
              <div>
                <p className="text-sm">{v.profissionalNome}</p>
                <p className="text-xs text-ink-faint">{rotuloDoTipo(v.tipo)}</p>
              </div>
              <button
                type="button"
                disabled={pendente}
                onClick={() => encerrar(v)}
                className="shrink-0 text-xs text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
              >
                encerrar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Ninguém ainda.</p>
      )}

      {erro && <p className="mt-2 text-sm text-urgent">{erro}</p>}

      <div className="paper-card mt-3 rounded-sm p-4">
        <p className="text-xs text-ink-faint">
          Pra um nutricionista ou personal te acompanhar, passe este código pra ele. Ele não dá acesso à sua conta —
          você ainda precisa aceitar aqui.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="font-data flex-1 rounded-sm border border-rule bg-paper px-3 py-2 text-center text-lg tracking-[0.2em]">
            {codigoConvite}
          </code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(codigoConvite);
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 2000);
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
          >
            <Copy size={13} strokeWidth={1.75} /> {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
    </section>
  );
}
