"use client";

import { useEffect, useId, useRef } from "react";
import { useContagem } from "@/components/shared/useContagem";

interface Props {
  /** % de aderência de treino na semana; null se o cliente não tem personal. */
  treino: number | null;
  /** % de kcal do dia; null se não tem nutricionista. */
  dieta: number | null;
  /**
   * % do cumprimento das metas do dia (média de água + dieta + treino). É o
   * número grande do centro E o nível da água — os dois dizem a mesma coisa:
   * a aguinha enche conforme o dia inteiro é cumprido.
   */
  total: number;
}

const CAIXA = 200;
const CENTRO = CAIXA / 2;
const ESPESSURA = 14;
/** Raios: treino por fora, dieta no meio; a água é o disco central. */
const RAIO_TREINO = 86;
const RAIO_DIETA = 64;
const RAIO_AGUA = 46;
/** Inclinação máxima da superfície da água ao girar o aparelho, em graus. */
const TILT_MAX = 13;

function fracao(pct: number): number {
  return Math.min(Math.max(pct, 0), 100) / 100;
}

/** Anel de traço (treino/dieta). */
function Anel({ raio, pct, cor, atraso }: { raio: number; pct: number; cor: string; atraso: number }) {
  const circunferencia = 2 * Math.PI * raio;
  const restante = circunferencia * (1 - fracao(pct));
  return (
    <>
      <circle cx={CENTRO} cy={CENTRO} r={raio} fill="none" stroke="var(--color-rule)" strokeWidth={ESPESSURA} />
      <circle
        className="anel-preenche"
        cx={CENTRO}
        cy={CENTRO}
        r={raio}
        fill="none"
        stroke={cor}
        strokeWidth={ESPESSURA}
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={restante}
        style={{ "--anel-vazio": circunferencia, animationDelay: `${atraso}ms` } as React.CSSProperties}
      />
    </>
  );
}

/**
 * O progresso do dia como o diagrama pediu: treino (verde) por fora, dieta
 * (gold) no meio e a ÁGUA no centro — agora uma bolha de vidro que enche de
 * verdade e cuja superfície BALANÇA quando o aparelho se mexe.
 *
 * O nível é uma translateY do grupo cheio (com transição, pra subir visível
 * ao registrar um copo). Por cima disso, um giro contido pela mão do usuário:
 * o `deviceorientation` (giroscópio) inclina a superfície pro lado contrário
 * ao do aparelho — como um líquido de verdade — com uma mola (lerp) que dá o
 * balanço. Sem sensor, sem permissão ou com "reduzir movimento", fica só a
 * ondinha parada; nada quebra.
 */
export function AnelDoDia({ treino, dieta, total }: Props) {
  const numero = useContagem(total);
  const idBase = useId().replace(/:/g, "");
  const clip = `clip-${idBase}`;
  const gloss = `gloss-${idBase}`;
  const depth = `depth-${idBase}`;

  const tiltRef = useRef<SVGGElement | null>(null);

  // Disco da água: topo em (CENTRO - RAIO_AGUA), altura = 2*RAIO_AGUA.
  const alturaAgua = 2 * RAIO_AGUA;
  // O nível da água é o TOTAL das metas — sobe conforme o dia é cumprido.
  const nivel = fracao(total);
  // Cheio = sem deslocamento; vazio = empurrado todo o disco pra baixo.
  const deslocamentoY = (1 - nivel) * alturaAgua;
  const topoAgua = CENTRO - RAIO_AGUA;

  // Superfície que balança com o giroscópio (com mola). Aplica o transform
  // direto no <g> via ref pra não re-renderizar o React a cada frame.
  useEffect(() => {
    const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduz) return;

    let alvo = 0;
    let atual = 0;
    let raf = 0;
    let rodando = false;

    const aoInclinar = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // giro esquerda/direita do aparelho
      alvo = Math.max(-TILT_MAX, Math.min(TILT_MAX, -gamma * 0.55));
    };

    const loop = () => {
      atual += (alvo - atual) * 0.12; // mola: aproxima suave do alvo
      tiltRef.current?.setAttribute("transform", `rotate(${atual.toFixed(2)} ${CENTRO} ${CENTRO})`);
      raf = requestAnimationFrame(loop);
    };

    const ativar = () => {
      if (rodando) return;
      rodando = true;
      window.addEventListener("deviceorientation", aoInclinar, true);
      raf = requestAnimationFrame(loop);
    };

    const DOE = window.DeviceOrientationEvent as (typeof window.DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    }) | undefined;

    // iOS exige pedir permissão do sensor a partir de um gesto do usuário.
    const pedirPermissao = () => {
      DOE?.requestPermission?.()
        .then((estado) => {
          if (estado === "granted") ativar();
        })
        .catch(() => {});
      document.removeEventListener("pointerdown", pedirPermissao);
    };

    if (DOE && typeof DOE.requestPermission === "function") {
      document.addEventListener("pointerdown", pedirPermissao, { once: true });
    } else if (DOE) {
      ativar();
    }

    return () => {
      window.removeEventListener("deviceorientation", aoInclinar, true);
      document.removeEventListener("pointerdown", pedirPermissao);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: 240, height: 240 }}>
        <svg viewBox={`0 0 ${CAIXA} ${CAIXA}`} width={240} height={240} aria-hidden="true">
          <defs>
            <clipPath id={clip}>
              <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} />
            </clipPath>
            {/* Brilho de vidro: reflexo forte no alto-esquerda esmaecendo. */}
            <radialGradient id={gloss} cx="34%" cy="26%" r="78%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="34%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            {/* Profundidade do líquido: mais claro na crista, fundo mais denso. */}
            <linearGradient id={depth} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-agua)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="var(--color-agua)" stopOpacity="1" />
            </linearGradient>
          </defs>

          <g transform={`rotate(-90 ${CENTRO} ${CENTRO})`}>
            {treino !== null && <Anel raio={RAIO_TREINO} pct={treino} cor="var(--color-treino)" atraso={0} />}
            {dieta !== null && <Anel raio={RAIO_DIETA} pct={dieta} cor="var(--color-dieta)" atraso={120} />}
          </g>

          {/* Poço da bolha (fundo escuro) e o líquido recortado no disco. */}
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} fill="#06131a" />
          <g clipPath={`url(#${clip})`}>
            {/* Grupo do TILT (giro pela mão) girando em torno do centro do disco. */}
            <g ref={tiltRef}>
              <g
                style={{
                  transform: `translateY(${deslocamentoY}px)`,
                  transition: "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {/* Corpo do líquido, do topo do disco bem pra baixo. */}
                <rect x={CENTRO - 70} y={topoAgua + 6} width={140} height={alturaAgua + 70} fill={`url(#${depth})`} />
                {/* Crista: uma onda larga que desliza de lado (loop de 40px). */}
                <path
                  className="onda-agua"
                  fill={`url(#${depth})`}
                  d={`M${CENTRO - 110},${topoAgua + 6} q10,-6 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 V${topoAgua + alturaAgua + 70} H${CENTRO - 110} Z`}
                />
                {/* Reflexo fino na linha da água. */}
                <path
                  className="onda-agua"
                  fill="none"
                  stroke="#e0fbff"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  d={`M${CENTRO - 110},${topoAgua + 6} q10,-6 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0`}
                />
              </g>
            </g>
          </g>

          {/* Vidro por cima: sheen radial + realce especular + aro. */}
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} fill={`url(#${gloss})`} />
          <ellipse cx={CENTRO - 15} cy={CENTRO - 24} rx={16} ry={9} fill="#ffffff" opacity={0.35} transform={`rotate(-28 ${CENTRO - 15} ${CENTRO - 24})`} />
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} fill="none" stroke="#bff0fa" strokeWidth={1.5} strokeOpacity={0.55} />
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA - 1} fill="none" stroke="#000" strokeWidth={2} strokeOpacity={0.25} />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl leading-none tabular-nums text-ink drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            {numero}
            <span className="text-xl">%</span>
          </span>
          <span className="eyebrow mt-1 text-ink-soft">do dia</span>
        </div>
      </div>
    </div>
  );
}
