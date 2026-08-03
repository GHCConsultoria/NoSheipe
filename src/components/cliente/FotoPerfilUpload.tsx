"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { AvatarCliente } from "@/components/cliente/AvatarCliente";
import { removerFotoPerfil, salvarFotoPerfil } from "@/lib/cliente/publico";

/**
 * Recorta a foto num quadrado central e reduz pra 256px no próprio aparelho,
 * devolvendo um data URL JPEG leve (~15 KB). O recorte quadrado no cliente
 * evita foto esticada no avatar redondo e mantém o corpo pequeno.
 */
async function fotoQuadradaBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const lado = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - lado) / 2;
  const sy = (bitmap.height - lado) / 2;

  const alvo = 256;
  const canvas = document.createElement("canvas");
  canvas.width = alvo;
  canvas.height = alvo;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, alvo, alvo);

  return canvas.toDataURL("image/jpeg", 0.72);
}

interface Props {
  token: string;
  nome: string;
  fotoUrl: string | null;
}

/** Topo da tela de Perfil: a foto grande, o nome e os controles de trocar/remover. */
export function FotoPerfilUpload({ token, nome, fotoUrl }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function trocar(file: File) {
    setErro(null);
    iniciarTransicao(async () => {
      let dataUrl: string;
      try {
        dataUrl = await fotoQuadradaBase64(file);
      } catch {
        setErro("não consegui ler essa imagem — tente outra");
        return;
      }
      const r = await salvarFotoPerfil({ token, fotoBase64: dataUrl });
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pendente}
        aria-label="Trocar foto de perfil"
        className="tatil relative disabled:opacity-50"
      >
        <AvatarCliente fotoUrl={fotoUrl} nome={nome} tamanho={72} className="shadow-md" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper-raised text-ink-soft shadow-sm">
          <Camera size={13} strokeWidth={1.75} />
        </span>
      </button>

      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl">{nome}</h1>
        <div className="mt-1 flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pendente}
            className="text-ink-soft underline underline-offset-2 transition-colors hover:text-sheipe disabled:opacity-50"
          >
            {pendente ? "salvando…" : fotoUrl ? "trocar foto" : "adicionar foto"}
          </button>
          {fotoUrl && (
            <button
              type="button"
              onClick={() =>
                iniciarTransicao(async () => {
                  setErro(null);
                  const r = await removerFotoPerfil({ token });
                  if (!r.sucesso) setErro(r.erro);
                  router.refresh();
                })
              }
              disabled={pendente}
              className="text-ink-faint underline underline-offset-2 transition-colors hover:text-urgent disabled:opacity-50"
            >
              remover
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) trocar(file);
        }}
      />
      {erro && <p className="text-sm text-urgent">{erro}</p>}
    </div>
  );
}
