import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default function AlunoNaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <NoSheipeLogo size={32} />
      <h1 className="font-display text-xl">Link não encontrado</h1>
      <p className="text-sm text-ink-soft">
        Esse link não existe mais ou foi revogado. Fale com seu personal trainer pra pedir o link atualizado.
      </p>
    </main>
  );
}
