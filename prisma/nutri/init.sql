-- CreateTable
CREATE TABLE IF NOT EXISTS "profissionais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authUserId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ehNutricionista" BOOLEAN NOT NULL DEFAULT false,
    "ehPersonal" BOOLEAN NOT NULL DEFAULT false,
    "crn" TEXT,
    "cref" TEXT,
    "limitePlano" INTEGER NOT NULL DEFAULT 20,
    "ehMaster" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "nutricionistas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authUserId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "crn" TEXT,
    "limitePlano" INTEGER NOT NULL DEFAULT 20,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pacientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nutricionistaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "tokenAcesso" TEXT NOT NULL,
    "metaKcal" INTEGER NOT NULL,
    "metaProteina" INTEGER NOT NULL,
    "metaCarbo" INTEGER NOT NULL,
    "metaGordura" INTEGER NOT NULL,
    "consentimentoEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "pacientes_nutricionistaId_fkey" FOREIGN KEY ("nutricionistaId") REFERENCES "nutricionistas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "registros_refeicao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pacienteId" TEXT NOT NULL,
    "clienteRegistroId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "entradaBruta" TEXT NOT NULL,
    "itens" TEXT NOT NULL,
    "kcal" INTEGER NOT NULL,
    "proteina" INTEGER NOT NULL,
    "carbo" INTEGER NOT NULL,
    "gordura" INTEGER NOT NULL,
    "confianca" REAL NOT NULL,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_refeicao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "registros_medida" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pacienteId" TEXT NOT NULL,
    "pesoKg" REAL NOT NULL,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_medida_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "anotacoes_paciente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pacienteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anotacoes_paciente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refeicoes_favoritas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pacienteId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refeicoes_favoritas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "personal_trainers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authUserId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cref" TEXT,
    "limitePlano" INTEGER NOT NULL DEFAULT 20,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "alunos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personalTrainerId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "tokenAcesso" TEXT NOT NULL,
    "consentimentoEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "alunos_personalTrainerId_fkey" FOREIGN KEY ("personalTrainerId") REFERENCES "personal_trainers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "treinos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alunoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "diasPorSemana" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "treinos_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "registros_treino" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alunoId" TEXT NOT NULL,
    "clienteRegistroId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "entradaBruta" TEXT NOT NULL,
    "realizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registros_treino_alunoId_fkey" FOREIGN KEY ("alunoId") REFERENCES "alunos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
-- Dono unificado de paciente/aluno. O SQLite não tem "ADD COLUMN IF NOT
-- EXISTS": a partir da segunda execução isto falha com "duplicate column
-- name", que aplicar-schema.mjs trata como "já aplicado" e ignora.
ALTER TABLE "pacientes" ADD COLUMN "profissionalId" TEXT REFERENCES "profissionais" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "alunos" ADD COLUMN "profissionalId" TEXT REFERENCES "profissionais" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "profissionais_authUserId_key" ON "profissionais"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "profissionais_email_key" ON "profissionais"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "nutricionistas_authUserId_key" ON "nutricionistas"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "nutricionistas_email_key" ON "nutricionistas"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pacientes_tokenAcesso_key" ON "pacientes"("tokenAcesso");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registros_refeicao_clienteRegistroId_key" ON "registros_refeicao"("clienteRegistroId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "personal_trainers_authUserId_key" ON "personal_trainers"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "personal_trainers_email_key" ON "personal_trainers"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "alunos_tokenAcesso_key" ON "alunos"("tokenAcesso");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registros_treino_clienteRegistroId_key" ON "registros_treino"("clienteRegistroId");


-- ============================================================
-- Era do Cliente unificado (Fase 2).
-- As tabelas acima (pacientes, alunos e seus registros) ficam
-- intactas mas deixam de ser lidas — nenhuma exclusão física.
-- ============================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "tokenAcesso" TEXT NOT NULL,
    "codigoConvite" TEXT NOT NULL,
    "consentimentoEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "dataNascimento" DATETIME,
    "sexo" TEXT,
    "alturaCm" INTEGER,
    "objetivo" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vinculos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceitoEm" DATETIME,
    CONSTRAINT "vinculos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vinculos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "planos_nutricionais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "metaKcal" INTEGER NOT NULL,
    "metaProteina" INTEGER NOT NULL,
    "metaCarbo" INTEGER NOT NULL,
    "metaGordura" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "planos_nutricionais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "treinos_prescritos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "diasPorSemana" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "treinos_prescritos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refeicoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "clienteRegistroId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "entradaBruta" TEXT NOT NULL,
    "itens" TEXT NOT NULL,
    "kcal" INTEGER NOT NULL,
    "proteina" INTEGER NOT NULL,
    "carbo" INTEGER NOT NULL,
    "gordura" INTEGER NOT NULL,
    "confianca" REAL NOT NULL,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refeicoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sessoes_treino" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "clienteRegistroId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "entradaBruta" TEXT NOT NULL,
    "realizadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessoes_treino_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "medidas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "pesoKg" REAL NOT NULL,
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medidas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "anotacoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anotacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "anotacoes_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "favoritos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favoritos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "anamnese_nutricional" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "jaSeguiuDieta" BOOLEAN,
    "restricoesAlimentares" TEXT,
    "usaSuplemento" BOOLEAN,
    "refeicoesPorDia" INTEGER,
    "consumoAlcool" TEXT,
    "observacoes" TEXT,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "anamnese_nutricional_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "anamnese_treino" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "experiencia" TEXT,
    "lesoesLimitacoes" TEXT,
    "frequenciaAtual" INTEGER,
    "praticaOutroEsporte" TEXT,
    "observacoes" TEXT,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "anamnese_treino_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tokenAcesso_key" ON "clientes"("tokenAcesso");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_codigoConvite_key" ON "clientes"("codigoConvite");

-- CreateIndex
-- Fase 2 criou este índice como unique simples, o que impedia guardar o
-- histórico: trocar de nutricionista exigiria sobrescrever a linha do
-- anterior. Substituído pelo índice parcial logo abaixo. DROP é seguro e
-- idempotente — se já foi trocado, não existe mais nada pra derrubar.
DROP INDEX IF EXISTS "vinculos_clienteId_tipo_key";

-- CreateIndex
-- A regra "um nutricionista e um personal por cliente" vale só entre
-- vínculos vivos. Encerrados ficam para sempre, quantos forem, como
-- registro de quem atendeu quem. SQLite suporta índice parcial, coisa que
-- o Prisma não sabe declarar no schema, então mora aqui.
CREATE UNIQUE INDEX IF NOT EXISTS "vinculos_cliente_tipo_vivo"
    ON "vinculos"("clienteId", "tipo") WHERE "status" <> 'ENCERRADO';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vinculos_clienteId_tipo_idx" ON "vinculos"("clienteId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refeicoes_clienteRegistroId_key" ON "refeicoes"("clienteRegistroId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sessoes_treino_clienteRegistroId_key" ON "sessoes_treino"("clienteRegistroId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "anamnese_nutricional_clienteId_key" ON "anamnese_nutricional"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "anamnese_treino_clienteId_key" ON "anamnese_treino"("clienteId");

-- AlterTable
-- Remoção de registro é mudança de status (marca a hora), nunca DELETE — a
-- extensão em src/lib/nutri/prisma.ts esconde o que tem removidoEm de toda
-- leitura. ALTER ADD COLUMN não tem "IF NOT EXISTS" no SQLite; aplicar-schema
-- tolera o "duplicate column name" da segunda passada, então isto é idempotente.
ALTER TABLE "refeicoes" ADD COLUMN "removidoEm" DATETIME;
ALTER TABLE "sessoes_treino" ADD COLUMN "removidoEm" DATETIME;

-- AlterTable
-- Registro de refeição não pode travar quando a IA de macros está fora (sem
-- cota, sem chave): a refeição entra com macro zerado e esta flag ligada,
-- pra estimar depois. Idempotente do mesmo jeito que os ALTERs acima.
ALTER TABLE "refeicoes" ADD COLUMN "macrosPendentes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- A pessoa pode corrigir os macros na mão; esta flag rotula "ajustado por
-- você" em vez de "estimativa". Idempotente como os ALTERs acima.
ALTER TABLE "refeicoes" ADD COLUMN "ajustadoManualmente" BOOLEAN NOT NULL DEFAULT false;
