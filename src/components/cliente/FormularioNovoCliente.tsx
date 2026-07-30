"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarCliente } from "@/lib/cliente/acoes";

interface Props {
  podeNutricao: boolean;
  podeTreino: boolean;
}

const METAS_VAZIAS = { metaKcal: "", metaProteina: "", metaCarbo: "", metaGordura: "" };
const TREINO_VAZIO = { nome: "", descricao: "", diasPorSemana: "3" };

/**
 * Cadastro de cliente. O profissional escolhe o que vai acompanhar, e cada
 * escolha revela a prescrição + a anamnese daquele nicho — quem só faz
 * treino não precisa ver campo de meta de kcal.
 *
 * Toda a anamnese é opcional: dá pra cadastrar rápido e completar depois.
 */
export function FormularioNovoCliente({ podeNutricao, podeTreino }: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Se o profissional só faz uma coisa, já vem marcada — não faz sentido
  // pedir uma escolha que só tem uma opção.
  const [acompanhaNutricao, setAcompanhaNutricao] = useState(podeNutricao && !podeTreino);
  const [acompanhaTreino, setAcompanhaTreino] = useState(podeTreino && !podeNutricao);

  const [basico, setBasico] = useState({ nome: "", telefone: "" });
  const [comum, setComum] = useState({ dataNascimento: "", sexo: "", alturaCm: "", objetivo: "" });
  const [metas, setMetas] = useState(METAS_VAZIAS);
  const [treino, setTreino] = useState(TREINO_VAZIO);
  const [anamneseNutri, setAnamneseNutri] = useState({
    jaSeguiuDieta: false,
    restricoesAlimentares: "",
    usaSuplemento: false,
    refeicoesPorDia: "",
    consumoAlcool: "",
    observacoes: "",
  });
  const [anamneseTreino, setAnamneseTreino] = useState({
    experiencia: "",
    lesoesLimitacoes: "",
    frequenciaAtual: "",
    praticaOutroEsporte: "",
    observacoes: "",
  });

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await criarCliente({
        ...basico,
        ...comum,
        sexo: comum.sexo || undefined,
        acompanhaNutricao,
        acompanhaTreino,
        metas: acompanhaNutricao ? metas : undefined,
        treino: acompanhaTreino ? treino : undefined,
        anamneseNutricional: acompanhaNutricao
          ? { ...anamneseNutri, consumoAlcool: anamneseNutri.consumoAlcool || undefined }
          : undefined,
        anamneseTreino: acompanhaTreino
          ? { ...anamneseTreino, experiencia: anamneseTreino.experiencia || undefined }
          : undefined,
      });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.push("/pro");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <section className="paper-card flex flex-col gap-4 rounded-sm p-6">
        <h2 className="eyebrow">Dados básicos</h2>
        <Texto rotulo="Nome" obrigatorio valor={basico.nome} aoMudar={(v) => setBasico((b) => ({ ...b, nome: v }))} />
        <Texto rotulo="Telefone" valor={basico.telefone} aoMudar={(v) => setBasico((b) => ({ ...b, telefone: v }))} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Data de nascimento, não idade: idade envelhece sozinha e vira dado errado. */}
          <Texto
            rotulo="Data de nascimento"
            tipo="date"
            valor={comum.dataNascimento}
            aoMudar={(v) => setComum((c) => ({ ...c, dataNascimento: v }))}
          />
          <Selecao
            rotulo="Sexo"
            valor={comum.sexo}
            opcoes={[
              ["", "—"],
              ["F", "Feminino"],
              ["M", "Masculino"],
              ["OUTRO", "Outro"],
            ]}
            aoMudar={(v) => setComum((c) => ({ ...c, sexo: v }))}
          />
          <Texto
            rotulo="Altura (cm)"
            tipo="number"
            valor={comum.alturaCm}
            aoMudar={(v) => setComum((c) => ({ ...c, alturaCm: v }))}
          />
          <Texto
            rotulo="Objetivo"
            valor={comum.objetivo}
            aoMudar={(v) => setComum((c) => ({ ...c, objetivo: v }))}
          />
        </div>
      </section>

      {podeNutricao && podeTreino && (
        <fieldset className="paper-card rounded-sm p-6">
          <legend className="eyebrow px-1">O que você vai acompanhar?</legend>
          <label className="flex items-center gap-2.5 py-1 text-sm">
            <input
              type="checkbox"
              checked={acompanhaNutricao}
              onChange={(e) => setAcompanhaNutricao(e.target.checked)}
            />
            Nutrição
          </label>
          <label className="flex items-center gap-2.5 py-1 text-sm">
            <input type="checkbox" checked={acompanhaTreino} onChange={(e) => setAcompanhaTreino(e.target.checked)} />
            Treino
          </label>
        </fieldset>
      )}

      {acompanhaNutricao && (
        <section className="paper-card flex flex-col gap-4 rounded-sm p-6">
          <h2 className="eyebrow">Metas diárias</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Texto
              rotulo="Meta kcal"
              tipo="number"
              obrigatorio
              valor={metas.metaKcal}
              aoMudar={(v) => setMetas((m) => ({ ...m, metaKcal: v }))}
            />
            <Texto
              rotulo="Proteína (g)"
              tipo="number"
              obrigatorio
              valor={metas.metaProteina}
              aoMudar={(v) => setMetas((m) => ({ ...m, metaProteina: v }))}
            />
            <Texto
              rotulo="Carbo (g)"
              tipo="number"
              obrigatorio
              valor={metas.metaCarbo}
              aoMudar={(v) => setMetas((m) => ({ ...m, metaCarbo: v }))}
            />
            <Texto
              rotulo="Gordura (g)"
              tipo="number"
              obrigatorio
              valor={metas.metaGordura}
              aoMudar={(v) => setMetas((m) => ({ ...m, metaGordura: v }))}
            />
          </div>

          <h2 className="eyebrow mt-2">Anamnese nutricional</h2>
          <p className="-mt-2 text-xs text-ink-faint">Tudo opcional — dá pra completar depois.</p>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={anamneseNutri.jaSeguiuDieta}
              onChange={(e) => setAnamneseNutri((a) => ({ ...a, jaSeguiuDieta: e.target.checked }))}
            />
            Já seguiu dieta antes
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={anamneseNutri.usaSuplemento}
              onChange={(e) => setAnamneseNutri((a) => ({ ...a, usaSuplemento: e.target.checked }))}
            />
            Usa suplemento
          </label>
          <Texto
            rotulo="Restrições / alergias"
            valor={anamneseNutri.restricoesAlimentares}
            aoMudar={(v) => setAnamneseNutri((a) => ({ ...a, restricoesAlimentares: v }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Texto
              rotulo="Refeições por dia"
              tipo="number"
              valor={anamneseNutri.refeicoesPorDia}
              aoMudar={(v) => setAnamneseNutri((a) => ({ ...a, refeicoesPorDia: v }))}
            />
            <Selecao
              rotulo="Consumo de álcool"
              valor={anamneseNutri.consumoAlcool}
              opcoes={[
                ["", "—"],
                ["NUNCA", "Nunca"],
                ["SOCIAL", "Social"],
                ["FREQUENTE", "Frequente"],
              ]}
              aoMudar={(v) => setAnamneseNutri((a) => ({ ...a, consumoAlcool: v }))}
            />
          </div>
          <AreaTexto
            rotulo="Observações"
            valor={anamneseNutri.observacoes}
            aoMudar={(v) => setAnamneseNutri((a) => ({ ...a, observacoes: v }))}
          />
        </section>
      )}

      {acompanhaTreino && (
        <section className="paper-card flex flex-col gap-4 rounded-sm p-6">
          <h2 className="eyebrow">Treino prescrito</h2>
          <Texto
            rotulo="Nome do treino"
            obrigatorio
            valor={treino.nome}
            aoMudar={(v) => setTreino((t) => ({ ...t, nome: v }))}
          />
          <AreaTexto
            rotulo="Exercícios"
            obrigatorio
            valor={treino.descricao}
            aoMudar={(v) => setTreino((t) => ({ ...t, descricao: v }))}
          />
          <Texto
            rotulo="Dias por semana"
            tipo="number"
            obrigatorio
            valor={treino.diasPorSemana}
            aoMudar={(v) => setTreino((t) => ({ ...t, diasPorSemana: v }))}
          />

          <h2 className="eyebrow mt-2">Anamnese de treino</h2>
          <p className="-mt-2 text-xs text-ink-faint">Tudo opcional — dá pra completar depois.</p>
          <Selecao
            rotulo="Experiência"
            valor={anamneseTreino.experiencia}
            opcoes={[
              ["", "—"],
              ["INICIANTE", "Iniciante"],
              ["INTERMEDIARIO", "Intermediário"],
              ["AVANCADO", "Avançado"],
            ]}
            aoMudar={(v) => setAnamneseTreino((a) => ({ ...a, experiencia: v }))}
          />
          <Texto
            rotulo="Lesões / limitações"
            valor={anamneseTreino.lesoesLimitacoes}
            aoMudar={(v) => setAnamneseTreino((a) => ({ ...a, lesoesLimitacoes: v }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Texto
              rotulo="Já treina x/semana"
              tipo="number"
              valor={anamneseTreino.frequenciaAtual}
              aoMudar={(v) => setAnamneseTreino((a) => ({ ...a, frequenciaAtual: v }))}
            />
            <Texto
              rotulo="Pratica outro esporte"
              valor={anamneseTreino.praticaOutroEsporte}
              aoMudar={(v) => setAnamneseTreino((a) => ({ ...a, praticaOutroEsporte: v }))}
            />
          </div>
          <AreaTexto
            rotulo="Observações"
            valor={anamneseTreino.observacoes}
            aoMudar={(v) => setAnamneseTreino((a) => ({ ...a, observacoes: v }))}
          />
        </section>
      )}

      {erro && <p className="text-sm text-urgent">{erro}</p>}

      <div>
        <button
          type="submit"
          disabled={pendente}
          className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Cadastrando…" : "Cadastrar cliente"}
        </button>
      </div>
    </form>
  );
}

const CLASSE_CAMPO =
  "w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe";

function Texto({
  rotulo,
  valor,
  aoMudar,
  tipo = "text",
  obrigatorio = false,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  tipo?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">{rotulo}</span>
      <input
        type={tipo}
        required={obrigatorio}
        min={tipo === "number" ? 0 : undefined}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={CLASSE_CAMPO}
      />
    </label>
  );
}

function AreaTexto({
  rotulo,
  valor,
  aoMudar,
  obrigatorio = false,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  obrigatorio?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">{rotulo}</span>
      <textarea
        rows={3}
        required={obrigatorio}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={CLASSE_CAMPO}
      />
    </label>
  );
}

function Selecao({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  opcoes: [string, string][];
  aoMudar: (v: string) => void;
}) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">{rotulo}</span>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className={CLASSE_CAMPO}>
        {opcoes.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </label>
  );
}
