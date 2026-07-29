import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default function PacienteNaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <NoSheipeLogo size={32} />
      <h1 className="font-display text-xl">Paciente não encontrado</h1>
      <p className="text-sm text-ink-soft">Esse paciente não existe ou não pertence à sua conta.</p>
      <Link href="/pro" className="inline-flex items-center gap-1.5 text-sm text-sheipe hover:underline">
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
    </main>
  );
}
