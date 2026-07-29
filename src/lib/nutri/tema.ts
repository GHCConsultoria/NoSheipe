export const CHAVE_TEMA = "nosheipe-theme";

/**
 * Roda antes da hidratação (inline <script>, primeiro filho do layout) pra
 * aplicar o tema salvo antes do primeiro paint — sem isso, a tela pisca no
 * tema errado por um frame toda vez que o usuário escolheu manualmente algo
 * diferente da preferência do sistema.
 */
export function scriptSemFlashDeTema(): string {
  return `(function(){try{var t=localStorage.getItem("${CHAVE_TEMA}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
}
