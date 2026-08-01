import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import { buscarFichaDoCliente } from "@/lib/profissional/consultas";
import { EditorCliente } from "@/components/cliente/EditorCliente";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

const FORMATADOR_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const FORMATADOR_DIA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

/** Idade calculada na hora — o banco guarda data de nascimento, não idade. */
function idadeEmAnos(nascimento: Date): number {
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade -= 1;
  return idade;
}

export default async function FichaCliente({ params }: { params: { id: string } }) {
  const profissional = await obterProfissionalAtual();
  const ficha = await buscarFichaDoCliente(params.id, profissional.id);
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

  return (
    <main className="entrada-aba mx-auto max-w-2xl px-6 py-16">
      <Link href="/pro" className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe">
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
      <div className="mt-6 mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-3xl">{cliente.nome}</h1>
      {detalhes.length > 0 && <p className="mt-1 text-sm text-ink-soft">{detalhes.join(" · ")}</p>}

      {(ficha.anamneseNutricional || ficha.anamneseTreino) && (
        <section className="paper-card mt-6 flex flex-col gap-2 rounded-sm p-6 text-sm">
          <h2 className="eyebrow mb-1">Anamnese</h2>
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
        </section>
      )}

      <div className="mt-6">
        <EditorCliente
          clienteId={cliente.id}
          tokenInicial={cliente.tokenAcesso}
          codigoConvite={cliente.codigoConvite}
          acompanhaNutricao={ficha.acompanhaNutricao}
          acompanhaTreino={ficha.acompanhaTreino}
          metasIniciais={ficha.metas}
          treinoInicial={ficha.treino}
          anotacoes={ficha.anotacoes.map((a) => ({
            id: a.id,
            texto: a.texto,
            criadoEm: FORMATADOR_DATA.format(a.criadoEm),
          }))}
          recados={ficha.recados.map((r) => ({
            id: r.id,
            texto: r.texto,
            criadoEm: FORMATADOR_DATA.format(r.criadoEm),
            lido: r.lido,
          }))}
          pesos={ficha.pesos.map((p) => ({
            valor: p.pesoKg,
            rotulo: FORMATADOR_DIA.format(p.registradoEm),
          }))}
          templatesNutricao={ficha.templatesNutricao}
          templatesTreino={ficha.templatesTreino}
        />
      </div>
    </main>
  );
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
