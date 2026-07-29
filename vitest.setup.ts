import process from "node:process";

try {
  process.loadEnvFile();
} catch {
  // sem .env local (ex.: variáveis já injetadas pelo ambiente de CI)
}
