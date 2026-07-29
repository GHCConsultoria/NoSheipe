"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Mic, Square, Star, X } from "lucide-react";
import { reconhecimentoDeFalaDisponivel, useReconhecimentoDeFala } from "@/components/shared/useReconhecimentoDeFala";
import { salvarFavorito, removerFavorito } from "@/lib/nutri/publico";
import { NoSheipeLogo } from "./NoSheipeLogo";
import { CompartilharResumoDoDia } from "./CompartilharResumoDoDia";
import { RegistroPeso } from "./RegistroPeso";

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

interface Favorito {
  id: string;
  descricao: string;
}

interface Props {
  token: string;
  nomePaciente: string;
  saldo: Saldo;
  registros: RegistroExibicao[];
  favoritos: Favorito[];
  pesoAtual: number | null;
}

export function RegistroPaciente({ token, nomePaciente, saldo, registros, favoritos, pesoAtual }: Props) {
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

  function favoritar() {
    if (!texto.trim()) return;
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await salvarFavorito({ token, descricao: texto });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  function desfavoritar(favoritoId: string) {
    iniciarTransicao(async () => {
      const resultado = await removerFavorito({ token, favoritoId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
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

      <div className="mt-4">
        <CompartilharResumoDoDia nomePaciente={nomePaciente} saldo={saldo} />
      </div>

      <form onSubmit={registrar} className="paper-card mt-8 flex flex-col gap-3 rounded-sm p-4">
        {favoritos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {favoritos.map((favorito) => (
              <span
                key={favorito.id}
                className="inline-flex items-center gap-1 rounded-full border border-rule py-1 pr-1 pl-2.5 text-xs text-ink-soft"
              >
                <button
                  type="button"
                  onClick={() => {
                    setTexto(favorito.descricao);
                    setOrigemAtual("TEXTO");
                  }}
                  className="transition-colors hover:text-ink"
                >
                  {favorito.descricao}
                </button>
                <button
                  type="button"
                  onClick={() => desfavoritar(favorito.id)}
                  aria-label={`Remover ${favorito.descricao} dos favoritos`}
                  className="rounded-full p-0.5 text-ink-faint transition-colors hover:text-urgent"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}

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

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pendente || gravando || !texto.trim()}
            className="rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
          >
            {pendente ? "Estimando macros…" : "Registrar"}
          </button>
          <button
            type="button"
            onClick={favoritar}
            disabled={pendente || !texto.trim()}
            title="Salvar como refeição frequente"
            className="inline-flex items-center gap-1.5 rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
          >
            <Star size={13} strokeWidth={1.75} /> Salvar
          </button>
        </div>
      </form>

      <div className="mt-4">
        <RegistroPeso token={token} pesoAtual={pesoAtual} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="eyebrow">Hoje</h2>
          <Link href={`/p/${token}/historico`} className="text-xs text-ink-soft transition-colors hover:text-sheipe">
            ver histórico
          </Link>
        </div>
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
