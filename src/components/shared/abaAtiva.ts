/**
 * Decide qual aba da barra de navegação está ativa.
 *
 * A raiz vale por eliminação, não por igualdade exata. Casar exato deixava
 * telas aninhadas sem aba nenhuma marcada — a ficha de um cliente em
 * /pro/clientes/{id} não é /pro nem /pro/clientes/novo, e a barra ficava
 * toda apagada. Por prefixo seria o oposto: a raiz acesa em tudo.
 *
 * Função pura, fora do componente, porque isto é regra e não desenho — e
 * porque quebrou uma vez sem ninguém perceber.
 */
export function ehAbaAtiva(caminho: string, raiz: string, href: string, todosOsHrefs: string[]): boolean {
  if (href !== raiz) {
    return caminho.startsWith(href);
  }
  const outraCasou = todosOsHrefs.some((outro) => outro !== raiz && caminho.startsWith(outro));
  return !outraCasou;
}
