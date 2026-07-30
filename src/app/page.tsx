import Link from "next/link";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { ScriptSemFlashDeTema } from "@/components/nutri/ScriptSemFlashDeTema";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

export default function Home() {
  return (
    <>
      <ScriptSemFlashDeTema />
      <main className="entrada-aba mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
        <div>
          <NoSheipeLogo size={28} />
          <h1 className="font-display mt-4 text-3xl">Acompanhamento entre consultas</h1>
          <p className="mt-2 text-sm text-ink-soft">Você prescreve, o app só acompanha.</p>
        </div>

        {/* Uma entrada só: nutricionista e personal usam o mesmo login, e o
            painel se ajusta ao que a pessoa marcou no cadastro. */}
        <div className="flex flex-col gap-3">
          <Link href="/pro/login" className="tatil paper-card rounded-sm p-5 transition-colors hover:border-sheipe">
            <p className="font-display text-lg">Sou profissional</p>
            <p className="mt-1 text-sm text-ink-soft">
              Nutricionista, personal trainer ou os dois: prescreva e acompanhe a aderência num só painel.
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
