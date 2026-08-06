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
   * nível da água — a bolha enche conforme o dia inteiro é cumprido.
   */
  total: number;
}

const CAIXA = 200;
const CENTRO = CAIXA / 2;
const ESPESSURA = 13;
/** Raios: treino por fora, dieta no meio; a água é a bolha central. */
const RAIO_TREINO = 84;
const RAIO_DIETA = 62;
const RAIO_AGUA = 40;
/** Inclinação máxima da superfície da água ao girar o aparelho, em graus. */
const TILT_MAX = 24;

function fracao(pct: number): number {
  return Math.min(Math.max(pct, 0), 100) / 100;
}

/** Anel de traço com gradiente e brilho (treino/dieta). */
function Anel({ raio, pct, grad, sombra }: { raio: number; pct: number; grad: string; sombra: string }) {
  const circunferencia = 2 * Math.PI * raio;
  const restante = circunferencia * (1 - fracao(pct));
  return (
    <>
      <circle cx={CENTRO} cy={CENTRO} r={raio} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={ESPESSURA} />
      <circle
        className="anel-preenche"
        cx={CENTRO}
        cy={CENTRO}
        r={raio}
        fill="none"
        stroke={grad}
        strokeWidth={ESPESSURA}
        strokeLinecap="round"
        strokeDasharray={circunferencia}
        strokeDashoffset={restante}
        style={{ "--anel-vazio": circunferencia, filter: `drop-shadow(0 0 6px ${sombra})` } as React.CSSProperties}
      />
    </>
  );
}

/**
 * O progresso do dia como herói: treino (verde→teal) e dieta (gold→laranja)
 * em anéis com gradiente e brilho, e a ÁGUA no centro — uma bolha de vidro
 * que enche de verdade e cuja superfície BALANÇA quando o aparelho se mexe
 * (deviceorientation com mola). O número do dia fica discreto, sem roubar a
 * cena da bolha. Sem sensor/permissão ou com "reduzir movimento", a água só
 * não balança — nada quebra.
 */
export function AnelDoDia({ treino, dieta, total }: Props) {
  const numero = useContagem(total);
  const id = useId().replace(/:/g, "");
  const clip = `wc-${id}`;

  const tiltRef = useRef<SVGGElement | null>(null);

  const alturaAgua = 2 * RAIO_AGUA;
  const nivel = fracao(total);
  const deslocamentoY = (1 - nivel) * alturaAgua;
  const topoAgua = CENTRO - RAIO_AGUA;

  useEffect(() => {
    const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduz) return;

    let alvo = 0;
    let atual = 0;
    let raf = 0;
    let rodando = false;

    const aoInclinar = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0;
      alvo = Math.max(-TILT_MAX, Math.min(TILT_MAX, -gamma));
    };
    const loop = () => {
      atual += (alvo - atual) * 0.12;
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
    const pedirPermissao = () => {
      DOE?.requestPermission?.()
        .then((s) => {
          if (s === "granted") ativar();
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
      <div className="relative" style={{ width: 264, height: 264 }}>
        <svg viewBox={`0 0 ${CAIXA} ${CAIXA}`} width={264} height={264} aria-hidden="true">
          <defs>
            <clipPath id={clip}>
              <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} />
            </clipPath>
            <linearGradient id={`gt-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00FF66" />
              <stop offset="100%" stopColor="#00E0C6" />
            </linearGradient>
            <linearGradient id={`gd-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFB020" />
              <stop offset="100%" stopColor="#FF7A00" />
            </linearGradient>
            <linearGradient id={`gw-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7EE8FF" />
              <stop offset="100%" stopColor="#1E7BFF" />
            </linearGradient>
            <radialGradient id={`gloss-${id}`} cx="38%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <g transform={`rotate(-90 ${CENTRO} ${CENTRO})`}>
            {treino !== null && (
              <Anel raio={RAIO_TREINO} pct={treino} grad={`url(#gt-${id})`} sombra="rgba(0,255,102,0.5)" />
            )}
            {dieta !== null && <Anel raio={RAIO_DIETA} pct={dieta} grad={`url(#gd-${id})`} sombra="rgba(255,149,0,0.45)" />}
          </g>

          {/* Bolha de vidro da água */}
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} fill="#071722" />
          <g clipPath={`url(#${clip})`}>
            <g ref={tiltRef}>
              <g
                style={{
                  transform: `translateY(${deslocamentoY}px)`,
                  transition: "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <rect x={CENTRO - 70} y={topoAgua + 6} width={140} height={alturaAgua + 70} fill={`url(#gw-${id})`} />
                <path
                  fill={`url(#gw-${id})`}
                  d={`M${CENTRO - 110},${topoAgua + 6} q10,-6 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 V${topoAgua + alturaAgua + 70} H${CENTRO - 110} Z`}
                />
                <path
                  fill="none"
                  stroke="#d6fbff"
                  strokeWidth={1}
                  strokeOpacity={0.55}
                  d={`M${CENTRO - 110},${topoAgua + 6} q10,-6 20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0 t20,0`}
                />
              </g>
            </g>
          </g>
          {/* Vidro por cima: sheen + realce + aro */}
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} fill={`url(#gloss-${id})`} />
          <path
            d={`M${CENTRO - 26},${CENTRO - 22} a${RAIO_AGUA} ${RAIO_AGUA} 0 0 1 20,-12`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.35}
          />
          <circle cx={CENTRO} cy={CENTRO} r={RAIO_AGUA} fill="none" stroke="rgba(180,240,255,0.35)" strokeWidth={1.5} />
        </svg>

        {/* Número discreto do dia — sem gigantismo por cima da água */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl leading-none tabular-nums text-ink drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
            {numero}
            <span className="text-base">%</span>
          </span>
          <span className="mt-1 text-[0.55rem] font-medium uppercase tracking-[0.22em] text-white/80">do dia</span>
        </div>
      </div>
    </div>
  );
}
