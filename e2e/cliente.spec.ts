import { expect, test } from "@playwright/test";

/**
 * Os fluxos de escrita do cliente, clicados num navegador de verdade.
 *
 * São exatamente os caminhos que passavam no build e nos testes de unidade
 * mas nunca tinham sido exercitados de ponta a ponta — registrar refeição
 * (que faz POST na API e chama a IA), registrar peso, e aceitar um pedido
 * de acompanhamento.
 *
 * Os tokens são fixos: vêm do seed (prisma/nutri/seed.ts).
 */

test.describe("cliente registra o dia", () => {
  test("registrar refeição faz o registro aparecer na lista", async ({ page }) => {
    await page.goto("/p/demo-marina-souza");

    const campo = page.getByPlaceholder(/peito de frango grelhado/i);
    await expect(campo).toBeVisible();

    const relato = "3 ovos mexidos e uma fatia de pão";
    await campo.fill(relato);
    await page.getByRole("button", { name: "Registrar refeição" }).click();

    // A IA está stubada (500 kcal); o registro persistido volta na lista.
    await expect(page.getByText(relato)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/500 kcal/).first()).toBeVisible();
  });

  test("remover uma refeição a tira da lista", async ({ page }) => {
    await page.goto("/p/demo-marina-souza");

    const relato = "refeição pra remover no teste";
    await page.getByPlaceholder(/peito de frango grelhado/i).fill(relato);
    await page.getByRole("button", { name: "Registrar refeição" }).click();
    await expect(page.getByText(relato)).toBeVisible({ timeout: 15_000 });

    // O botão de remover confirma via window.confirm — o Playwright cancela
    // diálogos por padrão, então é preciso aceitar explicitamente.
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: `Remover ${relato}` }).click();

    await expect(page.getByText(relato)).toBeHidden({ timeout: 10_000 });
  });

  test("registrar peso confirma sem erro", async ({ page }) => {
    await page.goto("/p/demo-marina-souza");

    await page.getByPlaceholder("ex.: 72.5").fill("70.4");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();

    // O campo limpa quando o registro entra — é o sinal de sucesso na UI.
    await expect(page.getByPlaceholder("ex.: 72.5")).toHaveValue("", { timeout: 10_000 });
  });
});

test.describe("cliente responde a um pedido de acompanhamento", () => {
  test("aceitar move o profissional de 'pediram' para 'quem te acompanha'", async ({ page }) => {
    // Rafael tem nutrição e um pedido de treino pendente do Bruno (seed).
    await page.goto("/p/demo-rafael-lima/perfil");

    const pediram = page.getByRole("heading", { name: "Pediram pra te acompanhar" });
    await expect(pediram).toBeVisible();
    await expect(page.getByText("Bruno Personal (demo)")).toBeVisible();

    await page.getByRole("button", { name: "Aceitar" }).click();

    // Some da seção de pedidos e passa a constar em quem acompanha.
    await expect(pediram).toBeHidden({ timeout: 10_000 });
    const acompanha = page.getByRole("heading", { name: "Quem te acompanha" }).locator("..");
    await expect(acompanha.getByText("Bruno Personal (demo)")).toBeVisible();

    // E o bloco de treino agora existe na Hoje — antes o Rafael só tinha
    // dieta. Como o Bruno ainda não prescreveu treino, o bloco aparece
    // avisando isso, o que já prova que o vínculo passou a valer.
    await page.goto("/p/demo-rafael-lima");
    await expect(page.getByText(/ainda não prescreveu um treino/i)).toBeVisible();
  });
});

test.describe("a barra de navegação do cliente", () => {
  test("troca de aba e marca a ativa", async ({ page }) => {
    await page.goto("/p/demo-marina-souza");
    const nav = page.getByRole("navigation", { name: "Navegação principal" });

    await nav.getByRole("link", { name: "Diário" }).click();
    await expect(page).toHaveURL(/\/historico$/);
    await expect(nav.getByRole("link", { name: "Diário" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Perfil" }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(nav.getByRole("link", { name: "Perfil" })).toHaveAttribute("aria-current", "page");
  });
});
