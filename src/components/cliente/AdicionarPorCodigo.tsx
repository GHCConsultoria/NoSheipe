"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { solicitarVinculo } from "@/lib/cliente/acoes";

interface Props {
  ehNutricionista: boolean;
  ehPersonal: boolean;
}

/**
 * Pedir pra acompanhar alguém que já usa o app — o cliente dita o código,
 * o profissional digita aqui. Quem tem as duas atuações escolhe qual lado
 * vai acompanhar; quem tem uma só nem vê a escolha.
 */
export function AdicionarPorCodigo({ ehNutricionista, ehPersonal }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"NUTRICAO" | "TREINO">(ehNutricionista ? "NUTRICAO" : "TREINO");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  const hibrido = ehNutricionista && ehPersonal;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-sm text-ink-soft transition-colors hover:text-sheipe"
      >
        já usa o NoSheipe? adicionar por código
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        setEnviado(null);
        iniciarTransicao(async () => {
          const resultado = await solicitarVinculo({ codigoConvite: codigo, tipo });
          if (!resultado.sucesso) {
            setErro(resultado.erro);
            return;
          }
          setCodigo("");
          setEnviado(resultado.nome);
          router.refresh();
        });
      }}
      className="paper-card flex flex-col gap-3 rounded-sm p-4"
    >
      <h2 className="eyebrow">Adicionar por código</h2>
      <p className="-mt-1 text-xs text-ink-faint">
        Peça ao cliente o código de 6 caracteres que aparece na página dele. Ele recebe o pedido e precisa aceitar.
      </p>

      <input
        type="text"
        required
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        placeholder="ABC234"
        maxLength={8}
        autoCapitalize="characters"
        autoComplete="off"
        className="font-data w-full rounded-sm border border-rule bg-paper px-3 py-2 text-center text-lg tracking-[0.2em] outline-none focus:border-sheipe"
      />

      {hibrido && (
        <div className="flex gap-4 text-sm">
          {(["NUTRICAO", "TREINO"] as const).map((opcao) => (
            <label key={opcao} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="tipo"
                checked={tipo === opcao}
                onChange={() => setTipo(opcao)}
                className="accent-sheipe"
              />
              {opcao === "NUTRICAO" ? "nutrição" : "treino"}
            </label>
          ))}
        </div>
      )}

      {erro && <p className="text-sm text-urgent">{erro}</p>}
      {enviado && !erro && <p className="text-sm text-calm">Pedido enviado pra {enviado} — falta ele aceitar.</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendente || !codigo.trim()}
          className="tatil rounded-sm bg-sheipe px-4 py-2 text-sm font-medium text-sheipe-on shadow-sm transition-colors hover:bg-sheipe-deep disabled:opacity-50"
        >
          {pendente ? "Enviando…" : "Pedir acompanhamento"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
            setEnviado(null);
          }}
          className="rounded-sm border border-rule px-3 py-2 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
