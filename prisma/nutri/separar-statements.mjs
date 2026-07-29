/**
 * Quebra o conteúdo de init.sql na lista de statements a executar.
 *
 * A ordem importa: os comentários saem ANTES da divisão por ";". Fazer o
 * contrário quebra o arquivo em qualquer comentário que contenha um ponto
 * e vírgula — o resto da frase deixa de começar com "--" e vira um
 * statement inválido.
 *
 * Mora num módulo próprio porque o script de deploy e os testes precisam
 * exatamente do mesmo comportamento; duplicado, ele já divergiu uma vez.
 */
export function separarStatements(sql) {
  return sql
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((bloco) => bloco.trim())
    .filter((bloco) => bloco.length > 0);
}
