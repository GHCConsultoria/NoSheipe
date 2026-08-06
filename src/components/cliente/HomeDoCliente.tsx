"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, MessageCircle, Mic, Square, X } from "lucide-react";
import { reconhecimentoDeFalaDisponivel, useReconhecimentoDeFala } from "@/components/shared/useReconhecimentoDeFala";
import {
  ajustarRefeicao,
  estimarRefeicao,
  marcarRecadosLidos,
  registrarPeso,
  removerFavorito,
  removerRefeicao,
  salvarFavorito,
} from "@/lib/cliente/publico";
import { AnelDoDia } from "@/components/cliente/AnelDoDia";
import { ChamaDaSemana, LegendasDoDia, MacrosDoDia } from "@/components/cliente/PainelDoDia";
import { GraficoPeso } from "@/components/cliente/GraficoPeso";
import { GerenciarPush } from "@/components/cliente/GerenciarPush";

interface SaldoMacro {
  consumido: number;
  meta: number;
  percentual: number;
}

/**
 * Reduz a foto no próprio celular antes de subir: redimensiona pro maior
 * lado caber em 1024px e re-encoda em JPEG. Economiza banda e mantém o
 * corpo bem abaixo do teto do servidor — a foto de câmera vem com vários MB.
 */
async function fotoParaBase64(file: File): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  ctx.drawImage(bitmap, 0, 0, largura, altura);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mediaType: "image/jpeg" };
}

interface Props {
  token: string;
  nome: string;
  /** Quantos pedidos esperam resposta — só pra apontar o caminho ao Perfil. */
  solicitacoesPendentes: number;
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
      macrosPendentes: boolean;
      ajustadoManualmente: boolean;
      horario: string;
    }[];
    favoritos: { id: string; descricao: string }[];
    ultimoPesoKg: number | null;
    pesoSerie: { valor: number; rotulo: string; iso: string }[];
  } | null;
  treino: {
    treino: { nome: string; descricao: string; diasPorSemana: number } | null;
    aderenciaSemana: { diasTreinados: number; diasPorSemana: number; percentual: number } | null;
    sessoesHoje: { id: string; entradaBruta: string; horario: string }[];
  } | null;
  hidratacao: { consumidoMl: number; metaMl: number; percentual: number; copoMl: number };
  ofensiva: { dias: number; ativaHoje: boolean };
  semana: { dias: boolean[]; hoje: number };
  recados: { id: string; texto: string; profissionalNome: string; quando: string; lido: boolean }[];
  /** Chave pública VAPID pro opt-in de lembretes; null se o push não está configurado. */
  chavePush: string | null;
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
  solicitacoesPendentes,
  nutricao,
  treino,
  hidratacao,
  ofensiva,
  semana,
  recados,
  chavePush,
}: Props) {
  const semAcompanhamento = !nutricao && !treino;
  const primeiroNome = nome.trim().split(/\s+/)[0];
  const semanasSeguidas = Math.floor(ofensiva.dias / 7);

  const agora = new Date();
  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(agora);
  const horaSP = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(agora),
  );
  const saudacao = horaSP < 12 ? "Bom dia" : horaSP < 18 ? "Boa tarde" : "Boa noite";

  return (
    <main className="mx-auto max-w-md px-6 pb-10 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.24em] text-ink-faint first-letter:uppercase">
            {dataHoje}
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-[1.06] tracking-tight">
            {saudacao},<br />
            <span className="text-ink-soft">{primeiroNome}.</span>
          </h1>
        </div>
        {semanasSeguidas >= 1 && (
          <span className="mt-1 shrink-0 rounded-full border border-treino/40 bg-treino/10 px-2.5 py-1 text-xs font-medium text-treino">
            🔥 {semanasSeguidas} {semanasSeguidas === 1 ? "semana" : "semanas"}
          </span>
        )}
      </div>

      {semAcompanhamento ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-sm text-ink-soft">
            {solicitacoesPendentes > 0
              ? "Tem profissional esperando sua resposta pra começar a te acompanhar."
              : "Você ainda não tem nenhum profissional acompanhando. Assim que tiver, seu progresso do dia aparece aqui."}
          </p>
          <Link
            href={`/p/${token}/perfil`}
            className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep"
          >
            {solicitacoesPendentes > 0 ? "Ver quem pediu" : "Pegar meu código"}
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <AnelDoDia
              treino={treino?.aderenciaSemana?.percentual ?? null}
              dieta={nutricao ? nutricao.saldo.kcal.percentual : null}
              total={comporTotalDoDia(nutricao, treino, hidratacao.percentual)}
            />
          </section>

          <LegendasDoDia
            token={token}
            agua={{
              consumidoMl: hidratacao.consumidoMl,
              metaMl: hidratacao.metaMl,
              percentual: hidratacao.percentual,
            }}
            dieta={
              nutricao
                ? {
                    consumido: nutricao.saldo.kcal.consumido,
                    meta: nutricao.saldo.kcal.meta,
                    percentual: nutricao.saldo.kcal.percentual,
                  }
                : null
            }
            treino={
              treino?.aderenciaSemana
                ? {
                    percentual: treino.aderenciaSemana.percentual,
                    diasTreinados: treino.aderenciaSemana.diasTreinados,
                    diasPorSemana: treino.aderenciaSemana.diasPorSemana,
                    feitoHoje: treino.sessoesHoje.length > 0,
                  }
                : null
            }
          />

          {nutricao && (
            <MacrosDoDia
              proteina={nutricao.saldo.proteina}
              carbo={nutricao.saldo.carbo}
              gordura={nutricao.saldo.gordura}
            />
          )}

          {treino && !treino.aderenciaSemana && (
            <p className="mt-4 text-center text-sm text-attention">Seu personal ainda não prescreveu um treino.</p>
          )}

          <ChamaDaSemana semana={semana} ofensiva={ofensiva} nome={nome} saldo={nutricao?.saldo ?? null} />

          {recados.length > 0 && <BlocoRecados token={token} recados={recados} />}

          <GerenciarPush token={token} chavePublica={chavePush} />

          {nutricao && <BlocoRefeicao token={token} favoritos={nutricao.favoritos} registros={nutricao.registrosHoje} />}
          {nutricao && (
            <BlocoPeso token={token} ultimoPesoKg={nutricao.ultimoPesoKg} pesoSerie={nutricao.pesoSerie} />
          )}
        </>
      )}
    </main>
  );
}

/**
 * O número grande do centro: a média das métricas que o cliente acompanha
 * (cada uma limitada a 100% pra uma não estourar a conta da outra). Água
 * conta sempre; dieta e treino entram conforme o vínculo — assim quem só
 * tem um lado ainda vê um "% do dia" honesto.
 */
function comporTotalDoDia(
  nutricao: Props["nutricao"],
  treino: Props["treino"],
  aguaPct: number,
): number {
  const partes: number[] = [Math.min(aguaPct, 100)];
  if (nutricao) partes.push(Math.min(nutricao.saldo.kcal.percentual, 100));
  if (treino?.aderenciaSemana) partes.push(Math.min(treino.aderenciaSemana.percentual, 100));
  return Math.round(partes.reduce((s, p) => s + p, 0) / partes.length);
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
  const fotoInputRef = useRef<HTMLInputElement>(null);

  function registrarPorFoto(file: File) {
    setErro(null);
    const clientLogId = crypto.randomUUID();
    iniciarTransicao(async () => {
      let img: { base64: string; mediaType: string };
      try {
        img = await fotoParaBase64(file);
      } catch {
        setErro("não consegui ler essa imagem — tente outra");
        return;
      }
      const resposta = await fetch("/api/cliente/refeicoes/foto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, clientLogId, imagemBase64: img.base64, mediaType: img.mediaType }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setErro(dados.erro ?? "falha ao registrar a foto — tente de novo");
        return;
      }
      router.refresh();
    });
  }

  // Ajuste manual dos macros: qual refeição está em edição e o rascunho dos
  // campos (string, porque vêm de <input>).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ kcal: "", proteina: "", carbo: "", gordura: "" });

  function abrirEdicao(r: (typeof registros)[number]) {
    setErro(null);
    setEditandoId(r.id);
    setRascunho({
      kcal: String(r.kcal),
      proteina: String(r.proteina),
      carbo: String(r.carbo),
      gordura: String(r.gordura),
    });
  }

  function salvarAjuste(registroId: string) {
    iniciarTransicao(async () => {
      const resultado = await ajustarRefeicao({ token, registroId, ...rascunho });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setEditandoId(null);
      router.refresh();
    });
  }

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
    <section id="registrar" className="mt-8 scroll-mt-6">
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
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Zera o value pra permitir reescolher a mesma foto depois.
              e.target.value = "";
              if (file) registrarPorFoto(file);
            }}
          />
          <button
            type="button"
            disabled={pendente}
            onClick={() => fotoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
          >
            <Camera size={13} strokeWidth={1.75} /> Foto do prato
          </button>
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
          className="tatil self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
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
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-data text-xs text-ink-faint">{r.horario}</span>
                  <button
                    type="button"
                    disabled={pendente}
                    aria-label={`Remover ${r.entradaBruta}`}
                    // A estimativa da IA vira o anel inteiro; um registro
                    // errado precisa de saída, senão envenena o número do dia.
                    onClick={() => {
                      if (!window.confirm("Remover este registro? O total do dia é recalculado.")) return;
                      iniciarTransicao(async () => {
                        await removerRefeicao({ token, registroId: r.id });
                        router.refresh();
                      });
                    }}
                    className="tatil text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              {editandoId === r.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        ["kcal", "kcal"],
                        ["proteina", "P (g)"],
                        ["carbo", "C (g)"],
                        ["gordura", "G (g)"],
                      ] as const
                    ).map(([campo, rotulo]) => (
                      <label key={campo} className="flex flex-col gap-0.5 text-[0.65rem] text-ink-faint">
                        {rotulo}
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={rascunho[campo]}
                          onChange={(e) => setRascunho((prev) => ({ ...prev, [campo]: e.target.value }))}
                          className="w-full rounded-sm border border-rule bg-paper px-2 py-1 text-sm outline-none focus:border-sheipe"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pendente}
                      onClick={() => salvarAjuste(r.id)}
                      className="tatil rounded-sm bg-sheipe px-3 py-1 text-xs font-medium text-sheipe-on transition-colors hover:bg-sheipe-deep disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(null);
                        setErro(null);
                      }}
                      className="tatil rounded-sm border border-rule px-3 py-1 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : r.macrosPendentes ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-attention">macros a estimar — a IA estava indisponível</span>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() =>
                      iniciarTransicao(async () => {
                        const resultado = await estimarRefeicao({ token, registroId: r.id });
                        if (!resultado.sucesso) setErro(resultado.erro);
                        router.refresh();
                      })
                    }
                    className="tatil rounded-sm border border-rule px-2 py-0.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
                  >
                    Estimar agora
                  </button>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => abrirEdicao(r)}
                    className="tatil rounded-sm border border-rule px-2 py-0.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
                  >
                    Ajustar na mão
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-xs text-ink-faint">
                    {r.kcal} kcal · {r.proteina}g P · {r.carbo}g C · {r.gordura}g G ·{" "}
                    <span className="text-attention">
                      {r.ajustadoManualmente ? "ajustado por você" : `estimativa (${Math.round(r.confianca * 100)}%)`}
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() => abrirEdicao(r)}
                    className="tatil text-xs text-ink-faint underline underline-offset-2 transition-colors hover:text-sheipe disabled:opacity-50"
                  >
                    ajustar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Recados do profissional. Ao abrir a home, os não-lidos viram lidos — o
 * profissional passa a ver que chegaram. É efeito de visualização, então
 * roda uma vez no mount e não mexe na tela (sem refresh, pra não piscar).
 */
function BlocoRecados({
  token,
  recados,
}: {
  token: string;
  recados: NonNullable<Props["recados"]>;
}) {
  const temNaoLido = recados.some((r) => !r.lido);

  useEffect(() => {
    if (temNaoLido) void marcarRecadosLidos({ token });
  }, [token, temNaoLido]);

  return (
    <section className="mt-6">
      <h2 className="eyebrow mb-3 flex items-center gap-1.5">
        <MessageCircle size={13} strokeWidth={1.75} /> Recados do seu time
      </h2>
      <ul className="flex flex-col gap-3">
        {recados.map((r) => (
          <li
            key={r.id}
            className={`paper-card rounded-sm p-4 ${!r.lido ? "border-l-2 border-l-sheipe" : ""}`}
          >
            <p className="text-sm">{r.texto}</p>
            <p className="mt-1.5 text-xs text-ink-faint">
              {r.profissionalNome} · {r.quando}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlocoPeso({
  token,
  ultimoPesoKg,
  pesoSerie,
}: {
  token: string;
  ultimoPesoKg: number | null;
  pesoSerie: { valor: number; rotulo: string; iso: string }[];
}) {
  const router = useRouter();
  const [peso, setPeso] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <section className="paper-card mt-8 rounded-sm p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="eyebrow">Evolução corporal</h2>
        {ultimoPesoKg !== null && <span className="text-xs text-ink-faint">último: {ultimoPesoKg} kg</span>}
      </div>

      {/* O gráfico só desenha com 2+ pontos no período; some sozinho no começo. */}
      {pesoSerie.length >= 2 && (
        <div className="mt-3">
          <GraficoPeso pontos={pesoSerie} />
        </div>
      )}
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
