import { NextRequest, NextResponse } from "next/server";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusCliente } from "@/lib/cliente/schemas";
import { montarExportacao } from "@/lib/cliente/exportacao";

/**
 * Download dos próprios dados (LGPD, direito de acesso/portabilidade). Sem
 * sessão: o token na URL é a credencial, igual ao resto de /p/[token]. Volta
 * um JSON com Content-Disposition de anexo, pra o navegador baixar um arquivo
 * em vez de exibir.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ erro: "token ausente" }, { status: 400 });
  }

  const cliente = await prismaNutri.cliente.findUnique({ where: { tokenAcesso: token } });
  if (!cliente || cliente.status !== StatusCliente.ATIVO) {
    return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });
  }

  const dados = await montarExportacao(cliente.id);
  const corpo = JSON.stringify(dados, null, 2);

  return new NextResponse(corpo, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="meus-dados-nosheipe.json"',
      "cache-control": "no-store",
    },
  });
}
