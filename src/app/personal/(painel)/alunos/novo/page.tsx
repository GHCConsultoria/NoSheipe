import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormularioNovoAluno } from "@/components/personal/FormularioNovoAluno";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default function NovoAluno() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/personal"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
      <div className="mt-6 mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-3xl">Novo aluno</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        Depois de cadastrar, prescreva o treino na página do aluno — o app só registra o que ele treinou contra a
        prescrição.
      </p>

      <div className="mt-8">
        <FormularioNovoAluno />
      </div>
    </main>
  );
}
