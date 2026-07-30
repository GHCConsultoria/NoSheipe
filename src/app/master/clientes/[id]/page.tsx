import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { buscarClienteCompleto } from "@/lib/master/consultas";
import { ehErroDeAutenticacao, obterMasterAtual } from "@/lib/profissional/auth";
import { GraficoLinha } from "@/components/shared/GraficoLinha";

export const dynamic = "force-dynamic";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** Idade calculada na hora — o banco guarda data de nascimento, não idade. */
function idadeEmAnos(nascimento: Date): number {
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade -= 1;
  return idade;
}

/**
 * Ficha completa do cliente na visão administrativa.
 *
 * Mostra mais do que qualquer profissional consegue ver: as anotações vêm
 * de todos os profissionais, inclusive as que um lado escreveu e o outro
 * nunca poderia ler. Por isso a tela começa avisando o que é isto.
 *
 * A checagem de permissão fica aqui dentro, antes de qualquer consulta,
 * pelo mesmo motivo do /master: layout e page renderizam em paralelo, e um
 * notFound() só no layout devolveria 404 com os dados no corpo.
 */
export default async function ClienteNoMaster({ params }: { params: { id: string } }) {
  let master;
  try {
    master = await obterMasterAtual();
  } catch (erro) {
    if (ehErroDeAutenticacao(erro)) {
      redirect("/pro/login");
    }
    throw erro;
  }
  if (!master) {
    notFound();
  }

  const ficha = await buscarClienteCompleto(params.id);
  if (!ficha) {
    notFound();
  }

  const { cliente } = ficha;
  const detalhes = [
    cliente.dataNascimento ? `${idadeEmAnos(cliente.dataNascimento)} anos` : null,
    cliente.sexo === "F" ? "feminino" : cliente.sexo === "M" ? "masculino" : cliente.sexo ? "outro" : null,
    cliente.alturaCm ? `${cliente.alturaCm} cm` : null,
    cliente.objetivo,
  ].filter(Boolean);

  // Do mais antigo pro mais novo, que é a direção que o gráfico espera.
  const pesos = [...ficha.medidas].reverse();

  return (
    <main className="entrada-aba mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/master"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para a administração
      </Link>

      <h1 className="mt-6 font-display text-3xl">{cliente.nome}</h1>
      {detalhes.length > 0 && <p className="mt-1 text-sm text-ink-soft">{detalhes.join(" · ")}</p>}
      <p className="mt-1 text-xs text-ink-faint">
        Cliente desde {DATA.format(cliente.criadoEm)} · código {cliente.codigoConvite} ·{" "}
        {cliente.consentimentoEm ? `consentiu em ${DATA.format(cliente.consentimentoEm)}` : "sem consentimento ainda"}
      </p>

      <p className="mt-6 flex items-start gap-2 rounded-sm border border-attention-line bg-attention-bg p-3 text-xs text-attention">
        <TriangleAlert size={15} strokeWidth={1.75} className="mt-px shrink-0" />
        <span>
          Esta tela reúne dado de saúde de uma pessoa, incluindo anotações que cada profissional escreveu em
          particular. Está aqui para operação e suporte, não para uso clínico.
        </span>
      </p>

      <Secao titulo="Vínculos">
        <ul className="flex flex-col gap-2 text-sm">
          {ficha.vinculos.map((v) => (
            <li key={v.id} className="flex items-baseline justify-between gap-3">
              <span>
                {v.profissionalNome}
                <span className="text-ink-faint"> · {v.tipo === "NUTRICAO" ? "dieta" : "treino"}</span>
              </span>
              <span className="font-data shrink-0 text-xs text-ink-soft">
                {v.status.toLowerCase()} · {DATA.format(v.criadoEm)}
              </span>
            </li>
          ))}
        </ul>
        {ficha.vinculos.length === 0 && <Vazio />}
      </Secao>

      {(ficha.anamneseNutricional || ficha.anamneseTreino) && (
        <Secao titulo="Anamnese">
          <div className="flex flex-col gap-1.5 text-sm">
            {ficha.anamneseNutricional && (
              <>
                <Linha rotulo="Já seguiu dieta" valor={ficha.anamneseNutricional.jaSeguiuDieta ? "sim" : "não"} />
                <Linha rotulo="Restrições" valor={ficha.anamneseNutricional.restricoesAlimentares} />
                <Linha rotulo="Suplemento" valor={ficha.anamneseNutricional.usaSuplemento ? "sim" : "não"} />
                <Linha rotulo="Refeições/dia" valor={ficha.anamneseNutricional.refeicoesPorDia?.toString()} />
                <Linha rotulo="Álcool" valor={ficha.anamneseNutricional.consumoAlcool?.toLowerCase()} />
                <Linha rotulo="Observações" valor={ficha.anamneseNutricional.observacoes} />
              </>
            )}
            {ficha.anamneseTreino && (
              <>
                <Linha rotulo="Experiência" valor={ficha.anamneseTreino.experiencia?.toLowerCase()} />
                <Linha rotulo="Lesões" valor={ficha.anamneseTreino.lesoesLimitacoes} />
                <Linha rotulo="Já treina" valor={ficha.anamneseTreino.frequenciaAtual?.toString()} />
                <Linha rotulo="Outro esporte" valor={ficha.anamneseTreino.praticaOutroEsporte} />
                <Linha rotulo="Observações" valor={ficha.anamneseTreino.observacoes} />
              </>
            )}
          </div>
        </Secao>
      )}

      {ficha.planos.length > 0 && (
        <Secao titulo="Planos nutricionais">
          <ul className="flex flex-col gap-2 text-sm">
            {ficha.planos.map((p, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span className="font-data">
                  {p.metaKcal} kcal · {p.metaProteina}P / {p.metaCarbo}C / {p.metaGordura}G
                </span>
                <span className="shrink-0 text-xs text-ink-faint">
                  {p.ativo ? <span className="text-sheipe">ativo</span> : "histórico"} · {DATA.format(p.criadoEm)}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {ficha.treinos.length > 0 && (
        <Secao titulo="Treinos prescritos">
          <ul className="flex flex-col gap-3 text-sm">
            {ficha.treinos.map((t, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display">{t.nome}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {t.ativo ? <span className="text-treino">ativo</span> : "histórico"} · {t.diasPorSemana}x/sem
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{t.descricao}</p>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {pesos.length >= 2 && (
        <Secao titulo="Evolução de peso">
          <GraficoLinha
            pontos={pesos.map((m) => ({ valor: m.pesoKg, rotulo: DIA.format(m.registradoEm) }))}
            sufixo=" kg"
          />
        </Secao>
      )}

      <Secao titulo={`Refeições (${ficha.refeicoes.length})`}>
        <ul className="flex flex-col gap-2 text-sm">
          {ficha.refeicoes.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3">
              <span className="text-ink-soft">{r.entradaBruta}</span>
              <span className="font-data shrink-0 text-xs text-ink-faint">
                {r.kcal} kcal · {DATA_HORA.format(r.registradoEm)}
              </span>
            </li>
          ))}
        </ul>
        {ficha.refeicoes.length === 0 && <Vazio />}
      </Secao>

      <Secao titulo={`Treinos realizados (${ficha.sessoes.length})`}>
        <ul className="flex flex-col gap-2 text-sm">
          {ficha.sessoes.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-3">
              <span className="text-ink-soft">{s.entradaBruta}</span>
              <span className="font-data shrink-0 text-xs text-ink-faint">{DATA_HORA.format(s.realizadoEm)}</span>
            </li>
          ))}
        </ul>
        {ficha.sessoes.length === 0 && <Vazio />}
      </Secao>

      <Secao titulo="Anotações dos profissionais">
        <p className="-mt-1 mb-2 text-xs text-ink-faint">
          Privadas entre cada profissional e o cliente — um profissional não vê a do outro. Aqui aparecem todas.
        </p>
        <ul className="flex flex-col gap-3">
          {ficha.anotacoes.map((a) => (
            <li key={a.id} className="rounded-sm border border-rule p-3">
              <p className="text-sm">{a.texto}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {a.profissionalNome} · {DATA.format(a.criadoEm)}
              </p>
            </li>
          ))}
        </ul>
        {ficha.anotacoes.length === 0 && <Vazio />}
      </Secao>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="paper-card mt-6 rounded-sm p-5">
      <h2 className="eyebrow mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Vazio() {
  return <p className="text-sm text-ink-faint">Nada registrado.</p>;
}

/** Campo em branco não vira linha — dado ausente fica ausente. */
function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <p className="text-ink-soft">
      <span className="text-ink-faint">{rotulo}:</span> {valor}
    </p>
  );
}
