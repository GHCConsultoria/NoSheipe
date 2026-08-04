"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { criarOferta, removerOferta } from "@/lib/cliente/acoes";
import type { OfertaDoProfissional } from "@/lib/profissional/consultas";

/**
 * Gerência das ofertas do Marketplace — o profissional publica um produto
 * avulso (título, descrição, preço) que aparece pros clientes dele. Checkout
 * e cashback ficam pra quando o meio de pagamento for definido.
 */
export function GerenciarOfertas({ ofertas }: { ofertas: OfertaDoProfissional[] }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  function publicar() {
    setErro(null);
    iniciarTransicao(async () => {
      const r = await criarOferta({ titulo, descricao, precoReais: preco });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setTitulo("");
      setDescricao("");
      setPreco("");
      router.refresh();
    });
  }

  return (
    <section className="paper-card mt-4 flex flex-col gap-3 rounded-sm p-5">
      <div>
        <h2 className="eyebrow">Marketplace</h2>
        <p className="mt-1 text-sm text-ink-soft">Ofertas avulsas que seus clientes veem na loja deles.</p>
      </div>

      {ofertas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {ofertas.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 rounded-sm border border-rule p-3">
              <div className="min-w-0">
                <p className="text-sm">
                  {o.titulo} <span className="font-data text-sheipe">{o.preco}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{o.descricao}</p>
              </div>
              <button
                type="button"
                disabled={pendente}
                aria-label={`Remover ${o.titulo}`}
                onClick={() =>
                  iniciarTransicao(async () => {
                    await removerOferta({ ofertaId: o.id });
                    router.refresh();
                  })
                }
                className="tatil shrink-0 text-ink-faint transition-colors hover:text-urgent disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 border-t border-rule pt-3">
        <input
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          placeholder="Título (ex.: Treino avulso de 4 semanas)"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Descrição"
          className="w-full rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          placeholder="Preço (R$)"
          className="w-40 rounded-sm border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-sheipe"
        />
        {erro && <p className="text-sm text-urgent">{erro}</p>}
        <button
          type="button"
          disabled={pendente || !titulo.trim() || !descricao.trim() || !preco.trim()}
          onClick={publicar}
          className="tatil self-start rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Publicando…" : "Publicar oferta"}
        </button>
      </div>
    </section>
  );
}
