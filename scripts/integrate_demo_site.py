from pathlib import Path

path = Path('public/demo/index.html')
text = path.read_text(encoding='utf-8')

replacements = {
    "<p>Nesta demo, o formulário já foi desenhado pensando na próxima etapa: cada pedido de orçamento poderá virar automaticamente um lead dentro do Fuply, com origem e interesse identificados.</p>":
    "<p>Agora cada pedido de orçamento vira automaticamente um lead dentro do Fuply, com origem Site, interesse e faixa de investimento registrados.</p>",
    "<div><span class=\"eyebrow\">Orçamento sem compromisso</span><h2>Conte o que você quer transformar.</h2><p>Preencha os dados e simule como um pedido de orçamento chegaria ao Fuply. Nesta primeira versão demo, nenhum WhatsApp real é enviado.</p></div>":
    "<div><span class=\"eyebrow\">Orçamento sem compromisso</span><h2>Conte o que você quer transformar.</h2><p>Preencha os dados. Ao enviar, o pedido entra automaticamente no pipeline do Fuply como um novo lead vindo do site.</p></div>",
    "<div class=\"success\" id=\"success\">Lead demo registrado. Próxima etapa: enviar isso automaticamente para o pipeline do Fuply.</div>":
    "<div class=\"success\" id=\"success\">Pedido enviado. O lead entrou automaticamente no Fuply.</div>",
    "<p class=\"form-note\">Demo fictícia criada para validar a experiência de site + CRM. Os dados ficam apenas neste navegador.</p>":
    "<p class=\"form-note\">Integração ativa com o Fuply: os dados enviados neste formulário entram no CRM para acompanhamento comercial.</p>",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Expected text not found: {old[:80]}')
    text = text.replace(old, new, 1)

old_script = '''  <script>
    const form = document.getElementById('leadForm');
    const success = document.getElementById('success');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const lead = Object.fromEntries(new FormData(form).entries());
      lead.createdAt = new Date().toISOString();
      lead.source = 'Site Demo - Nobre Planejados';
      const saved = JSON.parse(localStorage.getItem('fuply-site-demo-leads') || '[]');
      saved.unshift(lead);
      localStorage.setItem('fuply-site-demo-leads', JSON.stringify(saved.slice(0, 25)));
      success.classList.add('show');
      form.reset();
      success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  </script>'''

new_script = '''  <script>
    const form = document.getElementById('leadForm');
    const success = document.getElementById('success');
    const SUPABASE_URL = 'https://myllrhcgbrwfvtqxgkcb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Rs03JEyGR0ZRUByacZwIpw_4PfRcyKQ';
    const SITE_KEY = 'cdbb5a69-85fd-4fd1-9dac-adcf807caf0c';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const originalLabel = button.textContent;
      const lead = Object.fromEntries(new FormData(form).entries());
      button.disabled = true;
      button.textContent = 'Enviando para o Fuply...';
      success.classList.remove('show');

      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_site_lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            _site_key: SITE_KEY,
            _name: lead.name,
            _phone: lead.phone,
            _service: lead.service || '',
            _budget: lead.budget || '',
            _message: lead.message || '',
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || 'Falha ao registrar lead');
        }

        success.textContent = 'Pedido enviado. O lead entrou automaticamente no Fuply.';
        success.style.background = '#e4f2ea';
        success.style.color = '#18583d';
        success.classList.add('show');
        form.reset();
        success.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        console.error('Fuply site lead error:', error);
        success.textContent = 'Não foi possível enviar agora. Tente novamente em instantes.';
        success.style.background = '#f7e5e5';
        success.style.color = '#8b2f2f';
        success.classList.add('show');
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
  </script>'''

if old_script not in text:
    raise SystemExit('Original demo script block not found')
text = text.replace(old_script, new_script, 1)
path.write_text(text, encoding='utf-8')
print('Demo site now sends leads directly to Fuply.')
