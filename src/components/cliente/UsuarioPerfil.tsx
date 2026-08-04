"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign } from "lucide-react";
import { definirUsuario } from "@/lib/cliente/publico";

/**
 * @usuário do cliente — o identificador público que ele escolhe, à parte do
 * nome. Mostra o atual e permite trocar; único no app.
 */
export function UsuarioPerfil({ token, usuarioInicial }: { token: string; usuarioInicial: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(!usuarioInicial);
  const [valor, setValor] = useState(usuarioInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function salvar() {
    setErro(null);
    iniciarTransicao(async () => {
      const r = await definirUsuario({ token, usuario: valor });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3">Seu @usuário</h2>
      {!editando && usuarioInicial ? (
        <div className="paper-card flex items-center justify-between gap-3 rounded-sm p-4">
          <span className="font-data text-sm text-ink">@{usuarioInicial}</span>
          <button
            type="button"
            onClick={() => {
              setValor(usuarioInicial);
              setEditando(true);
            }}
            className="text-xs text-ink-soft underline underline-offset-2 transition-colors hover:text-sheipe"
          >
            trocar
          </button>
        </div>
      ) : (
        <div className="paper-card flex flex-col gap-3 rounded-sm p-4">
          <div className="flex items-center gap-2 rounded-sm border border-rule bg-paper px-3 py-2 focus-within:border-sheipe">
            <AtSign size={15} className="shrink-0 text-ink-faint" />
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              maxLength={20}
              autoCapitalize="none"
              placeholder="seu_usuario"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {erro && <p className="text-sm text-urgent">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pendente || valor.trim().length < 3}
              onClick={salvar}
              className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
            >
              {pendente ? "Salvando…" : "Salvar"}
            </button>
            {usuarioInicial && (
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setErro(null);
                }}
                className="tatil rounded-sm border border-rule px-4 py-2 text-sm text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
