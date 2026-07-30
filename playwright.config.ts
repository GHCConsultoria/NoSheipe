import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * Teste de ponta a ponta com navegador de verdade.
 *
 * Existe pra fechar a lacuna que quebrou o PR #2 em runtime: os fluxos de
 * ESCRITA — registrar refeição, criar cliente, aceitar vínculo — passavam
 * no build e nos testes de unidade, mas ninguém tinha CLICADO neles até
 * chegar em produção. Aqui um Chromium clica.
 *
 * Hermético de propósito: banco SQLite em arquivo, IA com resposta fixa
 * (IA_STUB_JSON), Supabase desligado — o que faz o app cair no
 * "Profissional Demo" e deixa o painel navegável sem auth real. Nada sai
 * pra rede.
 */

const BANCO = path.join(__dirname, ".e2e", "teste.db");
const PORTA = 3799;
const IA_STUB_JSON = JSON.stringify({
  items: [{ name: "refeição de teste", grams: 200, kcal: 500, protein: 30, carbs: 55, fat: 18 }],
  totals: { kcal: 500, protein: 30, carbs: 55, fat: 18 },
  confidence: 0.8,
});

// Passado pro servidor e pro global-setup: os dois precisam do MESMO banco.
const ambiente = {
  TURSO_DATABASE_URL: `file:${BANCO}`,
  IA_STUB_JSON,
  // Supabase deliberadamente ausente — dispara o fallback do demo.
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORTA}`,
    trace: "off",
    launchOptions: {
      // Chromium já vem no ambiente; nunca baixar (ver PLAYWRIGHT_BROWSERS_PATH).
      executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // O ciclo de vida do banco vive inteiro aqui, em ordem, antes do
    // servidor ouvir: apaga o de antes, recria a pasta (libSQL não cria a
    // pasta-pai sozinho), aplica o schema, semeia e sobe. O build é feito à
    // parte. Não há globalSetup de propósito — apagar o banco em paralelo
    // com este comando era uma corrida que esvaziava o banco no meio.
    command:
      `rm -rf "${path.dirname(BANCO)}" && mkdir -p "${path.dirname(BANCO)}" ` +
      `&& node prisma/nutri/aplicar-schema.mjs && npx tsx prisma/nutri/seed.ts ` +
      `&& npx next start -p ${PORTA}`,
    url: `http://127.0.0.1:${PORTA}/pro/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: ambiente,
  },
});

export { BANCO, ambiente };
