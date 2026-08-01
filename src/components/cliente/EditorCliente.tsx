"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  adicionarAnotacao,
  arquivarCliente,
  atualizarMetas,
  atualizarTreino,
  cutucarCliente,
  enviarRecado,
  gerarRelatorio,
  regenerarToken,
  removerTemplate,
  salvarTemplateNutricao,
  salvarTemplateTreino,
} from "@/lib/cliente/acoes";
import { GraficoLinha } from "@/components/shared/GraficoLinha";

interface Props {
  clienteId: string;
  tokenInicial: string;
  codigoConvite: string;
  acompanhaNutricao: boolean;
  acompanhaTreino: boolean;
  metasIniciais: { metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number } | null;
  treinoInicial: { nome: string; descricao: string; diasPorSemana: number } | null;
  anotacoes: { id: string; texto: string; criadoEm: string }[];
  recados: { id: string; texto: string; criadoEm: string; lido: boolean }[];
  pesos: { valor: number; rotulo: string }[];
  templatesNutricao: { id: string; nome: string; metaKcal: number; metaProteina: number; metaCarbo: number; metaGordura: number }[];
  templatesTreino: { id: string; nome: string; descricao: string; diasPorSemana: number }[];
}

export function EditorCliente({
  clienteId,
  tokenInicial,
  codigoConvite,
  acompanhaNutricao,
  acompanhaTreino,
  metasIniciais,
  treinoInicial,
  anotacoes,
  recados,
  pesos,
  templatesNutricao,
  templatesTreino,
}: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [token, setToken] = useState(tokenInicial);
  const [origem, setOrigem] = useState("");

  const [metas, setMetas] = useState({
    metaKcal: String(metasIniciais?.metaKcal ?? ""),
    metaProteina: String(metasIniciais?.metaProteina ?? ""),
    metaCarbo: String(metasIniciais?.metaCarbo ?? ""),
    metaGordura: String(metasIniciais?.metaGordura ?? ""),
  });
  const [treino, setTreino] = useState({
    nome: treinoInicial?.nome ?? "",
    descricao: treinoInicial?.descricao ?? "",
    diasPorSemana: String(treinoInicial?.diasPorSemana ?? 3),
  });
  const [novaAnotacao, setNovaAnotacao] = useState("");
  const [novoRecado, setNovoRecado] = useState("");
  const [relatorio, setRelatorio] = useState<string | null>(null);

  useEffect(() => {
    setOrigem(window.location.origin);
  }, []);

  function executar(acao: () => Promise<{ sucesso: boolean; erro?: string }>, mensagem: string) {
    setErro(null);
    setSalvo(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.sucesso) {
        setErro(resultado.erro ?? "não deu certo");
        return;
      }
      setSalvo(mensagem);
      router.refresh();
    });
  }

  function arquivar() {
    if (!window.confirm("Encerrar o acompanhamento deste cliente? Nada é excluído.")) return;
    iniciarTransicao(async () => {
      const resultado = await arquivarCliente({ clienteId });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.push("/pro");
      router.refresh();
    });
  }

  const link = origem ? `${origem}/p/${token}` : `/p/${token}`;

  return (
    <div className="flex flex-col gap-6">
      <section className="paper-card rounded-sm p-6">
        <h2 className="eyebrow mb-4">Link do cliente</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="font-data flex-1 rounded-sm border border-rule bg-paper px-3 py-2 text-xs break-all">
            {link}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(link)}
              className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
            >
              Copiar
            </button>
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                executar(async () => {
                  const r = await regenerarToken({ clienteId });
                  if (r.sucesso) setToken(r.token);
                  return r;
                }, "Link novo gerado.")
              }
              className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-urgent-line hover:text-urgent disabled:opacity-50"
            >
              Revogar e gerar novo
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Código de convite: <span className="font-data text-ink-soft">{codigoConvite}</span> — o cliente passa esse
          código pra outro profissional pedir acompanhamento.
        </p>
      </section>

      {acompanhaNutricao && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => atualizarMetas({ clienteId, ...metas }), "Metas atualizadas.");
          }}
          className="paper-card grid grid-cols-1 gap-4 rounded-sm p-6 sm:grid-cols-2"
        >
          <h2 className="eyebrow sm:col-span-2">Metas diárias</h2>
          <div className="sm:col-span-2">
            <TemplatesBar
              templates={templatesNutricao.map((t) => ({ id: t.id, nome: t.nome }))}
              aoAplicar={(id) => {
                const t = templatesNutricao.find((x) => x.id === id);
                if (t)
                  setMetas({
                    metaKcal: String(t.metaKcal),
                    metaProteina: String(t.metaProteina),
                    metaCarbo: String(t.metaCarbo),
                    metaGordura: String(t.metaGordura),
                  });
              }}
              aoSalvar={() => {
                const nome = window.prompt("Nome do template de dieta:");
                if (!nome?.trim()) return;
                executar(() => salvarTemplateNutricao({ nome, metas }), "Template salvo.");
              }}
              aoRemover={(id) => executar(() => removerTemplate({ templateId: id }), "Template removido.")}
              pendente={pendente}
            />
          </div>
          <Campo rotulo="Meta kcal" valor={metas.metaKcal} aoMudar={(v) => setMetas((m) => ({ ...m, metaKcal: v }))} />
          <Campo
            rotulo="Proteína (g)"
            valor={metas.metaProteina}
            aoMudar={(v) => setMetas((m) => ({ ...m, metaProteina: v }))}
          />
          <Campo rotulo="Carbo (g)" valor={metas.metaCarbo} aoMudar={(v) => setMetas((m) => ({ ...m, metaCarbo: v }))} />
          <Campo
            rotulo="Gordura (g)"
            valor={metas.metaGordura}
            aoMudar={(v) => setMetas((m) => ({ ...m, metaGordura: v }))}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pendente}
              className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
            >
              {pendente ? "Salvando…" : "Salvar metas"}
            </button>
          </div>
        </form>
      )}

      {acompanhaTreino && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executar(() => atualizarTreino({ clienteId, ...treino }), "Treino atualizado.");
          }}
          className="paper-card flex flex-col gap-4 rounded-sm p-6"
        >
          <h2 className="eyebrow">Treino prescrito</h2>
          <TemplatesBar
            templates={templatesTreino.map((t) => ({ id: t.id, nome: t.nome }))}
            aoAplicar={(id) => {
              const t = templatesTreino.find((x) => x.id === id);
              if (t) setTreino((atual) => ({ ...atual, descricao: t.descricao, diasPorSemana: String(t.diasPorSemana) }));
            }}
            aoSalvar={() => {
              const nome = window.prompt("Nome do template de treino:");
              if (!nome?.trim()) return;
              executar(() => salvarTemplateTreino({ nome, treino }), "Template salvo.");
            }}
            aoRemover={(id) => executar(() => removerTemplate({ templateId: id }), "Template removido.")}
            pendente={pendente}
          />
          <label className="text-sm">
            <span className="eyebrow mb-1.5 block">Nome</span>
            <input
              type="text"
              required
              value={treino.nome}
              onChange={(e) => setTreino((t) => ({ ...t, nome: e.target.value }))}
              className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
            />
          </label>
          <label className="text-sm">
            <span className="eyebrow mb-1.5 block">Exercícios</span>
            <textarea
              required
              rows={4}
              value={treino.descricao}
              onChange={(e) => setTreino((t) => ({ ...t, descricao: e.target.value }))}
              className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
            />
          </label>
          <Campo
            rotulo="Dias por semana"
            valor={treino.diasPorSemana}
            aoMudar={(v) => setTreino((t) => ({ ...t, diasPorSemana: v }))}
          />
          <div>
            <button
              type="submit"
              disabled={pendente}
              className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
            >
              {pendente ? "Salvando…" : treinoInicial ? "Atualizar treino" : "Prescrever treino"}
            </button>
          </div>
        </form>
      )}

      {pesos.length >= 2 && (
        <section className="paper-card rounded-sm p-6">
          <h2 className="eyebrow mb-4">Evolução de peso</h2>
          <GraficoLinha pontos={pesos} sufixo=" kg" />
        </section>
      )}

      <section className="paper-card flex flex-col gap-3 rounded-sm p-6">
        <h2 className="eyebrow">Relatório de evolução (IA)</h2>
        <p className="-mt-2 text-xs text-ink-faint">
          Resumo automático a partir do peso e do comparativo de semanas. Você revisa antes de usar — a IA não inventa
          dado.
        </p>
        <div>
          <button
            type="button"
            disabled={pendente}
            onClick={() => {
              setErro(null);
              setSalvo(null);
              setRelatorio(null);
              iniciarTransicao(async () => {
                const r = await gerarRelatorio({ clienteId });
                if (!r.sucesso) {
                  setErro(r.erro);
                  return;
                }
                setRelatorio(r.texto);
              });
            }}
            className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
          >
            {pendente ? "Gerando…" : "Gerar relatório"}
          </button>
        </div>
        {relatorio && (
          <div className="rounded-sm border border-rule bg-paper p-3">
            <p className="text-sm whitespace-pre-wrap">{relatorio}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(relatorio)}
              className="mt-2 text-xs text-ink-faint underline underline-offset-2 transition-colors hover:text-sheipe"
            >
              Copiar
            </button>
          </div>
        )}
      </section>

      <section className="paper-card flex flex-col gap-4 rounded-sm p-6">
        <h2 className="eyebrow">Recado pro cliente</h2>
        <p className="-mt-2 text-xs text-ink-faint">Aparece na home do cliente — ele vê quem mandou.</p>
        <textarea
          rows={2}
          value={novoRecado}
          onChange={(e) => setNovoRecado(e.target.value)}
          placeholder="Ex.: caprichou essa semana, bora manter!"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pendente || !novoRecado.trim()}
            onClick={() =>
              executar(async () => {
                const r = await enviarRecado({ clienteId, texto: novoRecado });
                if (r.sucesso) setNovoRecado("");
                return r;
              }, "Recado enviado.")
            }
            className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
          >
            Enviar recado
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => executar(() => cutucarCliente({ clienteId }), "Cutucada enviada.")}
            className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
            title="Envia um lembrete push pro aparelho do cliente, sem texto"
          >
            Cutucar (lembrete push)
          </button>
        </div>
        {recados.length > 0 && (
          <ul className="flex flex-col gap-3">
            {recados.map((r) => (
              <li key={r.id} className="rounded-sm border border-rule p-3">
                <p className="text-sm">{r.texto}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {r.criadoEm} · {r.lido ? "lido" : "não lido"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="paper-card flex flex-col gap-4 rounded-sm p-6">
        <h2 className="eyebrow">Anotações</h2>
        <p className="-mt-2 text-xs text-ink-faint">Só você vê — outros profissionais do mesmo cliente não.</p>
        <textarea
          rows={3}
          value={novaAnotacao}
          onChange={(e) => setNovaAnotacao(e.target.value)}
          placeholder="Observação de consulta…"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        <div>
          <button
            type="button"
            disabled={pendente || !novaAnotacao.trim()}
            onClick={() =>
              executar(async () => {
                const r = await adicionarAnotacao({ clienteId, texto: novaAnotacao });
                if (r.sucesso) setNovaAnotacao("");
                return r;
              }, "Anotação adicionada.")
            }
            className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
          >
            Adicionar anotação
          </button>
        </div>
        {anotacoes.length > 0 && (
          <ul className="flex flex-col gap-3">
            {anotacoes.map((a) => (
              <li key={a.id} className="rounded-sm border border-rule p-3">
                <p className="text-sm">{a.texto}</p>
                <p className="mt-1 text-xs text-ink-faint">{a.criadoEm}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {erro && <p className="text-sm text-urgent">{erro}</p>}
      {salvo && !erro && <p className="text-sm text-calm">{salvo}</p>}

      <button
        type="button"
        onClick={arquivar}
        disabled={pendente}
        className="self-start text-sm text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
      >
        Encerrar acompanhamento
      </button>
    </div>
  );
}

/**
 * Barra de templates de um formulário: aplicar (preenche os campos, não
 * salva — a prescrição de verdade continua sendo o Salvar do form) e
 * guardar os valores atuais como template novo. Cada chip aplica ao clicar
 * e some com o "x".
 */
function TemplatesBar({
  templates,
  aoAplicar,
  aoSalvar,
  aoRemover,
  pendente,
}: {
  templates: { id: string; nome: string }[];
  aoAplicar: (id: string) => void;
  aoSalvar: () => void;
  aoRemover: (id: string) => void;
  pendente: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {templates.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full border border-rule px-2.5 py-1 text-xs text-ink-soft"
        >
          <button type="button" onClick={() => aoAplicar(t.id)} className="hover:text-sheipe" disabled={pendente}>
            {t.nome}
          </button>
          <button
            type="button"
            aria-label={`Remover template ${t.nome}`}
            onClick={() => aoRemover(t.id)}
            disabled={pendente}
            className="text-ink-faint hover:text-urgent"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={aoSalvar}
        disabled={pendente}
        className="rounded-full border border-dashed border-rule px-2.5 py-1 text-xs text-ink-faint transition-colors hover:border-sheipe hover:text-sheipe disabled:opacity-50"
      >
        + salvar como template
      </button>
    </div>
  );
}

function Campo({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">{rotulo}</span>
      <input
        type="number"
        required
        min={0}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
      />
    </label>
  );
}
