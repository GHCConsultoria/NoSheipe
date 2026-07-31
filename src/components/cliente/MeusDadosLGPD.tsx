"use client";

import { useState, useTransition } from "react";
import { apagarMeusDados } from "@/lib/cliente/publico";

const PALAVRA_CONFIRMACAO = "APAGAR";

/**
 * Seção LGPD do perfil: baixar os próprios dados (link direto pra rota de
 * exportação) e apagá-los. A exclusão é irreversível e mata o link, então
 * exige digitar a palavra de confirmação; no sucesso a própria tela vira um
 * estado terminal (não dá pra navegar de volta — a página passa a devolver
 * 404 no próximo carregamento).
 */
export function MeusDadosLGPD({ token }: { token: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [apagado, setApagado] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  if (apagado) {
    return (
      <section className="mt-8">
        <h2 className="eyebrow mb-3">Seus dados</h2>
        <div className="paper-card rounded-sm p-4 text-sm">
          <p>Seus dados pessoais foram apagados e o acompanhamento foi encerrado. Este link não funciona mais.</p>
          <p className="mt-2 text-ink-soft">Se um dia quiser voltar, é só pedir um link novo ao seu profissional.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="eyebrow mb-3">Seus dados (LGPD)</h2>
      <div className="paper-card flex flex-col gap-3 rounded-sm p-4">
        <a
          href={`/api/cliente/dados?token=${encodeURIComponent(token)}`}
          className="tatil self-start rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
        >
          Baixar meus dados
        </a>

        {confirmando ? (
          <div className="flex flex-col gap-2 border-t border-rule pt-3">
            <p className="text-xs text-ink-soft">
              Isso apaga seus dados pessoais e encerra o acompanhamento — é irreversível. Pra confirmar, digite{" "}
              <strong>{PALAVRA_CONFIRMACAO}</strong>.
            </p>
            <input
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={PALAVRA_CONFIRMACAO}
              className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-urgent-line"
            />
            {erro && <p className="text-sm text-urgent">{erro}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pendente || confirmacao.trim().toUpperCase() !== PALAVRA_CONFIRMACAO}
                onClick={() =>
                  iniciarTransicao(async () => {
                    const resultado = await apagarMeusDados({ token });
                    if (!resultado.sucesso) {
                      setErro(resultado.erro);
                      return;
                    }
                    setApagado(true);
                  })
                }
                className="tatil rounded-sm bg-urgent px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pendente ? "Apagando…" : "Apagar definitivamente"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmando(false);
                  setErro(null);
                }}
                className="tatil rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirmando(true);
              setErro(null);
              setConfirmacao("");
            }}
            className="tatil self-start text-xs text-ink-faint underline underline-offset-2 transition-colors hover:text-urgent"
          >
            Apagar meus dados
          </button>
        )}
      </div>
    </section>
  );
}
