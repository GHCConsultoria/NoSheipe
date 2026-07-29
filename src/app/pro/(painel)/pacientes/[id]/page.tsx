import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import { buscarPacientePorId, buscarHistoricoDePeso, buscarAnotacoes } from "@/lib/nutri/consultas";
import { EditorPaciente } from "@/components/nutri/EditorPaciente";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

const FORMATADOR_DATA_CURTA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

const FORMATADOR_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function EditarPaciente({ params }: { params: { id: string } }) {
  const profissional = await obterProfissionalAtual();
  const paciente = await buscarPacientePorId(params.id, profissional.id);
  if (!paciente) {
    notFound();
  }

  const [historicoDePeso, anotacoes] = await Promise.all([
    buscarHistoricoDePeso(paciente.id),
    buscarAnotacoes(paciente.id),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/pro" className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe">
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
      <div className="mt-6 mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-3xl">{paciente.nome}</h1>

      <div className="mt-8">
        <EditorPaciente
          pacienteId={paciente.id}
          tokenInicial={paciente.tokenAcesso}
          metasIniciais={{
            metaKcal: paciente.metaKcal,
            metaProteina: paciente.metaProteina,
            metaCarbo: paciente.metaCarbo,
            metaGordura: paciente.metaGordura,
          }}
          historicoDePeso={historicoDePeso.map((medida) => ({
            valor: medida.pesoKg,
            rotulo: FORMATADOR_DATA_CURTA.format(medida.registradoEm),
          }))}
          anotacoes={anotacoes.map((anotacao) => ({
            id: anotacao.id,
            texto: anotacao.texto,
            data: FORMATADOR_DATA_HORA.format(anotacao.criadoEm),
          }))}
        />
      </div>
    </main>
  );
}
