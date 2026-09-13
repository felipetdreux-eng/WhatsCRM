from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:160]}')
    p.write_text(text.replace(old, new, count))


# Empty shared workspaces must stay empty after login.
replace('src/backendBridge.js', "import { buildDemoLeads } from './domain';\n", '')
replace(
    'src/backendBridge.js',
    """    } else if (profile?.start_mode === 'empty') {
      localStorage.setItem('zapflow-leads', '[]');
    } else {
      const demo = buildDemoLeads();
      const syncedDemo = await syncLeads(demo, user.id);
      localStorage.setItem('zapflow-leads', JSON.stringify(syncedDemo.length ? syncedDemo : demo));
    }""",
    """    } else {
      // Demo data is created during onboarding. Never resurrect it on login,
      // especially in a shared workspace that was intentionally emptied.
      localStorage.setItem('zapflow-leads', '[]');
    }""",
)

# Propagate demo mode to lead-management utilities.
replace(
    'src/App.jsx',
    "if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} preset={leadsPreset} />;",
    "if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} preset={leadsPreset} demoMode={demoMode} />;",
)

# Importer must use the same canonical status normalization as the rest of Fuply.
replace(
    'src/LeadImporter.jsx',
    "  detectMapping,\n  parseDelimitedText,\n} from './importUtils';",
    "  detectMapping,\n  normalizeStatus,\n  parseDelimitedText,\n} from './importUtils';",
)
replace(
    'src/LeadImporter.jsx',
    "const FUPLY_STATUSES = new Set(['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido']);",
    "const FUPLY_STATUSES = new Set(['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido']);",
)
old_status = """function normalizeNegotiationStatus(value) {
  const text = plainText(value);
  if (!text || /^(vazio|sem status|sem etapa|n\\/a|-)$/.test(text)) return '';
  if (/(vendido|pago|fechado|concluido|finalizado|ganho)/.test(text)) return 'Fechado';
  if (/(descartado|perdido|cancelado|recusado|desistiu|sem interesse|nao interessado|sem retorno)/.test(text)) return 'Perdido';
  if (/(trabalhando|proposta|orcamento|cotacao|enviado)/.test(text)) return 'Proposta enviada';
  if (/(em andamento|interessado|negociacao|negociando|quente)/.test(text)) return 'Interessado';
  if (/(nao respondido|sem resposta|contatado|respondido|contato feito|em contato)/.test(text)) return 'Contatado';
  if (/(novo|pendente|aguardando|lead)/.test(text)) return 'Novo lead';
  return String(value ?? '').trim();
}"""
new_status = """function normalizeNegotiationStatus(value) {
  const text = plainText(value);
  if (!text || /^(vazio|sem status|sem etapa|n\\/a|-)$/.test(text)) return '';
  return normalizeStatus(value) || String(value ?? '').trim();
}"""
replace('src/LeadImporter.jsx', old_status, new_status)

# Public demos must never be covered by auth or tutorial overlays.
replace(
    'src/AuthFlow.jsx',
    "const host = document.getElementById('auth-root');\nif (host) createRoot(host).render(<AuthFlow />);",
    "const host = document.getElementById('auth-root');\nconst isPublicDemo = new URLSearchParams(window.location.search).get('demo') === 'jacob';\nif (host && !isPublicDemo) createRoot(host).render(<AuthFlow />);",
)
replace(
    'src/Tutorial.jsx',
    "const host = document.getElementById('tutorial-root');\nif (host) createRoot(host).render(<Tutorial />);",
    "const host = document.getElementById('tutorial-root');\nconst isPublicDemo = new URLSearchParams(window.location.search).get('demo') === 'jacob';\nif (host && !isPublicDemo) createRoot(host).render(<Tutorial />);",
)

# Tutorial pages/selectors were left behind by the old Dashboard UI.
p = Path('src/Tutorial.jsx')
text = p.read_text()
replacements = [
    ("page: 'Dashboard',\n    selector: '.dashboard-header-actions .primary-button',", "page: 'Início',\n    selector: '.dashboard-header-actions .primary-button',"),
    ("page: 'Dashboard',\n    selector: '.autopilot-dashboard-button',", "page: 'Início',\n    selector: '.daily-secondary-actions .secondary-button',"),
    ("page: 'Dashboard',\n    selector: '.team-metric-card',", "page: 'Resultados',\n    selector: '.dashboard-metrics',"),
    ("title: 'Acompanhe o desempenho da equipe',\n    text: 'Veja leads, vendas, conversão, faturamento e follow-ups por responsável. Use o filtro para comparar a equipe inteira ou analisar cada membro separadamente.',", "title: 'Acompanhe seus resultados',\n    text: 'Veja pipeline aberto, vendas fechadas, novos leads, conversão, funil, origens e desempenho comercial em uma tela de gestão.',"),
    ("page: 'Dashboard',\n    selector: '.focus-tabs > div',", "page: 'Início',\n    selector: '.daily-priority-panel',"),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Tutorial pattern not found: {old[:100]}')
    text = text.replace(old, new, 1)
p.write_text(text)

# Token/expiry must not be shipped inside the client bundle.
p = Path('src/jacobDemoData.js')
text = p.read_text()
marker = "\nexport const JACOB_DEMO_ACCESS = {\n  token: 'DR06Fe9IRsebUfJk892O1ihX',\n  expiresAt: '2026-09-14T21:23:44.305612-03:00',\n};\n"
if marker in text:
    text = text.replace(marker, '\n')
p.write_text(text)
