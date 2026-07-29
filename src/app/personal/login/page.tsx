"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { entrarPersonalTrainer, cadastrarPersonalTrainer, type EstadoLoginPersonal } from "./actions";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";

const ESTADO_INICIAL: EstadoLoginPersonal = {};

export default function LoginPersonal() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [estadoEntrar, acaoEntrar] = useFormState(entrarPersonalTrainer, ESTADO_INICIAL);
  const [estadoCadastrar, acaoCadastrar] = useFormState(cadastrarPersonalTrainer, ESTADO_INICIAL);

  const estado = modo === "entrar" ? estadoEntrar : estadoCadastrar;

  return (
    <main className="grid min-h-screen sm:grid-cols-2">
      <section
        className="hidden flex-col justify-between p-12 sm:flex"
        style={{ background: "var(--signature-ink)", color: "var(--signature-paper)" }}
      >
        <div style={{ color: "var(--signature-paper)", opacity: 0.85 }}>
          <NoSheipeLogo size={26} />
        </div>
        <blockquote className="font-display text-3xl leading-snug">
          Você prescreve<span style={{ color: "var(--signature-sheipe)" }}>,</span> o app só acompanha.
        </blockquote>
        <p className="max-w-sm text-sm" style={{ color: "var(--signature-paper)", opacity: 0.6 }}>
          O treino vem sempre de você. O aluno registra o que treinou entre sessões e você vê a frequência num só
          painel.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="sm:hidden">
            <NoSheipeLogo size={24} />
          </div>
          <h1 className="font-display mt-1 text-3xl">{modo === "entrar" ? "Entrar" : "Criar conta"}</h1>
          <p className="mt-2 text-sm text-ink-soft">Painel de personal trainer.</p>

          <div className="mt-6 flex gap-1 rounded-sm border border-rule p-1 text-sm">
            <button
              type="button"
              onClick={() => setModo("entrar")}
              className={`flex-1 rounded-sm px-3 py-1.5 transition-colors ${modo === "entrar" ? "bg-sheipe text-sheipe-on" : "text-ink-soft"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setModo("cadastrar")}
              className={`flex-1 rounded-sm px-3 py-1.5 transition-colors ${modo === "cadastrar" ? "bg-sheipe text-sheipe-on" : "text-ink-soft"}`}
            >
              Criar conta
            </button>
          </div>

          {modo === "entrar" ? (
            <form action={acaoEntrar} className="mt-6 flex flex-col gap-4">
              <CampoEmail />
              <CampoSenha autoComplete="current-password" />
              {estado.erro && <p className="text-sm text-urgent">{estado.erro}</p>}
              <Botao rotulo="Entrar" rotuloCarregando="Entrando…" />
            </form>
          ) : (
            <form action={acaoCadastrar} className="mt-6 flex flex-col gap-4">
              <label className="text-sm">
                <span className="eyebrow mb-1.5 block">Nome</span>
                <input
                  type="text"
                  name="nome"
                  required
                  autoComplete="name"
                  className="w-full rounded-sm border border-rule bg-paper-raised px-3 py-2.5 text-sm outline-none transition-colors focus:border-sheipe"
                />
              </label>
              <label className="text-sm">
                <span className="eyebrow mb-1.5 block">CREF (opcional)</span>
                <input
                  type="text"
                  name="cref"
                  className="w-full rounded-sm border border-rule bg-paper-raised px-3 py-2.5 text-sm outline-none transition-colors focus:border-sheipe"
                />
              </label>
              <CampoEmail />
              <CampoSenha autoComplete="new-password" />
              {estado.erro && <p className="text-sm text-urgent">{estado.erro}</p>}
              <Botao rotulo="Criar conta" rotuloCarregando="Criando…" />
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function CampoEmail() {
  return (
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
  );
}

function CampoSenha({ autoComplete }: { autoComplete: string }) {
  return (
    <label className="text-sm">
      <span className="eyebrow mb-1.5 block">Senha</span>
      <input
        type="password"
        name="senha"
        required
        minLength={6}
        autoComplete={autoComplete}
        className="w-full rounded-sm border border-rule bg-paper-raised px-3 py-2.5 text-sm outline-none transition-colors focus:border-sheipe"
      />
    </label>
  );
}

function Botao({ rotulo, rotuloCarregando }: { rotulo: string; rotuloCarregando: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-sm bg-sheipe px-4 py-2.5 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
    >
      {pending ? rotuloCarregando : rotulo}
    </button>
  );
}
