import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import {
  buscarPacientePorToken,
  buscarRegistrosDeHoje,
  buscarFavoritos,
  buscarHistoricoDePeso,
} from "@/lib/nutri/consultas";
import { calcularSaldoDoDia } from "@/lib/nutri/aderencia";
import { ConsentimentoPaciente } from "@/components/nutri/ConsentimentoPaciente";
import { RegistroPaciente } from "@/components/nutri/RegistroPaciente";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return {
    title: "NoSheipe",
    manifest: `/p/${params.token}/manifest.json`,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NoSheipe" },
    icons: {
      icon: "/icons/nosheipe-192.png",
      apple: "/icons/nosheipe-180.png",
    },
  };
}

const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PaginaPaciente({ params }: { params: { token: string } }) {
  const paciente = await buscarPacientePorToken(params.token);
  if (!paciente) {
    notFound();
  }

  if (!paciente.consentimentoEm) {
    return <ConsentimentoPaciente token={paciente.tokenAcesso} nomePaciente={paciente.nome} />;
  }

  const [registros, favoritos, historicoDePeso] = await Promise.all([
    buscarRegistrosDeHoje(paciente.id),
    buscarFavoritos(paciente.id),
    buscarHistoricoDePeso(paciente.id),
  ]);
  const saldo = calcularSaldoDoDia(registros, paciente);
  const pesoAtual = historicoDePeso.at(-1)?.pesoKg ?? null;

  return (
    <RegistroPaciente
      token={paciente.tokenAcesso}
      nomePaciente={paciente.nome}
      saldo={saldo}
      favoritos={favoritos.map((favorito) => ({ id: favorito.id, descricao: favorito.descricao }))}
      pesoAtual={pesoAtual}
      registros={registros.map((registro) => ({
        id: registro.id,
        entradaBruta: registro.entradaBruta,
        kcal: registro.kcal,
        proteina: registro.proteina,
        carbo: registro.carbo,
        gordura: registro.gordura,
        confianca: registro.confianca,
        horario: FORMATADOR_HORA.format(registro.registradoEm),
      }))}
    />
  );
}
