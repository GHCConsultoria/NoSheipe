import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regressão de um vazamento real: com a checagem de `ehMaster` só no
 * layout, a resposta saía 404 **com o payload do admin dentro** — layout e
 * page renderizam em paralelo, então o notFound() do layout trocava o
 * status sem impedir a page de consultar o banco e serializar o
 * resultado. Medido: 13 KB de resposta 404 contendo métricas e o e-mail do
 * profissional; 4,6 KB depois da correção.
 *
 * Não dá pra exercitar isso em vitest sem subir o Next inteiro, então o
 * que se protege aqui é a condição que causou o bug: a page precisa fazer
 * a própria checagem, antes de qualquer consulta. É um teste de estrutura,
 * e diz isso abertamente — some no dia em que houver teste de ponta a
 * ponta com o servidor de pé.
 */

const DIRETORIO = path.dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(path.join(DIRETORIO, "layout.tsx"), "utf8");

/**
 * Toda página sob /master, com a consulta que ela dispara. Qualquer rota
 * nova aqui embaixo precisa entrar nesta lista — a de cliente carrega dado
 * clínico, então é onde o vazamento custaria mais caro.
 */
const PAGINAS: { caminho: string; primeiraConsulta: string }[] = [
  { caminho: "page.tsx", primeiraConsulta: "buscarMetricasGerais(" },
  { caminho: "clientes/[id]/page.tsx", primeiraConsulta: "buscarClienteCompleto(" },
];

describe("guarda de acesso do /master", () => {
  for (const { caminho, primeiraConsulta } of PAGINAS) {
    const fonte = readFileSync(path.join(DIRETORIO, caminho), "utf8");

    it(`${caminho} confere ehMaster por conta própria`, () => {
      expect(fonte).toContain("obterMasterAtual");
      expect(fonte).toContain("notFound()");
    });

    it(`${caminho} checa antes de consultar o banco`, () => {
      const posicaoChecagem = fonte.indexOf("notFound()");
      const posicaoConsulta = fonte.indexOf(primeiraConsulta);
      expect(posicaoChecagem).toBeGreaterThan(-1);
      expect(posicaoConsulta).toBeGreaterThan(posicaoChecagem);
    });
  }

  it("o layout continua como segunda barreira", () => {
    expect(layout).toContain("obterMasterAtual");
    expect(layout).toContain("notFound()");
  });
});
