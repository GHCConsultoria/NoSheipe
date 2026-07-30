import { expect, test } from "@playwright/test";

/**
 * O painel do profissional, sem auth real.
 *
 * Sem Supabase configurado (ver playwright.config), o app resolve tudo pro
 * "Profissional Demo" do seed — que é híbrido e dono dos clientes de
 * exemplo. Isso deixa exercitar o painel e o cadastro de cliente, que é um
 * Server Action (POST), sem precisar montar autenticação.
 */

test.describe("painel do profissional", () => {
  test("abre com os clientes do seed e a barra de abas", async ({ page }) => {
    await page.goto("/pro");

    await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
    await expect(page.getByText("Marina Souza")).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  });

  test("abrir a ficha de um cliente mantém a aba Clientes ativa", async ({ page }) => {
    await page.goto("/pro");
    await page.getByText("Marina Souza").click();

    await expect(page).toHaveURL(/\/pro\/clientes\//);
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    // Foi o bug que a barra nova expôs: ficha aninhada não marcava aba nenhuma.
    await expect(nav.getByRole("link", { name: "Clientes" })).toHaveAttribute("aria-current", "page");
  });

  test("cadastrar um cliente novo o faz aparecer no painel", async ({ page }) => {
    await page.goto("/pro/clientes/novo");

    const nome = `Teste E2E ${Date.now()}`;
    await page.getByLabel("Nome", { exact: true }).fill(nome);

    // Demo é híbrido: começa com os dois desmarcados, escolhe nutrição.
    await page.getByRole("checkbox", { name: "Nutrição" }).check();

    await page.getByLabel("Meta kcal").fill("2000");
    await page.getByLabel("Proteína (g)").fill("150");
    await page.getByLabel("Carbo (g)").fill("200");
    await page.getByLabel("Gordura (g)").fill("60");

    await page.getByRole("button", { name: "Cadastrar cliente" }).click();

    await expect(page).toHaveURL(/\/pro$/, { timeout: 15_000 });
    await expect(page.getByText(nome)).toBeVisible();
  });
});
