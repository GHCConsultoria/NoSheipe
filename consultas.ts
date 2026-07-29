import Link from "next/link";
import { FormularioNovoPaciente } from "@/components/nutri/FormularioNovoPaciente";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

export default function NovoPaciente() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/nutri" className="text-sm text-ink-soft transition-colors hover:text-sheipe">
        ← voltar para o painel
      </Link>
      <div className="mt-6 mb-2">
        <NoSheipeLogo size={22} />
      </div>
      <h1 className="font-display text-3xl">Novo paciente</h1>
      <p className="mt-2 max-w-lg text-sm text-ink-soft">
        As metas são a prescrição — elas vêm sempre de você. O app só registra o consumo do paciente contra elas.
      </p>

      <div className="mt-8">
        <FormularioNovoPaciente />
      </div>
    </main>
  );
}
