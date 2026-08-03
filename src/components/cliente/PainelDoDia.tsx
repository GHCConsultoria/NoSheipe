"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Plus } from "lucide-react";
import { definirMetaAgua, registrarAgua, registrarTreino } from "@/lib/cliente/publico";

type Cor = "agua" | "dieta" | "treino";

const PONTO: Record<Cor, string> = {
  agua: "var(--color-agua)",
  dieta: "var(--color-dieta)",
  treino: "var(--color-treino)",
};
const TEXTO: Record<Cor, string> = { agua: "text-agua", dieta: "text-dieta", treino: "text-treino" };

interface LegendasProps {
  token: string;
  agua: { consumidoMl: number; metaMl: number; percentual: number };
  dieta: { consumido: number; meta: number; percentual: number } | null;
  treino: { percentual: number; diasTreinados: number; diasPorSemana: number; feitoHoje: boolean } | null;
}

/**
 * Legendas do anel, mas interativas: cada métrica mostra o número e traz a
 * ação rápida do próprio card ali do lado — copo d'água, ir pro registro de
 * refeição, marcar treino. É o que o diagrama chamou de "legendas
 * interativas": ler e agir no mesmo lugar.
 */
export function LegendasDoDia({ token, agua, dieta, treino }: LegendasProps) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [rascunhoMeta, setRascunhoMeta] = useState(String(agua.metaMl));

  function agir(acao: () => Promise<{ sucesso: boolean; erro?: string }>) {
    setErro(null);
    iniciarTransicao(async () => {
      const r = await acao();
      if (!r.sucesso) setErro(r.erro ?? "não deu — tente de novo");
      router.refresh();
    });
  }

  function irProRegistro() {
    document.getElementById("registrar")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="mt-6 flex flex-col gap-2">
      <Linha
        cor="agua"
        rotulo="Água"
        detalhe={`${agua.consumidoMl} / ${agua.metaMl} ml`}
        percentual={agua.percentual}
        aoTocarDetalhe={() => {
          setRascunhoMeta(String(agua.metaMl));
          setEditandoMeta((v) => !v);
        }}
        acao={
          <BotaoAcao rotulo="+250 ml" pendente={pendente} onClick={() => agir(() => registrarAgua({ token }))} />
        }
      />
      {editandoMeta && (
        <div className="ml-5 flex items-end gap-2">
          <label className="flex flex-col gap-0.5 text-[0.65rem] text-ink-faint">
            Meta de água (ml)
            <input
              type="number"
              min={250}
              step={250}
              inputMode="numeric"
              value={rascunhoMeta}
              onChange={(e) => setRascunhoMeta(e.target.value)}
              className="w-28 rounded-sm border border-rule bg-paper px-2 py-1 text-sm outline-none focus:border-agua"
            />
          </label>
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              agir(async () => {
                const r = await definirMetaAgua({ token, metaMl: rascunhoMeta });
                if (r.sucesso) setEditandoMeta(false);
                return r;
              })
            }
            className="tatil rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-agua hover:text-ink disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      )}

      {dieta && (
        <Linha
          cor="dieta"
          rotulo="Dieta"
          detalhe={`${dieta.consumido} / ${dieta.meta} kcal`}
          percentual={dieta.percentual}
          acao={<BotaoAcao rotulo="+" aria="Registrar refeição" pendente={pendente} onClick={irProRegistro} />}
        />
      )}

      {treino && (
        <Linha
          cor="treino"
          rotulo="Treino"
          detalhe={
            treino.feitoHoje ? "Feito hoje" : `${treino.diasTreinados} de ${treino.diasPorSemana} dias na semana`
          }
          percentual={treino.percentual}
          acao={
            treino.feitoHoje ? (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-treino text-treino-on">
                <Check size={16} strokeWidth={2.5} />
              </span>
            ) : (
              <BotaoAcao
                rotulo=""
                icone={<Check size={16} strokeWidth={2.5} />}
                aria="Marcar treino de hoje"
                pendente={pendente}
                onClick={() =>
                  agir(() =>
                    registrarTreino({ token, clientLogId: crypto.randomUUID(), rawText: "Treino do dia", origem: "TEXTO" }),
                  )
                }
              />
            )
          }
        />
      )}

      {erro && <p className="text-sm text-urgent">{erro}</p>}
    </section>
  );
}

function Linha({
  cor,
  rotulo,
  detalhe,
  percentual,
  acao,
  aoTocarDetalhe,
}: {
  cor: Cor;
  rotulo: string;
  detalhe: string;
  percentual: number;
  acao: React.ReactNode;
  aoTocarDetalhe?: () => void;
}) {
  const conteudo = (
    <>
      <span className="text-sm">{rotulo}</span>
      <span className="text-xs text-ink-faint">· {detalhe}</span>
    </>
  );
  return (
    <div className="paper-card flex items-center gap-3 rounded-sm px-3 py-2.5">
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PONTO[cor] }} />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        {aoTocarDetalhe ? (
          <button type="button" onClick={aoTocarDetalhe} className="flex items-baseline gap-1.5 text-left">
            {conteudo}
          </button>
        ) : (
          conteudo
        )}
      </div>
      <span className={`font-data text-sm tabular-nums ${TEXTO[cor]}`}>{percentual}%</span>
      {acao}
    </div>
  );
}

function BotaoAcao({
  rotulo,
  icone,
  aria,
  pendente,
  onClick,
}: {
  rotulo: string;
  icone?: React.ReactNode;
  aria?: string;
  pendente: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label={aria}
      onClick={onClick}
      className="tatil inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-rule px-2.5 text-xs font-medium text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
    >
      {icone ?? <Plus size={14} strokeWidth={2.25} />}
      {rotulo}
    </button>
  );
}

interface MacroParcial {
  consumido: number;
  meta: number;
}

/** Linha de macros — proteína, carbo, gordura, cada um consumido/meta. */
export function MacrosDoDia({
  proteina,
  carbo,
  gordura,
}: {
  proteina: MacroParcial;
  carbo: MacroParcial;
  gordura: MacroParcial;
}) {
  const itens: { emoji: string; letra: string; dado: MacroParcial }[] = [
    { emoji: "🥩", letra: "P", dado: proteina },
    { emoji: "🍞", letra: "C", dado: carbo },
    { emoji: "🥑", letra: "G", dado: gordura },
  ];
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {itens.map(({ emoji, letra, dado }) => (
        <div key={letra} className="paper-card rounded-sm px-2 py-2 text-center">
          <div className="text-sm">
            {emoji} <span className="font-data tabular-nums">{dado.consumido}</span>
            <span className="text-ink-faint">/{dado.meta}g</span>
          </div>
          <div className="eyebrow mt-0.5">{letra}</div>
        </div>
      ))}
    </div>
  );
}

const DIAS_ROTULO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/**
 * Chama da constância: a fileira da semana (uma chama por dia com registro)
 * e o total da ofensiva. A partir de 7 dias seguidos a chama fica azul — o
 * selo de "constância impecável".
 */
export function ChamaDaSemana({
  semana,
  ofensiva,
}: {
  semana: { dias: boolean[]; hoje: number };
  ofensiva: { dias: number; ativaHoje: boolean };
}) {
  const azul = ofensiva.dias >= 7;

  return (
    <section id="constancia" className="paper-card mt-8 scroll-mt-20 rounded-sm p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex flex-col items-center rounded-sm px-3 py-2 ${
            azul ? "bg-sky-500/10 text-sky-400" : "text-attention"
          }`}
        >
          <Flame size={22} strokeWidth={2} fill="currentColor" />
          <span className="font-display text-lg leading-none tabular-nums">{ofensiva.dias}</span>
          {azul && <span className="text-[0.6rem] font-medium tracking-wide">AZUL</span>}
        </div>

        <div className="flex-1">
          <p className="eyebrow mb-2">{azul ? "Constância impecável" : "Sua semana"}</p>
          <div className="flex justify-between">
            {DIAS_ROTULO.map((rotulo, i) => {
              const aceso = semana.dias[i];
              const hoje = semana.hoje === i;
              return (
                <div key={rotulo} className="flex flex-col items-center gap-1">
                  <Flame
                    size={18}
                    strokeWidth={aceso ? 2 : 1.5}
                    fill={aceso ? "currentColor" : "none"}
                    className={aceso ? (azul ? "text-sky-400" : "text-attention") : "text-ink-faint"}
                  />
                  <span className={`text-[0.6rem] ${hoje ? "font-medium text-ink" : "text-ink-faint"}`}>{rotulo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
