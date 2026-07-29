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

