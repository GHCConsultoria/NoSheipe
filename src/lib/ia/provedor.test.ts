import { describe, expect, it } from "vitest";
import { extrairTexto, montarRequisicao, selecionarProvedor, type Provedor } from "./provedor";

describe("selecionarProvedor", () => {
  it("sem preferência, prefere Groq (o gratuito) quando as duas chaves existem", () => {
    const p = selecionarProvedor({ GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    expect(p?.nome).toBe("groq");
  });

  it("usa Anthropic quando só a chave dele existe", () => {
    const p = selecionarProvedor({ ANTHROPIC_API_KEY: "a" });
    expect(p?.nome).toBe("anthropic");
  });

  it("respeita IA_PROVEDOR explícito, se a chave correspondente existir", () => {
    const p = selecionarProvedor({ IA_PROVEDOR: "anthropic", GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    expect(p?.nome).toBe("anthropic");
  });

  it("ignora a preferência quando a chave dela falta, caindo pra que existe", () => {
    const p = selecionarProvedor({ IA_PROVEDOR: "anthropic", GROQ_API_KEY: "g" });
    expect(p?.nome).toBe("groq");
  });

  it("aplica o modelo padrão de cada provedor, e o override quando vem", () => {
    expect(selecionarProvedor({ GROQ_API_KEY: "g" })?.modelo).toMatch(/llama/);
    expect(selecionarProvedor({ GROQ_API_KEY: "g", GROQ_MODEL: "outro" })?.modelo).toBe("outro");
  });

  it("devolve null quando nenhuma chave existe", () => {
    expect(selecionarProvedor({})).toBeNull();
  });
});

describe("montarRequisicao", () => {
  it("Groq: dialeto OpenAI, Bearer e chat/completions", () => {
    const provedor: Provedor = { nome: "groq", apiKey: "chave-g", modelo: "llama-x" };
    const req = montarRequisicao(provedor, "oi", 800);
    expect(req.url).toContain("api.groq.com");
    expect(req.headers.authorization).toBe("Bearer chave-g");
    const corpo = JSON.parse(req.body);
    expect(corpo.model).toBe("llama-x");
    expect(corpo.max_tokens).toBe(800);
    expect(corpo.messages).toEqual([{ role: "user", content: "oi" }]);
  });

  it("Anthropic: x-api-key, versão e /v1/messages", () => {
    const provedor: Provedor = { nome: "anthropic", apiKey: "chave-a", modelo: "claude-x" };
    const req = montarRequisicao(provedor, "oi", 800);
    expect(req.url).toContain("api.anthropic.com");
    expect(req.headers["x-api-key"]).toBe("chave-a");
    expect(req.headers["anthropic-version"]).toBe("2023-06-01");
    expect(JSON.parse(req.body).model).toBe("claude-x");
  });
});

describe("extrairTexto", () => {
  const groq: Provedor = { nome: "groq", apiKey: "g", modelo: "m" };
  const anthropic: Provedor = { nome: "anthropic", apiKey: "a", modelo: "m" };

  it("Groq: pega choices[0].message.content", () => {
    expect(extrairTexto(groq, { choices: [{ message: { content: "resposta" } }] })).toBe("resposta");
  });

  it("Anthropic: pega o primeiro bloco de texto", () => {
    expect(extrairTexto(anthropic, { content: [{ type: "text", text: "resposta" }] })).toBe("resposta");
  });

  it("devolve null quando a resposta não tem texto (cada formato)", () => {
    expect(extrairTexto(groq, { choices: [] })).toBeNull();
    expect(extrairTexto(anthropic, { content: [{ type: "tool_use" }] })).toBeNull();
    expect(extrairTexto(groq, {})).toBeNull();
  });
});
