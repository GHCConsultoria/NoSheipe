"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { solicitarRecuperacao } from "./actions";

export function FormularioRecuperacao({ avisoInicial }: { avisoInicial?: string }) {
  const [estado, acao] = useFormState(solicitarRecuperacao, { erro: avisoInicial });

  if (estado.enviado) {
    return (
      <div className="mt-4 rounded-sm border border-rule bg-paper-raised p-4 text-sm">
        <p>
          Se existir uma conta com esse e-mail, enviamos um link pra você definir uma senha nova. Confira a caixa de
          entrada (e o spam).
        </p>
        <p className="mt-3 text-ink-soft">O link vale por tempo limitado — se expirar, é só pedir de novo.</p>
        <Link href="/pro/login" className="mt-4 inline-block text-sheipe underline underline-offset-4">
          Voltar pro login
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mt-2 text-sm text-ink-soft">
        Informe o e-mail da sua conta. Enviamos um link pra você criar uma senha nova.
      </p>
      <form action={acao} className="mt-6 flex flex-col gap-4">
        <label className="text-sm">
          <span className="eyebrow mb-1.5 block">E-mail</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-sm border border-rule bg-paper-raised px-3 py-2.5 text-sm outline-none transition-colors focus:border-sheipe"
          />
        </label>
        {estado.erro && <p className="text-sm text-urgent">{estado.erro}</p>}
        <Botao />
        <Link
          href="/pro/login"
          className="text-center text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          Voltar pro login
        </Link>
      </form>
    </>
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
      {pending ? "Enviando…" : "Enviar link"}
    </button>
  );
}
