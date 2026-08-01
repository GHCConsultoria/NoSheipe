"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { registrarTreino, removerSessaoTreino } from "@/lib/cliente/publico";
import type { TreinoDoClienteDados } from "@/lib/cliente/consultas";

/**
 * Aba Treino do cliente: o treino prescrito ativo, a aderência da semana e o
 * check-in de treino (texto livre, sem IA — ao contrário da refeição). O
 * registro morava na home; ganhou tela própria pra não competir com a dieta.
 */
export function TreinoDoCliente({ token, treino, aderenciaSemana, sessoes }: TreinoDoClienteDados & { token: string }) {
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
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="mb-3">
        <NoSheipeLogo size={24} />
      </div>
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
