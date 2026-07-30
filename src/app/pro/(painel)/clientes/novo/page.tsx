import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { obterProfissionalAtual } from "@/lib/profissional/auth";
import { FormularioNovoCliente } from "@/components/cliente/FormularioNovoCliente";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default async function NovoCliente() {
  const profissional = await obterProfissionalAtual();

  return (
    <main className="entrada-aba mx-auto max-w-2xl px-6 py-16">
      <Link href="/pro" className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-sheipe">
        <ArrowLeft size={15} strokeWidth={1.75} /> voltar para o painel
      </Link>
      <div className="mt-6 mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-3xl">Novo cliente</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        A prescrição vem sempre de você. O app só registra o que o cliente faz entre as consultas.
      </p>

      <div className="mt-8">
        <FormularioNovoCliente
          podeNutricao={profissional.ehNutricionista}
          podeTreino={profissional.ehPersonal}
        />
      </div>
    </main>
  );
}
