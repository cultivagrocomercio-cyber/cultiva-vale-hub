import { createFileRoute, Link } from "@tanstack/react-router";
import { PLATFORM_EMAIL } from "@/lib/commission";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Cultiva Vale Marketplace" },
      { name: "description", content: "Termos de Uso do Cultiva Vale Marketplace: regras para compradores e vendedores, planos, comissões, custódia, disputas e responsabilidades." },
      { property: "og:title", content: "Termos de Uso — Cultiva Vale" },
      { property: "og:description", content: "Regras de uso da plataforma para compradores e boxes vendedores." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <article className="container-page max-w-3xl py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">Documento legal</p>
      <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026. Leia também a <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.</p>

      <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <Section n="1" title="Sobre a plataforma">
          O Cultiva Vale Marketplace ("Plataforma") é um ambiente digital que conecta produtores e lojistas ("Vendedores"), organizados em boxes, a compradores de todo o Brasil ("Compradores"), para a comercialização de plantas, insumos e máquinas/ferramentas agrícolas. A Plataforma intermedeia a negociação e a custódia do pagamento; ela não é fabricante, produtora nem transportadora dos produtos.
        </Section>
        <Section n="2" title="Cadastro e contas">
          Toda conta nasce como Comprador. O Vendedor só passa a operar após enviar o pedido de habilitação comercial (dados fiscais, endereço e categoria) e obter a aprovação da equipe da Plataforma. O usuário é responsável pela veracidade das informações, pela guarda da senha e por todas as atividades realizadas com sua conta.
        </Section>
        <Section n="3" title="Obrigações do Vendedor">
          O Vendedor deve manter dados fiscais válidos (CPF/CNPJ e Inscrição Estadual conforme a categoria), anunciar apenas produtos lícitos e de sua titularidade, manter estoque e preços atualizados, emitir a nota fiscal eletrônica quando exigido, cumprir os prazos de envio/entrega combinados e responder pelo atendimento pós-venda. A Plataforma pode suspender boxes que infrinjam estes termos ou a legislação.
        </Section>
        <Section n="4" title="Planos e comissões">
          Os boxes operam nos planos Básico (comissão de 8%), Intermediário (5%) ou Premium (3%), com os limites e benefícios descritos no painel do vendedor. A comissão incide sobre o valor bruto dos produtos de cada pedido pago dentro da Plataforma, sendo gravada de forma imutável no pedido na data da compra.
        </Section>
        <Section n="5" title="Pedidos, pagamento em custódia e liberação">
          Ao finalizar um pedido, o estoque é reservado. O pagamento é confirmado pela Plataforma e mantido em custódia até a confirmação de recebimento pelo Comprador ou até 7 dias corridos após o envio, quando o valor líquido é liberado ao Vendedor. Pedidos cancelados antes do envio têm o estoque devolvido automaticamente.
        </Section>
        <Section n="6" title="Entrega">
          Frete, retirada no local e prazos são combinados diretamente entre Comprador e Vendedor pelo chat do pedido. A Plataforma não fixa frete nem garante prazos de transporte.
        </Section>
        <Section n="7" title="Disputas">
          O Comprador pode abrir uma disputa após o envio caso o produto não seja recebido ou apresente divergência. A Plataforma fará a mediação com base nas evidências e decidirá pela liberação ao Vendedor ou pelo cancelamento com estorno.
        </Section>
        <Section n="8" title="Avaliações">
          Apenas compradores com pedidos concluídos podem avaliar, uma vez por pedido. Avaliações abusivas podem ser ocultadas ou removidas pela moderação, com recálculo automático das médias.
        </Section>
        <Section n="9" title="Propriedade intelectual e conteúdo">
          Fotos, textos e logotipos enviados pelos usuários permanecem de sua titularidade, sendo concedida à Plataforma licença para exibi-los no contexto do marketplace. É proibido publicar conteúdo que viole direitos de terceiros.
        </Section>
        <Section n="10" title="Limitação de responsabilidade">
          A Plataforma não responde por vícios dos produtos, atrasos de transporte ou tratativas realizadas fora do ambiente do aplicativo. Sua responsabilidade limita-se à intermediação, custódia e mediação de disputas descritas nestes Termos.
        </Section>
        <Section n="11" title="Alterações e contato">
          Estes Termos podem ser atualizados; a versão vigente estará sempre publicada nesta página. Dúvidas: <a className="text-primary hover:underline" href={`mailto:${PLATFORM_EMAIL}`}>{PLATFORM_EMAIL}</a>. Foro: comarca de Registro/SP.
        </Section>
      </div>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{n}. {title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
