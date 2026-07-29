"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Mic, Square } from "lucide-react";
import { reconhecimentoDeFalaDisponivel, useReconhecimentoDeFala } from "@/components/shared/useReconhecimentoDeFala";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

interface RegistroExibicao {
  id: string;
  entradaBruta: string;
  horario: string;
}

interface TreinoAtivo {
  nome: string;
  descricao: string;
  diasPorSemana: number;
}

interface Props {
  token: string;
  nomeAluno: string;
  treinoAtivo: TreinoAtivo | null;
  registros: RegistroExibicao[];
}

export function RegistroTreino({ token, nomeAluno, treinoAtivo, registros }: Props) {
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
      const resposta = await fetch("/api/personal/registros", {
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
      <h1 className="font-display text-2xl">Olá, {nomeAluno}</h1>

      {treinoAtivo ? (
        <section className="paper-card mt-6 rounded-sm p-4">
          <h2 className="eyebrow mb-2">{treinoAtivo.nome}</h2>
          <p className="text-sm text-ink-soft">{treinoAtivo.descricao}</p>
          <p className="mt-2 text-xs text-ink-faint">Meta: {treinoAtivo.diasPorSemana}x por semana</p>
        </section>
      ) : (
        <p className="mt-6 text-sm text-ink-faint">Seu personal ainda não prescreveu um treino.</p>
      )}

      <form onSubmit={registrar} className="paper-card mt-6 flex flex-col gap-3 rounded-sm p-4">
        <label className="text-sm">
          <span className="eyebrow mb-1.5 block">O que você treinou?</span>
          <textarea
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              setOrigemAtual("TEXTO");
            }}
            rows={3}
            placeholder="ex.: Treino A completo — agachamento, leg press e cadeira extensora"
            className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
          />
        </label>

        {falaDisponivel && (
          <button
            type="button"
            onClick={alternarGravacao}
            className={`inline-flex items-center gap-1.5 self-start rounded-sm border px-3 py-1.5 text-xs transition-colors ${
              gravando
                ? "border-urgent-line text-urgent"
                : "border-rule text-ink-soft hover:border-sheipe hover:text-ink"
            }`}
          >
            {gravando ? (
              <>
                <Square size={13} strokeWidth={2} fill="currentColor" /> Parar gravação
              </>
            ) : (
              <>
                <Mic size={13} strokeWidth={1.75} /> Gravar áudio
              </>
            )}
          </button>
        )}
        {erroFala && <p className="text-sm text-urgent">{erroFala}</p>}
        {erro && <p className="text-sm text-urgent">{erro}</p>}

        <button
          type="submit"
          disabled={pendente || gravando || !texto.trim()}
          className="self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Registrando…" : "Registrar"}
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
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
