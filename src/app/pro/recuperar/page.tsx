import { FormularioRecuperacao } from "./FormularioRecuperacao";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

// Mensagens com que o callback (troca do code por sessão) volta pra cá
// quando o link do e-mail não presta mais.
const AVISOS: Record<string, string> = {
  expirado: "esse link expirou ou já foi usado. Peça um novo aqui embaixo.",
  link: "o link veio incompleto. Peça um novo aqui embaixo.",
};

export default function RecuperarSenha({ searchParams }: { searchParams: { erro?: string } }) {
  const avisoInicial = searchParams.erro ? AVISOS[searchParams.erro] : undefined;

  return (
    <>
      <main className="entrada-aba flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-sm">
          <NoSheipeLogo size={24} />
          <h1 className="font-display mt-3 text-3xl">Recuperar senha</h1>
          <FormularioRecuperacao avisoInicial={avisoInicial} />
        </div>
      </main>
      <ThemeToggle />
    </>
  );
}
