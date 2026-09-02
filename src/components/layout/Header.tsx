import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, Package, Search, ShoppingBasket, Store, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { CategoryIcon } from "@/components/ProductCard";

function SearchForm({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/buscar", search: q.trim() ? { q: q.trim() } : {} });
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar plantas, adubos, ferramentas…"
        className="h-10 rounded-full bg-muted/60 pl-9"
        aria-label="Buscar produtos"
      />
    </form>
  );
}

export function Header() {
  const { user, profile, isSeller, boxId, loading, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/", replace: true });
  }

  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Conta";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex flex-col gap-6 p-5">
              <Logo />
              <SearchForm onDone={() => setOpen(false)} />
              <nav className="flex flex-col gap-1">
                <p className="px-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Divisões</p>
                {CATEGORIES.map((c) => (
                  <Link
                    key={c.slug}
                    to="/buscar"
                    search={{ categoria: c.slug }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-leaf-light hover:text-primary"
                  >
                    <CategoryIcon category={c.slug} /> {c.name}
                  </Link>
                ))}
              </nav>
              <nav className="flex flex-col gap-1 border-t pt-4">
                {user ? (
                  <>
                    <Link to="/meus-pedidos" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-leaf-light">
                      <Package className="h-4 w-4" /> Meus pedidos
                    </Link>
                    <Link to="/painel" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-leaf-light">
                      <Store className="h-4 w-4" /> {boxId ? "Meu box" : "Criar meu box"}
                    </Link>
                    <button onClick={handleSignOut} className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold text-muted-foreground hover:bg-muted">
                      <LogOut className="h-4 w-4" /> Sair
                    </button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-leaf-light">
                    <User className="h-4 w-4" /> Entrar ou cadastrar
                  </Link>
                )}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <Logo compact className="sm:hidden" />
        <Logo className="hidden sm:flex" />

        <div className="hidden flex-1 px-4 md:block md:max-w-xl">
          <SearchForm />
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/buscar"
              search={{ categoria: c.slug }}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-leaf-light hover:text-primary"
            >
              {c.short}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buscar" onClick={() => navigate({ to: "/buscar", search: {} })}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link to="/carrinho" aria-label={`Carrinho, ${count} itens`}>
              <ShoppingBasket className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>

          {loading ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 rounded-full pl-1.5 pr-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {firstName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-24 truncate text-sm sm:inline">{firstName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate text-xs text-muted-foreground">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/meus-pedidos"><Package className="mr-2 h-4 w-4" /> Meus pedidos</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/painel"><Store className="mr-2 h-4 w-4" /> {boxId ? "Painel do meu box" : isSeller ? "Criar meu box" : "Quero vender"}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" /> Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="rounded-full">
              <Link to="/auth">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
