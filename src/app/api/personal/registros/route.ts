import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "../../../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { OrigemRegistroTreino, StatusAluno } from "@/lib/personal/schemas";

const corpoSchema = z.object({
  token: z.string().min(1),
  clientLogId: z.string().uuid("clientLogId deve ser um UUID"),
  rawText: z.string().trim().min(1, "descreva o treino"),
  origem: z.nativeEnum(OrigemRegistroTreino).default(OrigemRegistroTreino.TEXTO),
});

function serializarRegistro(registro: { id: string; entradaBruta: string; realizadoEm: Date }) {
  return {
    id: registro.id,
    entradaBruta: registro.entradaBruta,
    realizadoEm: registro.realizadoEm.toISOString(),
  };
}

/**
 * Recebe o check-in de treino do aluno (texto digitado ou transcrição de
 * áudio). Diferente do registro de refeição, não passa por IA — é só o
 * relato livre do que foi treinado. O token do aluno na própria requisição
 * é a credencial, igual ao resto da página /t/[token].
 */
export async function POST(request: NextRequest) {
  const corpoBruto: unknown = await request.json().catch(() => null);
  const parsed = corpoSchema.safeParse(corpoBruto);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? "payload inválido" }, { status: 400 });
  }

  const aluno = await prismaNutri.aluno.findUnique({ where: { tokenAcesso: parsed.data.token } });
  if (!aluno || aluno.status !== StatusAluno.ATIVO) {
    return NextResponse.json({ erro: "aluno não encontrado" }, { status: 404 });
  }
  if (!aluno.consentimentoEm) {
    return NextResponse.json({ erro: "consentimento obrigatório antes de registrar" }, { status: 403 });
  }

  // Idempotência: reprocessar o mesmo clientLogId nunca duplica.
  const existente = await prismaNutri.registroTreino.findUnique({
    where: { clienteRegistroId: parsed.data.clientLogId },
  });
  if (existente) {
    return NextResponse.json({ sucesso: true, registro: serializarRegistro(existente) });
  }

  try {
    const registro = await prismaNutri.registroTreino.create({
      data: {
        alunoId: aluno.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: parsed.data.origem,
        entradaBruta: parsed.data.rawText,
      },
    });
    return NextResponse.json({ sucesso: true, registro: serializarRegistro(registro) });
  } catch (erro) {
    // Corrida entre duas requisições com o mesmo clientLogId (ex.: duplo
    // clique) — a unique constraint pegou, então o registro já existe.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      const jaSalvo = await prismaNutri.registroTreino.findUnique({
        where: { clienteRegistroId: parsed.data.clientLogId },
      });
      if (jaSalvo) {
        return NextResponse.json({ sucesso: true, registro: serializarRegistro(jaSalvo) });
      }
    }
    throw erro;
  }
}
