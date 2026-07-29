import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { buscarAlunoPorToken, buscarTreinoAtivo, buscarRegistrosDeHoje } from "@/lib/personal/consultas";
import { ConsentimentoAluno } from "@/components/personal/ConsentimentoAluno";
import { RegistroTreino } from "@/components/personal/RegistroTreino";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  title: "NoSheipe",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NoSheipe" },
  icons: {
    icon: "/icons/nosheipe-192.png",
    apple: "/icons/nosheipe-180.png",
  },
};

const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PaginaAluno({ params }: { params: { token: string } }) {
  const aluno = await buscarAlunoPorToken(params.token);
  if (!aluno) {
    notFound();
  }

  if (!aluno.consentimentoEm) {
    return <ConsentimentoAluno token={aluno.tokenAcesso} nomeAluno={aluno.nome} />;
  }

  const [treinoAtivo, registros] = await Promise.all([buscarTreinoAtivo(aluno.id), buscarRegistrosDeHoje(aluno.id)]);

  return (
    <RegistroTreino
      token={aluno.tokenAcesso}
      nomeAluno={aluno.nome}
      treinoAtivo={
        treinoAtivo
          ? { nome: treinoAtivo.nome, descricao: treinoAtivo.descricao, diasPorSemana: treinoAtivo.diasPorSemana }
          : null
      }
      registros={registros.map((registro) => ({
        id: registro.id,
        entradaBruta: registro.entradaBruta,
        horario: FORMATADOR_HORA.format(registro.realizadoEm),
      }))}
    />
  );
}
