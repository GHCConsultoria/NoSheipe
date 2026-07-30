import { ScriptSemFlashDeTema } from "@/components/nutri/ScriptSemFlashDeTema";

/**
 * O botão de tema saiu daqui: era `fixed bottom-4 right-4` e passou a
 * disputar o rodapé com a barra de navegação do cliente. Agora mora numa
 * linha da aba Perfil, que é onde configuração pertence.
 */
export default function PaginaPublicaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScriptSemFlashDeTema />
      {children}
    </>
  );
}
