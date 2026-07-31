import { describe, expect, it } from "vitest";
import { extrairTexto, montarRequisicao, selecionarProvedor, type Provedor } from "./provedor";

describe("selecionarProvedor", () => {
  it("usa Gemini quando só a chave dele existe", () => {
    expect(selecionarProvedor({ GEMINI_API_KEY: "gm" })?.nome).toBe("gemini");
  });

  it("sem preferência, os gratuitos vêm primeiro: Gemini, depois Groq, e Anthropic por último", () => {
    expect(selecionarProvedor({ GEMINI_API_KEY: "gm", GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" })?.nome).toBe("gemini");
    expect(selecionarProvedor({ GROQ_API_KEY: "g", ANTHROPIC_API_KEY: "a" })?.nome).toBe("groq");
  });

  it("usa o provedor genérico quando IA_OPENAI_KEY + IA_OPENAI_BASE_URL existem", () => {
    const p = selecionarProvedor({
      IA_OPENAI_KEY: "sk-or",
      IA_OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      IA_OPENAI_MODEL: "meta-llama/llama-3.3-70b-instruct:free",
    });
    expect(p?.nome).toBe("compativel");
    expect(p?.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(p?.modelo).toBe("meta-llama/llama-3.3-70b-instruct:free");
  });

  it("não ativa o genérico com a chave mas sem a URL base", () => {
    expect(selecionarProvedor({ IA_OPENAI_KEY: "sk-or" })).toBeNull();
  });

  it("sem preferência, o genérico vem na frente de todos", () => {
    const p = selecionarProvedor({
      IA_OPENAI_KEY: "sk-or",
      IA_OPENAI_BASE_URL: "https://openrouter.ai/api/v1",
      GITHUB_MODELS_TOKEN: "gh",
      GEMINI_API_KEY: "gm",
    });
    expect(p?.nome).toBe("compativel");
  });

  it("usa GitHub Models quando só o token dele existe", () => {
    const p = selecionarProvedor({ GITHUB_MODELS_TOKEN: "gh" });
    expect(p?.nome).toBe("github");
    expect(p?.modelo).toMatch(/gpt-4o-mini/);
  });

  it("sem preferência, GitHub Models vem na frente dos outros gratuitos", () => {
    const p = selecionarProvedor({ GITHUB_MODELS_TOKEN: "gh", GEMINI_API_KEY: "gm", GROQ_API_KEY: "g" });
    expect(p?.nome).toBe("github");
  });

  it("respeita IA_PROVEDOR=github, ignorando uma chave Gemini presente", () => {
    const p = selecionarProvedor({ IA_PROVEDOR: "github", GITHUB_MODELS_TOKEN: "gh", GEMINI_API_KEY: "gm" });
    expect(p?.nome).toBe("github");
  });

  it("usa Anthropic quando só a chave dele existe", () => {
    const p = selecionarProvedor({ ANTHROPIC_API_KEY: "a" });
    expect(p?.nome).toBe("anthropic");
  });

  it("respeita IA_PROVEDOR explícito, se a chave correspondente existir", () => {
    const p = selecionarProvedor({ IA_PROVEDOR: "anthropic", GEMINI_API_KEY: "gm", ANTHROPIC_API_KEY: "a" });
    expect(p?.nome).toBe("anthropic");
  });

  it("ignora a preferência quando a chave dela falta, caindo pra que existe", () => {
    const p = selecionarProvedor({ IA_PROVEDOR: "anthropic", GEMINI_API_KEY: "gm" });
    expect(p?.nome).toBe("gemini");
  });

  it("aplica o modelo padrão de cada provedor, e o override quando vem", () => {
    expect(selecionarProvedor({ GEMINI_API_KEY: "gm" })?.modelo).toMatch(/gemini/);
    expect(selecionarProvedor({ GROQ_API_KEY: "g" })?.modelo).toMatch(/llama/);
    expect(selecionarProvedor({ GEMINI_API_KEY: "gm", GEMINI_MODEL: "outro" })?.modelo).toBe("outro");
  });

  it("devolve null quando nenhuma chave existe", () => {
    expect(selecionarProvedor({})).toBeNull();
  });
});

describe("montarRequisicao", () => {
  it("Gemini: chave no header x-goog-api-key, modelo na URL e JSON forçado", () => {
    const provedor: Provedor = { nome: "gemini", apiKey: "chave-gm", modelo: "gemini-x" };
    const req = montarRequisicao(provedor, "oi", 800);
    expect(req.url).toContain("generativelanguage.googleapis.com");
    expect(req.url).toContain("gemini-x:generateContent");
    expect(req.headers["x-goog-api-key"]).toBe("chave-gm");
    expect(req.url).not.toContain("chave-gm"); // a chave nunca vai na URL
    const corpo = JSON.parse(req.body);
    expect(corpo.contents).toEqual([{ parts: [{ text: "oi" }] }]);
    expect(corpo.generationConfig.maxOutputTokens).toBe(800);
    expect(corpo.generationConfig.responseMimeType).toBe("application/json");
  });

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

  it("compativel: monta a URL a partir do baseUrl, normalizando a barra final", () => {
    const provedor: Provedor = {
      nome: "compativel",
      apiKey: "sk-or",
      modelo: "meta-llama/llama-3.3-70b-instruct:free",
      baseUrl: "https://openrouter.ai/api/v1/",
    };
    const req = montarRequisicao(provedor, "oi", 800);
    expect(req.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(req.headers.authorization).toBe("Bearer sk-or");
    const corpo = JSON.parse(req.body);
    expect(corpo.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
    expect(corpo.messages).toEqual([{ role: "user", content: "oi" }]);
  });

  it("GitHub Models: dialeto OpenAI, Bearer e models.github.ai", () => {
    const provedor: Provedor = { nome: "github", apiKey: "tok-gh", modelo: "openai/gpt-4o-mini" };
    const req = montarRequisicao(provedor, "oi", 800);
    expect(req.url).toContain("models.github.ai");
    expect(req.url).toContain("chat/completions");
    expect(req.headers.authorization).toBe("Bearer tok-gh");
    const corpo = JSON.parse(req.body);
    expect(corpo.model).toBe("openai/gpt-4o-mini");
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
  const gemini: Provedor = { nome: "gemini", apiKey: "gm", modelo: "m" };
  const groq: Provedor = { nome: "groq", apiKey: "g", modelo: "m" };
  const github: Provedor = { nome: "github", apiKey: "gh", modelo: "m" };
  const anthropic: Provedor = { nome: "anthropic", apiKey: "a", modelo: "m" };

  it("Gemini: junta os parts do primeiro candidate", () => {
    const dados = { candidates: [{ content: { parts: [{ text: "res" }, { text: "posta" }] } }] };
    expect(extrairTexto(gemini, dados)).toBe("resposta");
  });

  it("Groq: pega choices[0].message.content", () => {
    expect(extrairTexto(groq, { choices: [{ message: { content: "resposta" } }] })).toBe("resposta");
  });

  it("GitHub Models: mesmo formato OpenAI, choices[0].message.content", () => {
    expect(extrairTexto(github, { choices: [{ message: { content: "resposta" } }] })).toBe("resposta");
  });

  it("Anthropic: pega o primeiro bloco de texto", () => {
    expect(extrairTexto(anthropic, { content: [{ type: "text", text: "resposta" }] })).toBe("resposta");
  });

  it("devolve null quando a resposta não tem texto (cada formato)", () => {
    expect(extrairTexto(gemini, { candidates: [] })).toBeNull();
    expect(extrairTexto(gemini, {})).toBeNull();
    expect(extrairTexto(groq, { choices: [] })).toBeNull();
    expect(extrairTexto(anthropic, { content: [{ type: "tool_use" }] })).toBeNull();
  });
});
