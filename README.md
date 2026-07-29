# NoSheipe

MVP "Trilha A": demo para validar a tese de acompanhamento nutricional com
nutricionistas — nutricionista cadastra paciente e metas; paciente registra
refeição por áudio/texto; a IA extrai os macros; painel de aderência mostra
quem está batendo a meta. É um demo de descoberta, não o produto final.

## Como rodar

```bash
npm install
cp .env.example .env   # preencher Supabase Auth + Turso + Anthropic
npm run db:push:nutri  # aplica o schema no Turso
npm run db:seed:nutri  # semeia o nutricionista demo
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) — redireciona pra `/nutri/login`.

## Stack

Next.js 14 (App Router) · TypeScript · Prisma · **Turso (libSQL/SQLite)** ·
Supabase Auth · Tailwind · Zod · Anthropic · deploy Vercel.

## Arquitetura

- Rotas: `/nutri/login` (signup/login do nutricionista, self-service), `/nutri`
  (painel, protegido), `/p/[token]` (página do paciente, sem senha)
- Código: `src/lib/nutri/*` (lógica de domínio), `src/app/nutri/*`, `src/app/p/*`
- **Banco (Turso)**: `Nutricionista`, `Paciente`, `RegistroRefeicao` em
  `prisma/nutri/schema.prisma`. SQLite/Turso não tem enum nem `Json` nativos do
  Prisma — `status`/`origem` são `String` (valores documentados em
  `src/lib/nutri/schemas.ts`), e `itens` é JSON serializado manualmente.
  `prisma db push`/`migrate` recusam URL `libsql://` (exigem `file:`), então o
  schema é aplicado direto via `@libsql/client` (`prisma/nutri/aplicar-schema.mjs`,
  gerado a partir de `prisma migrate diff --from-empty`, idempotente com
  `IF NOT EXISTS`) — isso roda automaticamente no build quando
  `TURSO_DATABASE_URL` está configurada.
- **Auth**: Supabase Auth usado só como serviço de autenticação (GoTrue),
  independente de onde os dados da aplicação ficam guardados. Cadastro é
  self-service — o nutricionista é o cliente direto do produto.
- **Estimativa de macros por IA**: a IA (Anthropic) extrai itens e macros do
  texto/transcrição do paciente. É uma **estimativa**, rotulada como tal na
  interface. Para produção, precisa ser ancorada nas tabelas TACO/TBCA + uma
  base de industrializados — o LLM sozinho erra macro de marmita, PF, açaí.
- **Registro por áudio**: transcrição via Web Speech API do navegador
  (`src/components/nutri/useReconhecimentoDeFala.ts`) — funciona bem em
  Chrome/Android, suporte limitado em Safari/iOS (o botão de gravação some
  quando o navegador não suporta). Uma vez transcrito, entra pelo mesmo
  caminho do texto.
- **Tema claro/escuro**: segue o sistema por padrão; botão flutuante deixa
  escolher manualmente (persistido em `localStorage`, aplicado antes do
  primeiro paint pra evitar flash).
- **PWA por paciente**: cada paciente tem manifesto próprio em
  `/p/[token]/manifest.json` — instalar na tela inicial abre direto no link
  daquele paciente.

## Não-negociáveis do domínio

1. O app nunca prescreve — metas sempre vêm do nutricionista.
2. Sem consentimento LGPD (`consentimentoEm`), o paciente não registra nada.
3. Registro de refeição é idempotente por `clienteRegistroId`.
4. Nenhuma exclusão física de dados — paciente arquivado, nunca apagado.
5. Zod em toda entrada e na saída da IA.
