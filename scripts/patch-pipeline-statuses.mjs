import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const textExtensions = new Set(['.js', '.jsx', '.css']);

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function edit(path, transform) {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(path, after);
    console.log(`updated ${path}`);
  }
}

for (const root of ['src', 'tests']) {
  for (const path of walk(root)) {
    if (!textExtensions.has(extname(path))) continue;
    edit(path, text => text
      .replaceAll('Vendido', 'Fechado')
      .replaceAll('vendidos ou perdidos', 'fechados ou perdidos')
      .replaceAll('como vendido', 'como fechado')
      .replaceAll('Status vendido exige', 'Status fechado exige')
      .replaceAll('Valor vendido', 'Valor fechado')
      .replaceAll('Marcar como vendido', 'Marcar como fechado'));
  }
}

edit('src/App.jsx', text => text
  .replace(
    "  { id: 'Proposta enviada', className: 'proposal' },\n  { id: 'Fechado', className: 'sold' },",
    "  { id: 'Proposta enviada', className: 'proposal' },\n  { id: 'Negociação', className: 'negotiation' },\n  { id: 'Fechado', className: 'sold' },",
  )
  .replace(
    "  if (status === 'Proposta enviada') return 'red';\n  if (status === 'Fechado') return 'green';",
    "  if (status === 'Proposta enviada') return 'red';\n  if (status === 'Negociação') return 'purple';\n  if (status === 'Fechado') return 'green';",
  )
  .replace(
    "  const status = STATUSES.some(item => item.id === lead.status) ? lead.status : 'Novo lead';",
    "  const rawStatus = lead.status === \"Vendido\" ? 'Fechado' : lead.status;\n  const status = STATUSES.some(item => item.id === rawStatus) ? rawStatus : 'Novo lead';",
  ));

edit('src/Dashboard.jsx', text => text
  .replace(
    "const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido'];",
    "const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'];",
  )
  .replace(
    "const PRIORITY_STATUS = {\n  'Proposta enviada': 0,\n  Interessado: 1,\n  Contatado: 2,\n  'Novo lead': 3,\n};",
    "const PRIORITY_STATUS = {\n  'Negociação': 0,\n  'Proposta enviada': 1,\n  Interessado: 2,\n  Contatado: 3,\n  'Novo lead': 4,\n};",
  ));

edit('src/LeadsPage.jsx', text => text.replace(
  "const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido'];",
  "const STATUSES = ['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido'];",
));

edit('src/domain.js', text => text.replace(
  "name: 'Oficina JM', company: 'Oficina mecânica', phone: '21999999999', value: 850, status: 'Proposta enviada'",
  "name: 'Oficina JM', company: 'Oficina mecânica', phone: '21999999999', value: 850, status: 'Negociação'",
));

edit('src/leadTemperature.js', text => text
  .replace(
    "const WINDOWS = {\n  'Proposta enviada': { attention: 2, cooling: 4 },",
    "const WINDOWS = {\n  'Negociação': { attention: 2, cooling: 4 },\n  'Proposta enviada': { attention: 2, cooling: 4 },",
  )
  .replace(
    "const stageOrder = { 'Proposta enviada': 0, Interessado: 1, Contatado: 2, 'Novo lead': 3 };",
    "const stageOrder = { 'Negociação': 0, 'Proposta enviada': 1, Interessado: 2, Contatado: 3, 'Novo lead': 4 };",
  ));

edit('src/autopilotEngine.js', text => text
  .replace(
    "const STATUS_WEIGHT = {\n  'Proposta enviada': 34,",
    "const STATUS_WEIGHT = {\n  'Negociação': 40,\n  'Proposta enviada': 34,",
  )
  .replace(
    "const STATUS_ORDER = {\n  'Proposta enviada': 0,\n  Interessado: 1,\n  Contatado: 2,\n  'Novo lead': 3,\n};",
    "const STATUS_ORDER = {\n  'Negociação': 0,\n  'Proposta enviada': 1,\n  Interessado: 2,\n  Contatado: 3,\n  'Novo lead': 4,\n};",
  )
  .replace(
    "function coolingThreshold(status) {\n  if (status === 'Proposta enviada') return 2;",
    "function coolingThreshold(status) {\n  if (status === 'Negociação') return 2;\n  if (status === 'Proposta enviada') return 2;",
  )
  .replace(
    "  if (lead.status === 'Proposta enviada' && !lead.nextContact) return 2;\n  if (lead.status === 'Proposta enviada' && idleDays >= 2) return 3;",
    "  if (lead.status === 'Negociação' && !lead.nextContact) return 2;\n  if (lead.status === 'Negociação' && idleDays >= 2) return 3;\n  if (lead.status === 'Proposta enviada' && !lead.nextContact) return 4;\n  if (lead.status === 'Proposta enviada' && idleDays >= 2) return 5;",
  )
  .replace(
    "  } else if (due === 2 && lead.status === 'Proposta enviada') {",
    "  } else if (due === 2 && ['Negociação', 'Proposta enviada'].includes(lead.status)) {",
  )
  .replace(
    "    const weight = lead.status === 'Proposta enviada' ? 42\n      : lead.status === 'Interessado' ? 32",
    "    const weight = lead.status === 'Negociação' ? 48\n      : lead.status === 'Proposta enviada' ? 42\n        : lead.status === 'Interessado' ? 32",
  )
  .replace(
    "  if (lead.status === 'Proposta enviada') {\n    operationalSignal = true;",
    "  if (lead.status === 'Negociação') {\n    operationalSignal = true;\n    pushReason(reasons, 'negociação ativa', STATUS_WEIGHT['Negociação'], 'stage');\n  } else if (lead.status === 'Proposta enviada') {\n    operationalSignal = true;",
  )
  .replace(
    "  if (item.lead.status === 'Proposta enviada' && !item.lead.nextContact) return {",
    "  if (item.lead.status === 'Negociação' && !item.lead.nextContact) return {\n    title: 'Defina o próximo passo da negociação',\n    detail: 'A negociação está ativa, mas sem uma próxima ação marcada. Defina o retorno e conduza o lead para uma decisão.',\n  };\n  if (item.lead.status === 'Negociação') return {\n    title: 'Conduza para uma decisão',\n    detail: 'Esse lead já está negociando. Resolva objeções, ajuste o necessário e busque um sim ou não claro.',\n  };\n  if (item.lead.status === 'Proposta enviada' && !item.lead.nextContact) return {",
  ));

edit('src/Autopilot.jsx', text => text.replace(
  "  {\n    id: 'won',",
  "  {\n    id: 'negotiation',\n    label: 'Entrou em negociação',\n    detail: 'A proposta virou uma negociação ativa. Registre o próximo passo para conduzir ao fechamento.',\n    nextDays: 2,\n    nextAction: 'Avançar negociação',\n    status: 'Negociação',\n    tone: 'proposal',\n  },\n  {\n    id: 'won',",
));

edit('src/importUtils.js', text => text
  .replace(
    "  if (/(proposta|orcamento|cotacao|enviado|trabalhando)/.test(text)) return 'Proposta enviada';\n  if (/(interessado|negociacao|negociando|quente|em andamento)/.test(text)) return 'Interessado';",
    "  if (/(proposta|orcamento|cotacao|enviado)/.test(text)) return 'Proposta enviada';\n  if (/(negociacao|negociando|trabalhando|em andamento|contraproposta|ajuste)/.test(text)) return 'Negociação';\n  if (/(interessado|quente)/.test(text)) return 'Interessado';",
  ));

edit('tests/import.test.js', text => text.replace(
  "  assert.equal(normalizeStatus('Pago'), 'Fechado');",
  "  assert.equal(normalizeStatus('Pago'), 'Fechado');\n  assert.equal(normalizeStatus('Em negociação'), 'Negociação');",
));

edit('src/styles.css', text => text
  .replace('grid-template-columns:repeat(6,minmax(145px,1fr))', 'grid-template-columns:repeat(7,minmax(130px,1fr))')
  .replace('grid-template-columns:repeat(6,minmax(235px,1fr));gap:8px;min-width:1460px', 'grid-template-columns:repeat(7,minmax(235px,1fr));gap:8px;min-width:1705px')
  .replace('.pipeline-column.proposal .status-dot{background:#f07a17}.pipeline-column.sold', '.pipeline-column.proposal .status-dot{background:#f07a17}.pipeline-column.negotiation .status-dot{background:#6f5bd3}.pipeline-column.sold')
  .replace('grid-template-columns:repeat(6,82vw);min-width:max-content', 'grid-template-columns:repeat(7,82vw);min-width:max-content'));

edit('src/leads.css', text => text
  .replace('.leads-status.status-proposta-enviada{background:#fff0e3;color:#ce6411}.leads-status.status-fechado', '.leads-status.status-proposta-enviada{background:#fff0e3;color:#ce6411}.leads-status.status-negociação{background:#efedff;color:#6250c8}.leads-status.status-fechado'));

console.log('pipeline status patch complete');
