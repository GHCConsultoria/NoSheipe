"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trophy, X } from "lucide-react";
import { registrarCorrida, registrarTreino, removerCorrida, removerSessaoTreino } from "@/lib/cliente/publico";
import {
  DISTANCIA_MINIMA_RECORDE_METROS,
  formatarDuracao,
  formatarPace,
  paceSegundosPorKm,
} from "@/lib/cliente/corrida";
import type { CorridasDados, TreinoDoClienteDados } from "@/lib/cliente/consultas";

/**
 * Aba Treino do cliente: o treino prescrito ativo, a aderência da semana e o
 * check-in de treino (texto livre, sem IA — ao contrário da refeição). O
 * registro morava na home; ganhou tela própria pra não competir com a dieta.
 */
export function TreinoDoCliente({
  token,
  treino,
  aderenciaSemana,
  sessoes,
  corridas,
}: TreinoDoClienteDados & { token: string; corridas: CorridasDados }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function registrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await registrarTreino({
        token,
        clientLogId: crypto.randomUUID(),
        rawText: texto,
        origem: "TEXTO",
      });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setTexto("");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-6">
      <h1 className="font-display text-2xl">Seu treino</h1>
      {aderenciaSemana && (
        <p className="mt-2 text-sm text-ink-soft">
          Esta semana:{" "}
          <span className="text-treino">
            {aderenciaSemana.diasTreinados} de {aderenciaSemana.diasPorSemana} dias
          </span>
        </p>
      )}

      {treino ? (
        <div className="paper-card mt-6 rounded-sm p-4">
          <p className="font-display text-sm">{treino.nome}</p>
          <p className="mt-1 text-sm text-ink-soft">{treino.descricao}</p>
          <p className="mt-2 text-xs text-ink-faint">Meta: {treino.diasPorSemana}x por semana</p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-attention">Seu personal ainda não prescreveu um treino.</p>
      )}

      <BlocoCorrida token={token} corridas={corridas} />

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Registrar treino</h2>
        <form onSubmit={registrar} className="paper-card flex flex-col gap-3 rounded-sm p-4">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="ex.: Treino A completo"
            className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
          {erro && <p className="text-sm text-urgent">{erro}</p>}
          <button
            type="submit"
            disabled={pendente || !texto.trim()}
            className="tatil self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
          >
            {pendente ? "Registrando…" : "Registrar treino"}
          </button>
        </form>
      </section>

      {sessoes.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">Últimos treinos</h2>
          <ul className="flex flex-col gap-3">
            {sessoes.map((s) => (
              <li key={s.id} className="paper-card rounded-sm p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">{s.entradaBruta}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-data text-xs text-ink-faint">
                      {s.dia} · {s.horario}
                    </span>
                    <button
                      type="button"
                      disabled={pendente}
                      aria-label={`Remover ${s.entradaBruta}`}
                      onClick={() => {
                        if (!window.confirm("Remover este treino? A aderência da semana é recalculada.")) return;
                        iniciarTransicao(async () => {
                          await removerSessaoTreino({ token, registroId: s.id });
                          router.refresh();
                        });
                      }}
                      className="tatil text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/**
 * Corrida: recordes pessoais + registrar (distância/tempo) + últimas
 * corridas. É o começo da gamificação — o "KOM contra você mesmo": ao bater
 * o próprio pace ou a maior distância, a tela comemora na hora.
 */
function BlocoCorrida({ token, corridas }: { token: string; corridas: CorridasDados }) {
  const router = useRouter();
  const [distancia, setDistancia] = useState("");
  const [tempo, setTempo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [recorde, setRecorde] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const { recordes, corridas: lista } = corridas;
  const km = (m: number) => (m / 1000).toFixed(1).replace(/\.0$/, "");

  function registrar(evento: React.FormEvent) {
    evento.preventDefault();
    const distanciaKm = Number(distancia.replace(",", "."));
    const duracaoMin = Number(tempo.replace(",", "."));
    if (!(distanciaKm > 0) || !(duracaoMin > 0)) {
      setErro("informe distância e tempo");
      return;
    }
    setErro(null);
    setRecorde(null);

    // Confere o recorde ANTES do refresh (os recordes atuais ainda são os antigos).
    const metros = Math.round(distanciaKm * 1000);
    const pace = paceSegundosPorKm(metros, Math.round(duracaoMin * 60));
    const bateuPace =
      metros >= DISTANCIA_MINIMA_RECORDE_METROS && (recordes.melhorPaceSegKm === null || pace < recordes.melhorPaceSegKm);
    const bateuDistancia = metros > recordes.maiorDistanciaMetros;

    iniciarTransicao(async () => {
      const r = await registrarCorrida({ token, distanciaKm, duracaoMin });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setDistancia("");
      setTempo("");
      if (bateuPace) setRecorde(`🏆 Novo recorde de pace: ${formatarPace(pace)}!`);
      else if (bateuDistancia) setRecorde(`🏆 Nova maior distância: ${km(metros)} km!`);
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3 flex items-center gap-1.5">
        <Trophy size={13} strokeWidth={1.75} className="text-treino" /> Corrida
      </h2>

      {recordes.quantidade > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Recorde rotulo="Melhor pace" valor={recordes.melhorPaceSegKm ? formatarPace(recordes.melhorPaceSegKm) : "—"} />
          <Recorde rotulo="Maior distância" valor={`${km(recordes.maiorDistanciaMetros)} km`} />
          <Recorde rotulo="Total" valor={`${km(recordes.totalMetros)} km`} />
        </div>
      )}

      <form onSubmit={registrar} className="paper-card flex flex-col gap-3 rounded-sm p-4">
        <div className="flex gap-2">
          <label className="flex-1 text-sm">
            <span className="eyebrow mb-1 block">Distância (km)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              placeholder="ex.: 5"
              className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-treino"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="eyebrow mb-1 block">Tempo (min)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              placeholder="ex.: 25"
              className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-treino"
            />
          </label>
        </div>
        {erro && <p className="text-sm text-urgent">{erro}</p>}
        {recorde && <p className="text-sm font-medium text-treino">{recorde}</p>}
        <button
          type="submit"
          disabled={pendente || !distancia.trim() || !tempo.trim()}
          className="tatil self-start rounded-sm bg-treino px-4 py-2 text-sm font-medium text-treino-on shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {pendente ? "Registrando…" : "Registrar corrida"}
        </button>
      </form>

      {lista.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {lista.map((c) => (
            <li key={c.id} className="paper-card flex items-baseline justify-between gap-3 rounded-sm p-4">
              <div>
                <p className="text-sm">
                  <span className="font-data">{km(c.distanciaMetros)} km</span> em {formatarDuracao(c.duracaoSegundos)}
                </p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {formatarPace(c.paceSegKm)} · {c.dia}
                </p>
              </div>
              <button
                type="button"
                disabled={pendente}
                aria-label="Remover corrida"
                onClick={() => {
                  if (!window.confirm("Remover esta corrida?")) return;
                  iniciarTransicao(async () => {
                    await removerCorrida({ token, registroId: c.id });
                    router.refresh();
                  });
                }}
                className="tatil shrink-0 text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Recorde({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="paper-card rounded-sm px-2 py-2 text-center">
      <div className="font-data text-sm text-treino">{valor}</div>
      <div className="eyebrow mt-0.5 text-[0.6rem]">{rotulo}</div>
    </div>
  );
}
