"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reconhecimentoDeFalaDisponivel, useReconhecimentoDeFala } from "./useReconhecimentoDeFala";
import { NoSheipeLogo } from "./NoSheipeLogo";

interface RegistroExibicao {
  id: string;
  entradaBruta: string;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
  confianca: number;
  horario: string;
}

interface SaldoMacro {
  consumido: number;
  meta: number;
  percentual: number;
}

interface Saldo {
  kcal: SaldoMacro;
  proteina: SaldoMacro;
  carbo: SaldoMacro;
  gordura: SaldoMacro;
}

interface Props {
  token: string;
  nomePaciente: string;
  saldo: Saldo;
  registros: RegistroExibicao[];
}

export function RegistroPaciente({ token, nomePaciente, saldo, registros }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [origemAtual, setOrigemAtual] = useState<"TEXTO" | "AUDIO">("TEXTO");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [falaDisponivel, setFalaDisponivel] = useState(false);
  const { gravando, erro: erroFala, iniciar: iniciarGravacao, parar: pararGravacao } = useReconhecimentoDeFala();

  useEffect(() => {
    setFalaDisponivel(reconhecimentoDeFalaDisponivel());
  }, []);

  function alternarGravacao() {
    if (gravando) {
      pararGravacao();
      return;
    }
    iniciarGravacao((transcricao) => {
      if (transcricao) {
        setTexto(transcricao);
        setOrigemAtual("AUDIO");
      }
    });
  }

  function registrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    const clientLogId = crypto.randomUUID();
    const origemEnviada = origemAtual;
    iniciarTransicao(async () => {
      const resposta = await fetch("/api/nutri/registros", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientLogId, rawText: texto, origem: origemEnviada }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setErro(dados.erro ?? "falha ao registrar — tente de novo");
        return;
      }
      setTexto("");
      setOrigemAtual("TEXTO");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="mb-3">
        <NoSheipeLogo size={24} />
      </div>
      <h1 className="font-display text-2xl">Olá, {nomePaciente}</h1>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <CartaoMacro rotulo="kcal" saldo={saldo.kcal} />
        <CartaoMacro rotulo="Proteína (g)" saldo={saldo.proteina} />
        <CartaoMacro rotulo="Carbo (g)" saldo={saldo.carbo} />
        <CartaoMacro rotulo="Gordura (g)" saldo={saldo.gordura} />
      </section>

      <form onSubmit={registrar} className="paper-card mt-8 flex flex-col gap-3 rounded-sm p-4">
        <label className="text-sm">
          <span className="eyebrow mb-1.5 block">O que você comeu?</span>
          <textarea
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              setOrigemAtual("TEXTO");
            }}
            rows={3}
            placeholder="ex.: 150g de peito de frango grelhado com arroz e salada"
            className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
        </label>

        {falaDisponivel && (
          <button
            type="button"
            onClick={alternarGravacao}
            className={`self-start rounded-sm border px-3 py-1.5 text-xs transition-colors ${
              gravando
                ? "border-urgent-line text-urgent"
                : "border-rule text-ink-soft hover:border-sheipe hover:text-ink"
            }`}
          >
            {gravando ? "⏹ Parar gravação" : "🎙️ Gravar áudio"}
          </button>
        )}
        {erroFala && <p className="text-sm text-urgent">{erroFala}</p>}
        {erro && <p className="text-sm text-urgent">{erro}</p>}

        <button
          type="submit"
          disabled={pendente || gravando || !texto.trim()}
          className="self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Estimando macros…" : "Registrar"}
        </button>
      </form>

      <section className="mt-8">
        <h2 className="eyebrow mb-3">Hoje</h2>
        {registros.length === 0 && <p className="text-sm text-ink-faint">Nenhum registro ainda hoje.</p>}
        <ul className="flex flex-col gap-3">
          {registros.map((registro) => (
            <li key={registro.id} className="paper-card rounded-sm p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm">{registro.entradaBruta}</p>
                <span className="font-data shrink-0 text-xs text-ink-faint">{registro.horario}</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {registro.kcal} kcal · {registro.proteina}g P · {registro.carbo}g C · {registro.gordura}g G ·{" "}
                <span className="text-attention">estimativa ({Math.round(registro.confianca * 100)}%)</span>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function CartaoMacro({ rotulo, saldo }: { rotulo: string; saldo: SaldoMacro }) {
  const estourou = saldo.percentual > 100;
  return (
    <div className="paper-card rounded-sm p-3">
      <p className="eyebrow mb-1">{rotulo}</p>
      <p className="font-display text-xl">
        {saldo.consumido}
        <span className="text-sm text-ink-faint"> / {saldo.meta}</span>
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div
          className={`h-full ${estourou ? "bg-urgent" : "bg-sheipe"}`}
          style={{ width: `${Math.min(saldo.percentual, 100)}%` }}
        />
      </div>
    </div>
  );
}
