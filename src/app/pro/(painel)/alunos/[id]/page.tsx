import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import { buscarAlunoPorId, buscarTreinoAtivo } from "@/lib/personal/consultas";
import { EditorAluno } from "@/components/personal/EditorAluno";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default async function EditarAluno({ params }: { params: { id: string } }) {
  const profissional = await obterProfissionalAtual();
  const aluno = await buscarAlunoPorId(params.id, profissional.id);
  if (!aluno) {
    notFound();
  }

  const treinoAtivo = await buscarTreinoAtivo(aluno.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/pro"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
      <div className="mt-6 mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-3xl">{aluno.nome}</h1>

      <div className="mt-8">
        <EditorAluno
          alunoId={aluno.id}
          tokenInicial={aluno.tokenAcesso}
          treinoAtivo={
            treinoAtivo
              ? {
                  nome: treinoAtivo.nome,
                  descricao: treinoAtivo.descricao,
                  diasPorSemana: treinoAtivo.diasPorSemana,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
