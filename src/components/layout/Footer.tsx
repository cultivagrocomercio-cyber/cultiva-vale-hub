import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { CATEGORIES } from "@/lib/categories";
import { PLATFORM_EMAIL, PLATFORM_WHATSAPP } from "@/lib/commission";

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-soil-grain">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            O Ceasa digital do Vale do Ribeira. Produtores e lojistas com seu próprio box, vendendo plantas, insumos e
            máquinas para todo o Brasil.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Divisões</p>
          <ul className="mt-3 space-y-2 text-sm">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link to="/buscar" search={{ categoria: c.slug }} className="hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Marketplace</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/buscar" search={{}} className="hover:text-primary">Buscar produtos</Link></li>
            <li><Link to="/painel" className="hover:text-primary">Vender no Cultiva Vale</Link></li>
            <li><Link to="/meus-pedidos" className="hover:text-primary">Meus pedidos</Link></li>
            <li><Link to="/carrinho" className="hover:text-primary">Carrinho</Link></li>
            <li><Link to="/notificacoes" className="hover:text-primary">Notificações</Link></li>
          </ul>
          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-secondary">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/termos" className="hover:text-primary">Termos de Uso</Link></li>
            <li><Link to="/privacidade" className="hover:text-primary">Política de Privacidade (LGPD)</Link></li>
          </ul>
          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-secondary">Contato</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={`https://wa.me/${PLATFORM_WHATSAPP}`} target="_blank" rel="noreferrer" className="hover:text-primary">
                WhatsApp (13) 99131-8923
              </a>
            </li>
            <li>
              <a href={`mailto:${PLATFORM_EMAIL}`} className="break-all hover:text-primary">{PLATFORM_EMAIL}</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Cultiva Vale Marketplace · Vale do Ribeira, SP</span>
          <span>Entrega e pagamento combinados diretamente entre comprador e vendedor.</span>
        </div>
      </div>
    </footer>
  );
}
