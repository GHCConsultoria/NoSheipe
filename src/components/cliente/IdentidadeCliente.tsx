import Link from "next/link";
import { AvatarCliente } from "@/components/cliente/AvatarCliente";

interface Props {
  token: string;
  nome: string;
  fotoUrl?: string | null;
}

/**
 * Faixa de identidade no topo das telas do cliente — foto + nome. Dá cara
 * de "esse app é meu" e, num print compartilhado, aparece a foto da pessoa,
 * não um logo genérico. Toca a foto e vai pro perfil (é por aqui que se
 * chega ao perfil agora que ele saiu da barra de baixo).
 *
 * Não vai na tela de Marketplace de propósito — lá é vitrine, não o perfil
 * da pessoa.
 */
export function IdentidadeCliente({ token, nome, fotoUrl }: Props) {
  return (
    <Link
      href={`/p/${token}/perfil`}
      className="tatil mb-4 inline-flex items-center gap-2.5"
      aria-label="Meu perfil"
    >
      <AvatarCliente fotoUrl={fotoUrl} nome={nome} tamanho={40} className="shadow-sm" />
      <span className="font-display text-lg">{nome}</span>
    </Link>
  );
}
