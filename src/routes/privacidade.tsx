import { createFileRoute, Link } from "@tanstack/react-router";
import { PLATFORM_EMAIL, PLATFORM_WHATSAPP } from "@/lib/commission";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade (LGPD) — Cultiva Vale" },
      { name: "description", content: "Como o Cultiva Vale Marketplace trata dados pessoais conforme a LGPD (Lei 13.709/2018): bases legais, finalidades, compartilhamento, direitos do titular e canal do DPO." },
      { property: "og:title", content: "Política de Privacidade — Cultiva Vale" },
      { property: "og:description", content: "Bases legais, direitos do titular e canal do Encarregado (DPO)." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <article className="container-page max-w-3xl py-10">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">LGPD · Lei nº 13.709/2018</p>
      <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026. Complementa os <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <Section n="1" title="Controlador e Encarregado (DPO)">
          O controlador dos dados é o Cultiva Vale Marketplace. O Encarregado pelo Tratamento de Dados Pessoais (DPO) pode ser contatado pelo e-mail{" "}
          <a className="text-primary hover:underline" href={`mailto:${PLATFORM_EMAIL}?subject=LGPD%20-%20Solicita%C3%A7%C3%A3o%20do%20titular`}>{PLATFORM_EMAIL}</a> ou pelo WhatsApp{" "}
          <a className="text-primary hover:underline" href={`https://wa.me/${PLATFORM_WHATSAPP}`} target="_blank" rel="noreferrer">(13) 99131-8923</a>.
        </Section>
        <Section n="2" title="Dados que tratamos">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Cadastro:</strong> nome, e-mail, telefone/WhatsApp, cidade e UF.</li>
            <li><strong>Dados fiscais:</strong> CPF/CNPJ, Inscrição Estadual, razão social, endereço e CEP — do Vendedor (habilitação do box) e do Comprador (emissão de NF-e).</li>
            <li><strong>Transações:</strong> pedidos, itens, valores, comissões, comprovantes de pagamento, rastreio, mensagens do chat do pedido e avaliações.</li>
            <li><strong>Certificado digital A1 (Vendedores):</strong> arquivo .pfx/.p12 armazenado em área privada e senha guardada de forma criptografada, usados exclusivamente para assinatura de NF-e.</li>
            <li><strong>Técnicos:</strong> registros de acesso, dispositivo e notificações entregues.</li>
          </ul>
        </Section>
        <Section n="3" title="Finalidades e bases legais">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Execução de contrato</strong> (art. 7º, V): criar sua conta, processar pedidos, custódia, entrega, chat, avaliações e painel do vendedor.</li>
            <li><strong>Cumprimento de obrigação legal</strong> (art. 7º, II): emissão e guarda de notas fiscais e dados fiscais, retenção por prazos legais.</li>
            <li><strong>Legítimo interesse</strong> (art. 7º, IX): prevenção a fraudes, segurança da plataforma, moderação e melhoria do serviço.</li>
            <li><strong>Consentimento</strong> (art. 7º, I): comunicações por e-mail e WhatsApp além dos avisos operacionais — você pode retirar o consentimento a qualquer momento em <Link to="/perfil" search={{ aba: "notificacoes" }} className="text-primary hover:underline">Meu perfil → Notificações</Link>.</li>
          </ul>
        </Section>
        <Section n="4" title="Compartilhamento">
          Compartilhamos dados apenas quando necessário: com o Vendedor ou Comprador da mesma transação (nome, contato, endereço de entrega e dados fiscais do destinatário para a NF-e), com a integradora fiscal e a SEFAZ para emissão de notas, com provedores de infraestrutura em nuvem e autenticação, e com autoridades mediante obrigação legal. Não vendemos dados pessoais.
        </Section>
        <Section n="5" title="Comunicações e notificações">
          Avisos operacionais (pedido, pagamento, envio, NF-e, avaliações, estoque e saldo) são exibidos no sino do aplicativo. O envio desses avisos por e-mail ou WhatsApp depende das suas preferências, ajustáveis a qualquer momento. E-mails de segurança da conta são sempre enviados. Não realizamos marketing em massa.
        </Section>
        <Section n="6" title="Retenção">
          Dados de conta são mantidos enquanto a conta existir. Dados fiscais e de transações são retidos pelos prazos legais (em regra, 5 anos) mesmo após a exclusão da conta, de forma segregada e com acesso restrito.
        </Section>
        <Section n="7" title="Segurança">
          Utilizamos controle de acesso por papéis, políticas de segurança em nível de linha no banco de dados, criptografia em trânsito, armazenamento privado para arquivos sensíveis e criptografia da senha do certificado digital, que nunca é devolvida em consultas.
        </Section>
        <Section n="8" title="Seus direitos como titular (art. 18)">
          Você pode solicitar: confirmação e acesso aos dados; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamentos; revogação do consentimento; e eliminação dos dados tratados com base no consentimento. As solicitações são atendidas pelo canal do DPO em até 15 dias.
        </Section>
        <Section n="9" title="Cookies e armazenamento local">
          Usamos armazenamento local apenas para manter sua sessão, o carrinho e preferências de navegação. Não utilizamos cookies de publicidade.
        </Section>
        <Section n="10" title="Alterações">
          Esta política pode ser revisada; mudanças relevantes serão avisadas no aplicativo. A versão vigente é sempre a publicada nesta página.
        </Section>
      </div>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{n}. {title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
