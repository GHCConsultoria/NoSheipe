"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { entrarProfissional, cadastrarProfissional, type EstadoLoginProfissional } from "./actions";
import { NoSheipeLogo } from "@/components/nutri/NoSheipeLogo";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

const ESTADO_INICIAL: EstadoLoginProfissional = {};

export default function LoginProfissional() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [estadoEntrar, acaoEntrar] = useFormState(entrarProfissional, ESTADO_INICIAL);
  const [estadoCadastrar, acaoCadastrar] = useFormState(cadastrarProfissional, ESTADO_INICIAL);

  // Controlados só para revelar o campo de registro (CRN/CREF) da atuação
  // escolhida — o valor enviado continua vindo do próprio checkbox.
  const [ehNutricionista, setEhNutricionista] = useState(false);
  const [ehPersonal, setEhPersonal] = useState(false);

  const estado = modo === "entrar" ? estadoEntrar : estadoCadastrar;

  return (
    <>
    <main className="entrada-aba grid min-h-screen sm:grid-cols-2">
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
          Dieta, treino ou os dois. O cliente registra o dia a dia entre as consultas e você acompanha a aderência
          num só painel.
        </p>
      </section>

      <section className="flex flex-col justify-center px-6 py-16 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="sm:hidden">
            <NoSheipeLogo size={24} />
          </div>
          <h1 className="font-display mt-1 text-3xl">{modo === "entrar" ? "Entrar" : "Criar conta"}</h1>
          <p className="mt-2 text-sm text-ink-soft">Painel do profissional.</p>

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
              <a
                href="/pro/recuperar"
                className="text-center text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                Esqueci minha senha
              </a>
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

              <fieldset className="rounded-sm border border-rule p-3">
                <legend className="eyebrow px-1">O que você faz?</legend>
                <p className="mb-2 text-xs text-ink-faint">
                  Pode marcar os dois — o painel se ajusta ao que você marcar.
                </p>
                <label className="flex items-center gap-2.5 py-1 text-sm">
                  <input
                    type="checkbox"
                    name="ehNutricionista"
                    checked={ehNutricionista}
                    onChange={(evento) => setEhNutricionista(evento.target.checked)}
                  />
                  Nutricionista
                </label>
                {ehNutricionista && (
                  <input
                    type="text"
                    name="crn"
                    placeholder="CRN (opcional)"
                    className="mt-1 mb-2 w-full rounded-sm border border-rule bg-paper-raised px-3 py-2 text-sm outline-none transition-colors focus:border-sheipe"
                  />
                )}
                <label className="flex items-center gap-2.5 py-1 text-sm">
                  <input
                    type="checkbox"
                    name="ehPersonal"
                    checked={ehPersonal}
                    onChange={(evento) => setEhPersonal(evento.target.checked)}
                  />
                  Personal trainer
                </label>
                {ehPersonal && (
                  <input
                    type="text"
                    name="cref"
                    placeholder="CREF (opcional)"
                    className="mt-1 w-full rounded-sm border border-rule bg-paper-raised px-3 py-2 text-sm outline-none transition-colors focus:border-sheipe"
                  />
                )}
              </fieldset>

              <CampoEmail />
              <CampoSenha autoComplete="new-password" />
              {estado.erro && <p className="text-sm text-urgent">{estado.erro}</p>}
              <Botao rotulo="Criar conta" rotuloCarregando="Criando…" />
            </form>
          )}
        </div>
      </section>
    </main>
      {/* Flutuante aqui é seguro: o login fica fora do grupo (painel) e
          portanto não tem barra de abas no rodapé pra disputar. */}
      <ThemeToggle />
    </>
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
      className="tatil mt-2 rounded-sm bg-sheipe px-4 py-2.5 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
    >
      {pending ? rotuloCarregando : rotulo}
    </button>
  );
}
