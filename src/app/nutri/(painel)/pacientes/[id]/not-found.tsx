import Link from "next/link";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default function PacienteNaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <NoSheipeLogo size={32} />
      <h1 className="font-display text-xl">Paciente não encontrado</h1>
      <p className="text-sm text-ink-soft">Esse paciente não existe ou não pertence à sua conta.</p>
      <Link href="/nutri" className="text-sm text-sheipe hover:underline">
        ← voltar para o painel
      </Link>
    </main>
  );
}
