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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "nutricionistas_authUserId_key" ON "nutricionistas"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "nutricionistas_email_key" ON "nutricionistas"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pacientes_tokenAcesso_key" ON "pacientes"("tokenAcesso");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registros_refeicao_clienteRegistroId_key" ON "registros_refeicao"("clienteRegistroId");

