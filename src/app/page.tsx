import Link from "next/link";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { ScriptSemFlashDeTema } from "@/components/nutri/ScriptSemFlashDeTema";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

export default function Home() {
  return (
    <>
      <ScriptSemFlashDeTema />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
        <div>
          <NoSheipeLogo size={28} />
          <h1 className="font-display mt-4 text-3xl">Acompanhamento entre consultas</h1>
          <p className="mt-2 text-sm text-ink-soft">Você prescreve, o app só acompanha. Escolha sua área pra entrar.</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/nutri/login" className="paper-card rounded-sm p-5 transition-colors hover:border-sheipe">
            <p className="font-display text-lg">Sou nutricionista</p>
            <p className="mt-1 text-sm text-ink-soft">
              Defina metas de macro e veja a aderência dos pacientes num só painel.
            </p>
          </Link>

          <Link href="/personal/login" className="paper-card rounded-sm p-5 transition-colors hover:border-sheipe">
            <p className="font-display text-lg">Sou personal trainer</p>
            <p className="mt-1 text-sm text-ink-soft">
              Prescreva treinos e acompanhe a frequência dos alunos entre as sessões.
            </p>
          </Link>
        </div>

        <p className="text-xs text-ink-faint">
          É paciente ou aluno? Use o link que seu profissional te enviou — não precisa de senha.
        </p>
      </main>
      <ThemeToggle />
    </>
  );
}
