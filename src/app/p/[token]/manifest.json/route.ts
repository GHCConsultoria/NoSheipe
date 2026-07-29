import { NextResponse } from "next/server";
import { buscarClientePorToken } from "@/lib/cliente/consultas";

/**
 * Manifesto PWA por cliente — instalar na tela inicial abre direto no
 * link daquele cliente (start_url/scope presos ao token), não num app
 * genérico. Content-type próprio pra o navegador reconhecer como manifest.
 */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const cliente = await buscarClientePorToken(params.token);
  const nome = cliente ? cliente.nome : "NoSheipe";

  return NextResponse.json(
    {
      name: `NoSheipe — ${nome}`,
      short_name: "NoSheipe",
      description: "Registre o que você comeu e acompanhe sua aderência às metas.",
      start_url: `/p/${params.token}`,
      scope: `/p/${params.token}`,
      display: "standalone",
      background_color: "#0a0b0d",
      theme_color: "#16a34a",
      icons: [
        { src: "/icons/nosheipe-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/nosheipe-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "content-type": "application/manifest+json" } },
  );
}
