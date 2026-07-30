"use client";

import { useFormState, useFormStatus } from "react-dom";
import { redefinirSenha, type EstadoRedefinir } from "./actions";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

const ESTADO_INICIAL: EstadoRedefinir = {};

export default function RedefinirSenha() {
  const [estado, acao] = useFormState(redefinirSenha, ESTADO_INICIAL);

  return (
    <>
      <main className="entrada-aba flex min-h-screen flex-col justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-sm">
          <NoSheipeLogo size={24} />
          <h1 className="font-display mt-3 text-3xl">Nova senha</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Escolha uma senha nova pra sua conta. Depois de salvar, você já entra direto.
          </p>

          <form action={acao} className="mt-6 flex flex-col gap-4">
            <Campo rotulo="Nova senha" nome="senha" />
            <Campo rotulo="Repita a senha" nome="confirmacao" />
            {estado.erro && <p className="text-sm text-urgent">{estado.erro}</p>}
            <Botao />
          </form>
        </div>
      </main>
      <ThemeToggle />
    </>
  );
}

function Campo({ rotulo, nome }: { rotulo: string; nome: string }) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">{rotulo}</span>
      <input
        type="password"
        name={nome}
        required
        minLength={6}
        autoComplete="new-password"
        className="w-full rounded-sm border border-rule bg-paper-raised px-3 py-2.5 text-sm outline-none transition-colors focus:border-sheipe"
      />
    </label>
  );
}

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tatil mt-2 rounded-sm bg-sheipe px-4 py-2.5 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
    >
      {pending ? "Salvando…" : "Salvar senha"}
    </button>
  );
}
