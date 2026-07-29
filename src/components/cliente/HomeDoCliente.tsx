"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Mic, Square, X } from "lucide-react";
import { reconhecimentoDeFalaDisponivel, useReconhecimentoDeFala } from "@/components/shared/useReconhecimentoDeFala";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { CompartilharResumoDoDia } from "@/components/nutri/CompartilharResumoDoDia";
import { registrarPeso, registrarTreino, removerFavorito, salvarFavorito } from "@/lib/cliente/publico";
import { MeusProfissionais, SolicitacoesPendentes } from "@/components/cliente/MeusProfissionais";

interface SaldoMacro {
  consumido: number;
  meta: number;
  percentual: number;
}

interface Vinculo {
  id: string;
  tipo: "NUTRICAO" | "TREINO";
  profissionalNome: string;
}

interface Props {
  token: string;
  nome: string;
  codigoConvite: string;
  vinculosAtivos: Vinculo[];
  solicitacoes: Vinculo[];
  nutricao: {
    saldo: { kcal: SaldoMacro; proteina: SaldoMacro; carbo: SaldoMacro; gordura: SaldoMacro };
    registrosHoje: {
      id: string;
      entradaBruta: string;
      kcal: number;
      proteina: number;
      carbo: number;
      gordura: number;
      confianca: number;
      horario: string;
    }[];
    favoritos: { id: string; descricao: string }[];
    ultimoPesoKg: number | null;
  } | null;
  treino: {
    treino: { nome: string; descricao: string; diasPorSemana: number } | null;
    aderenciaSemana: { diasTreinados: number; diasPorSemana: number; percentual: number } | null;
    sessoesHoje: { id: string; entradaBruta: string; horario: string }[];
  } | null;
}

/**
 * A home do cliente abre no PROGRESSO, não num formulário: a primeira coisa
 * na tela é quanto da meta do dia já foi batida, em dieta e em treino. Os
 * campos de registro vêm depois.
 *
 * Cada bloco só aparece se existir o profissional correspondente — quem só
 * tem nutricionista nunca vê nada de treino.
 */
export function HomeDoCliente({
  token,
  nome,
  codigoConvite,
  vinculosAtivos,
  solicitacoes,
  nutricao,
  treino,
}: Props) {
  const semAcompanhamento = !nutricao && !treino;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="mb-3">
        <NoSheipeLogo size={24} />
      </div>
      <h1 className="font-display text-2xl">Olá, {nome}</h1>

      {/* Antes do progresso: quem está esperando resposta dele. Aparece
          inclusive pra quem ainda não tem nenhum profissional — é
          justamente quem mais recebe solicitação. */}
      <SolicitacoesPendentes token={token} solicitacoes={solicitacoes} />

      {semAcompanhamento ? (
        <p className="mt-6 text-sm text-ink-soft">
          Você ainda não tem nenhum profissional acompanhando. Passe o código abaixo pro seu nutricionista ou personal
          — assim que você aceitar o pedido dele, seu progresso aparece aqui.
        </p>
      ) : (
        <>
          <section className="mt-6 flex flex-col gap-3">
            {nutricao && <ResumoDieta saldo={nutricao.saldo} />}
            {treino && <ResumoTreino aderencia={treino.aderenciaSemana} nome={treino.treino?.nome ?? null} />}
          </section>

          {nutricao && (
            <div className="mt-4">
              <CompartilharResumoDoDia nomePaciente={nome} saldo={nutricao.saldo} />
            </div>
          )}

          {nutricao && <BlocoRefeicao token={token} favoritos={nutricao.favoritos} registros={nutricao.registrosHoje} />}
          {treino && <BlocoTreino token={token} treino={treino.treino} sessoes={treino.sessoesHoje} />}
          {nutricao && <BlocoPeso token={token} ultimoPesoKg={nutricao.ultimoPesoKg} />}

          {nutricao && (
            <div className="mt-6">
              <Link href={`/p/${token}/historico`} className="text-sm text-ink-soft hover:text-sheipe">
                ver histórico →
              </Link>
            </div>
          )}
        </>
      )}

      <MeusProfissionais token={token} codigoConvite={codigoConvite} ativos={vinculosAtivos} />
    </main>
  );
}

interface Saldo {
  kcal: SaldoMacro;
  proteina: SaldoMacro;
  carbo: SaldoMacro;
  gordura: SaldoMacro;
}

function ResumoDieta({ saldo }: { saldo: Saldo }) {
  const estourou = saldo.kcal.percentual > 100;
  return (
    <div className="paper-card rounded-sm p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Dieta hoje</p>
        <p className={`font-display text-2xl ${estourou ? "text-urgent" : ""}`}>{saldo.kcal.percentual}%</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div
          className={`h-full ${estourou ? "bg-urgent" : "bg-sheipe"}`}
          style={{ width: `${Math.min(saldo.kcal.percentual, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {saldo.kcal.consumido} / {saldo.kcal.meta} kcal · {saldo.proteina.consumido}g P · {saldo.carbo.consumido}g C ·{" "}
        {saldo.gordura.consumido}g G
      </p>
    </div>
  );
}

function ResumoTreino({
  aderencia,
  nome,
}: {
  aderencia: { diasTreinados: number; diasPorSemana: number; percentual: number } | null;
  nome: string | null;
}) {
  if (!aderencia) {
    return (
      <div className="paper-card rounded-sm p-4">
        <p className="eyebrow">Treino</p>
        <p className="mt-1 text-sm text-attention">Seu personal ainda não prescreveu um treino.</p>
      </div>
    );
  }
  return (
    <div className="paper-card rounded-sm p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Treino na semana</p>
        <p className="font-display text-2xl">{aderencia.percentual}%</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div className="h-full bg-sheipe" style={{ width: `${Math.min(aderencia.percentual, 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {aderencia.diasTreinados} de {aderencia.diasPorSemana} dias{nome ? ` · ${nome}` : ""}
      </p>
    </div>
  );
}

function BlocoRefeicao({
  token,
  favoritos,
  registros,
}: {
  token: string;
  favoritos: { id: string; descricao: string }[];
  registros: NonNullable<Props["nutricao"]>["registrosHoje"];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [origemAtual, setOrigemAtual] = useState<"TEXTO" | "AUDIO">("TEXTO");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [falaDisponivel, setFalaDisponivel] = useState(false);
  const { gravando, erro: erroFala, iniciar, parar } = useReconhecimentoDeFala();

  useEffect(() => setFalaDisponivel(reconhecimentoDeFalaDisponivel()), []);

  function registrar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    const clientLogId = crypto.randomUUID();
    const origemEnviada = origemAtual;
    iniciarTransicao(async () => {
      const resposta = await fetch("/api/cliente/refeicoes", {
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
    <section className="mt-8">
      <h2 className="eyebrow mb-3">O que você comeu</h2>

      {favoritos.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {favoritos.map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-1 text-xs text-ink-soft"
            >
              <button type="button" onClick={() => setTexto(f.descricao)} className="hover:text-sheipe">
                {f.descricao}
              </button>
              <button
                type="button"
                aria-label={`Remover ${f.descricao}`}
                onClick={() =>
                  iniciarTransicao(async () => {
                    await removerFavorito({ token, favoritoId: f.id });
                    router.refresh();
                  })
                }
                className="text-ink-faint hover:text-urgent"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={registrar} className="paper-card flex flex-col gap-3 rounded-sm p-4">
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setOrigemAtual("TEXTO");
          }}
          rows={3}
          placeholder="ex.: 150g de peito de frango grelhado com arroz e salada"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />

        <div className="flex flex-wrap gap-2">
          {falaDisponivel && (
            <button
              type="button"
              onClick={() =>
                gravando
                  ? parar()
                  : iniciar((t) => {
                      if (t) {
                        setTexto(t);
                        setOrigemAtual("AUDIO");
                      }
                    })
              }
              className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs transition-colors ${
                gravando ? "border-urgent-line text-urgent" : "border-rule text-ink-soft hover:border-sheipe hover:text-ink"
              }`}
            >
              {gravando ? (
                <>
                  <Square size={13} strokeWidth={2} fill="currentColor" /> Parar
                </>
              ) : (
                <>
                  <Mic size={13} strokeWidth={1.75} /> Gravar áudio
                </>
              )}
            </button>
          )}
          {texto.trim() && (
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                iniciarTransicao(async () => {
                  await salvarFavorito({ token, descricao: texto });
                  router.refresh();
                })
              }
              className="rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
            >
              Salvar como frequente
            </button>
          )}
        </div>

        {erroFala && <p className="text-sm text-urgent">{erroFala}</p>}
        {erro && <p className="text-sm text-urgent">{erro}</p>}

        <button
          type="submit"
          disabled={pendente || gravando || !texto.trim()}
          className="self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Estimando macros…" : "Registrar refeição"}
        </button>
      </form>

      {registros.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {registros.map((r) => (
            <li key={r.id} className="paper-card rounded-sm p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm">{r.entradaBruta}</p>
                <span className="font-data shrink-0 text-xs text-ink-faint">{r.horario}</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {r.kcal} kcal · {r.proteina}g P · {r.carbo}g C · {r.gordura}g G ·{" "}
                <span className="text-attention">estimativa ({Math.round(r.confianca * 100)}%)</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BlocoTreino({
  token,
  treino,
  sessoes,
}: {
  token: string;
  treino: { nome: string; descricao: string; diasPorSemana: number } | null;
  sessoes: { id: string; entradaBruta: string; horario: string }[];
}) {
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
    <section className="mt-8">
      <h2 className="eyebrow mb-3">Seu treino</h2>

      {treino && (
        <div className="paper-card mb-3 rounded-sm p-4">
          <p className="font-display text-sm">{treino.nome}</p>
          <p className="mt-1 text-sm text-ink-soft">{treino.descricao}</p>
          <p className="mt-2 text-xs text-ink-faint">Meta: {treino.diasPorSemana}x por semana</p>
        </div>
      )}

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
          className="self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Registrando…" : "Registrar treino"}
        </button>
      </form>

      {sessoes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {sessoes.map((s) => (
            <li key={s.id} className="paper-card rounded-sm p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm">{s.entradaBruta}</p>
                <span className="font-data shrink-0 text-xs text-ink-faint">{s.horario}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BlocoPeso({ token, ultimoPesoKg }: { token: string; ultimoPesoKg: number | null }) {
  const router = useRouter();
  const [peso, setPeso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <section className="paper-card mt-8 rounded-sm p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Peso</h2>
        {ultimoPesoKg !== null && <span className="text-xs text-ink-faint">último: {ultimoPesoKg} kg</span>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!peso.trim()) return;
          setErro(null);
          iniciarTransicao(async () => {
            const resultado = await registrarPeso({ token, pesoKg: peso });
            if (!resultado.sucesso) {
              setErro(resultado.erro);
              return;
            }
            setPeso("");
            router.refresh();
          });
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="number"
          step="0.1"
          min="0"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          placeholder="ex.: 72.5"
          className="flex-1 rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        <button
          type="submit"
          disabled={pendente || !peso.trim()}
          className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
        >
          Registrar
        </button>
      </form>
      {erro && <p className="mt-2 text-sm text-urgent">{erro}</p>}
    </section>
  );
}
