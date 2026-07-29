import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "../../../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { OrigemRegistro, StatusPaciente } from "@/lib/nutri/schemas";
import { extrairMacros, IaRespostaInvalidaError, IaNaoConfiguradaError } from "@/lib/nutri/ia";

const corpoSchema = z.object({
  token: z.string().min(1),
  clientLogId: z.string().uuid("clientLogId deve ser um UUID"),
  rawText: z.string().trim().min(1, "descreva o que você comeu"),
  origem: z.nativeEnum(OrigemRegistro).default(OrigemRegistro.TEXTO),
});

function serializarRegistro(registro: {
  id: string;
  entradaBruta: string;
  itens: string;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
  confianca: number;
  registradoEm: Date;
}) {
  return {
    id: registro.id,
    entradaBruta: registro.entradaBruta,
    itens: JSON.parse(registro.itens),
    kcal: registro.kcal,
    proteina: registro.proteina,
    carbo: registro.carbo,
    gordura: registro.gordura,
    confianca: registro.confianca,
    registradoEm: registro.registradoEm.toISOString(),
  };
}

/**
 * Recebe o relato de refeição do paciente (texto digitado ou transcrição de
 * áudio — os dois chegam aqui já como texto, `origem` só rotula a origem),
 * chama a IA pra extrair macros e salva. Sem sessão nenhuma: o token do
 * paciente na própria requisição é a credencial, igual ao resto da página
 * /p/[token].
 */
export async function POST(request: NextRequest) {
  const corpoBruto: unknown = await request.json().catch(() => null);
  const parsed = corpoSchema.safeParse(corpoBruto);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? "payload inválido" }, { status: 400 });
  }

  const paciente = await prismaNutri.paciente.findUnique({ where: { tokenAcesso: parsed.data.token } });
  if (!paciente || paciente.status !== StatusPaciente.ATIVO) {
    return NextResponse.json({ erro: "paciente não encontrado" }, { status: 404 });
  }
  if (!paciente.consentimentoEm) {
    return NextResponse.json({ erro: "consentimento obrigatório antes de registrar" }, { status: 403 });
  }

  // Idempotência: reprocessar o mesmo clientLogId nunca duplica nem chama a
  // IA de novo — devolve o registro já salvo.
  const existente = await prismaNutri.registroRefeicao.findUnique({
    where: { clienteRegistroId: parsed.data.clientLogId },
  });
  if (existente) {
    return NextResponse.json({ sucesso: true, registro: serializarRegistro(existente) });
  }

  let macros;
  try {
    macros = await extrairMacros(parsed.data.rawText);
  } catch (erro) {
    if (erro instanceof IaRespostaInvalidaError || erro instanceof IaNaoConfiguradaError) {
      return NextResponse.json({ erro: erro.message }, { status: 422 });
    }
    throw erro;
  }

  try {
    const registro = await prismaNutri.registroRefeicao.create({
      data: {
        pacienteId: paciente.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: parsed.data.origem,
        entradaBruta: parsed.data.rawText,
        itens: JSON.stringify(macros.items),
        kcal: Math.round(macros.totals.kcal),
        proteina: Math.round(macros.totals.protein),
        carbo: Math.round(macros.totals.carbs),
        gordura: Math.round(macros.totals.fat),
        confianca: macros.confidence,
      },
    });
    return NextResponse.json({ sucesso: true, registro: serializarRegistro(registro) });
  } catch (erro) {
    // Corrida entre duas requisições com o mesmo clientLogId (ex.: duplo
    // clique) — a unique constraint pegou, então o registro já existe;
    // devolve ele em vez de propagar o erro de constraint pro client.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      const jaSalvo = await prismaNutri.registroRefeicao.findUnique({
        where: { clienteRegistroId: parsed.data.clientLogId },
      });
      if (jaSalvo) {
        return NextResponse.json({ sucesso: true, registro: serializarRegistro(jaSalvo) });
      }
    }
    throw erro;
  }
}
