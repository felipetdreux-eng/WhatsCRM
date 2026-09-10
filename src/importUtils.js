import { canonicalPhone, validBrazilPhone } from './domain.js';

export const IMPORT_FIELDS = [
  { key: 'name', label: 'Nome do cliente', aliases: ['nome', 'cliente', 'contato', 'name', 'customer'] },
  { key: 'phone', label: 'WhatsApp', aliases: ['whatsapp', 'telefone', 'celular', 'fone', 'phone', 'numero', 'número'] },
  { key: 'company', label: 'Empresa', aliases: ['empresa', 'negocio', 'negócio', 'estabelecimento', 'company'] },
  { key: 'value', label: 'Valor', aliases: ['valor', 'valor pedido', 'valor total', 'total', 'preco', 'preço', 'orcamento', 'orçamento'] },
  { key: 'status', label: 'Status', aliases: ['status', 'situacao', 'situação', 'etapa', 'fase', 'pipeline'] },
  { key: 'origin', label: 'Origem', aliases: ['origem', 'fonte', 'canal', 'source'] },
  { key: 'nextContact', label: 'Próximo contato', aliases: ['proximo contato', 'próximo contato', 'data retorno', 'retorno', 'follow up', 'follow-up', 'followup'] },
  { key: 'nextContactTime', label: 'Horário', aliases: ['horario', 'horário', 'hora', 'time'] },
  { key: 'nextAction', label: 'Próxima ação', aliases: ['proxima acao', 'próxima ação', 'acao', 'ação', 'proximo passo', 'próximo passo'] },
  { key: 'notes', label: 'Observações / pedido', aliases: ['observacao', 'observação', 'observacoes', 'observações', 'obs', 'pedido', 'descricao', 'descrição', 'produto', 'servico', 'serviço'] },
];

const CLOSED = ['Vendido', 'Perdido'];
const PHONE_PATTERN = /(?:\+?55[\s.-]*)?\(?\d{2}\)?[\s.-]*\d{4,5}[\s.-]*\d{4}/g;

export const normalizeText = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

function delimiterScore(line, delimiter) {
  let score = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === delimiter) score += 1;
  }
  return score;
}

export function parseDelimitedText(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/).find(line => line.trim()) || '';
  const delimiters = [';', ',', '\t'];
  const delimiter = delimiters.sort((a, b) => delimiterScore(firstLine, b) - delimiterScore(firstLine, a))[0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(value => String(value).trim())) rows.push(row);
  return rows;
}

function embeddedPhone(value) {
  const text = String(value ?? '');
  const matches = text.match(PHONE_PATTERN) || [];
  return matches.find(candidate => validBrazilPhone(canonicalPhone(candidate))) || '';
}

function cleanEmbeddedIdentity(value, phone) {
  let text = String(value ?? '');
  if (phone) text = text.replace(phone, ' ');
  text = text
    .replace(/\bwhats\s*app\s*:?/gi, ' ')
    .replace(/\btelefone\s*:?/gi, ' ')
    .replace(/\bcelular\s*:?/gi, ' ')
    .replace(/[—–|]+\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

export function detectMapping(headers) {
  const normalizedHeaders = headers.map(normalizeText);
  const used = new Set();
  const mapping = {};

  for (const field of IMPORT_FIELDS) {
    let index = normalizedHeaders.findIndex((header, candidate) => !used.has(candidate) && field.aliases.some(alias => header === normalizeText(alias)));
    if (index < 0) {
      index = normalizedHeaders.findIndex((header, candidate) => !used.has(candidate) && field.aliases.some(alias => {
        const normalizedAlias = normalizeText(alias);
        return header.includes(normalizedAlias) || normalizedAlias.includes(header);
      }));
    }
    mapping[field.key] = index >= 0 ? index : '';
    if (index >= 0) used.add(index);
  }

  // Some Google Sheets / Excel PDFs are exported without a header row. In that
  // case the first lead becomes "the header" to the generic importer. Detect a
  // real Brazilian phone inside that first row and temporarily map the same cell
  // as identity + phone; analyzeImport will split it safely below.
  const dataPhoneIndex = headers.findIndex(header => embeddedPhone(header));
  if (dataPhoneIndex >= 0) {
    if (mapping.phone === '' || mapping.phone == null) mapping.phone = dataPhoneIndex;
    const identity = cleanEmbeddedIdentity(headers[dataPhoneIndex], embeddedPhone(headers[dataPhoneIndex]));
    if ((mapping.name === '' || mapping.name == null) && (mapping.company === '' || mapping.company == null) && identity) {
      mapping.name = dataPhoneIndex;
    }
  }

  return mapping;
}

export function parseMoney(value) {
  if (value == null || String(value).trim() === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value).trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  text = text.replace(/[^0-9.-]/g, '');
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDate(value) {
  if (value == null || String(value).trim() === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const br = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return '';
}

export function normalizeTime(value) {
  if (value == null || String(value).trim() === '') return '';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function normalizeStatus(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/(vendido|pago|fechado|concluido|finalizado|ganho)/.test(text)) return 'Vendido';
  if (/(descartado|perdido|cancelado|recusado|desistiu|sem retorno|nao interessado|sem interesse)/.test(text)) return 'Perdido';
  if (/(proposta|orcamento|cotacao|enviado|trabalhando)/.test(text)) return 'Proposta enviada';
  if (/(interessado|negociacao|negociando|quente|em andamento)/.test(text)) return 'Interessado';
  if (/(nao respondido|sem resposta|contatado|respondido|contato feito|em contato)/.test(text)) return 'Contatado';
  if (/(novo|pendente|aguardando|lead)/.test(text)) return 'Novo lead';
  return '';
}

export function normalizeOrigin(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (text.includes('instagram')) return 'Instagram';
  if (text.includes('google') || text.includes('maps')) return 'Google Maps';
  if (text.includes('indic')) return 'Indicação';
  if (text.includes('whatsapp') || text === 'zap') return 'WhatsApp';
  if (text.includes('site') || text.includes('web')) return 'Site';
  return 'Outro';
}

const cellAt = (row, index) => index === '' || index == null ? '' : row[Number(index)] ?? '';

function appendNotes(base, extra) {
  const left = String(base || '').trim();
  const right = String(extra || '').trim();
  if (!right || left.includes(right)) return left;
  return left ? `${left}\n${right}` : right;
}

function extractHeaderlessPdfRows(headers, rows, mapping) {
  if (mapping.phone === '' || mapping.phone == null) return null;
  const phoneIndex = Number(mapping.phone);
  const headerPhone = embeddedPhone(headers[phoneIndex]);
  const sameIdentityColumn = Number(mapping.name) === phoneIndex || Number(mapping.company) === phoneIndex;
  if (!headerPhone || !sameIdentityColumn) return null;

  const sourceRows = [headers, ...rows];
  const extracted = [];
  let pendingIdentity = '';

  sourceRows.forEach((row, index) => {
    const cells = (Array.isArray(row) ? row : []).map(cell => String(cell ?? '').trim()).filter(Boolean);
    if (!cells.length) return;
    const joined = cells.join(' ').replace(/\s+/g, ' ').trim();
    const phone = embeddedPhone(joined);

    if (!phone) {
      const statusOnly = normalizeStatus(joined);
      if (!statusOnly && joined.length > 1) pendingIdentity = joined;
      return;
    }

    const phoneAt = joined.indexOf(phone);
    const beforePhone = phoneAt >= 0 ? joined.slice(0, phoneAt) : joined;
    const afterPhone = phoneAt >= 0 ? joined.slice(phoneAt + phone.length) : '';
    const identity = cleanEmbeddedIdentity(beforePhone, '') || pendingIdentity;
    const status = normalizeStatus(afterPhone) || normalizeStatus(cells.slice(1).join(' '));

    if (identity && validBrazilPhone(canonicalPhone(phone))) {
      extracted.push({ row: [identity, phone, status], line: index + 1 });
      pendingIdentity = '';
    }
  });

  return extracted.length ? extracted : null;
}

export function analyzeImport({ headers = [], rows = [], mapping = {}, existingLeads = [] }) {
  const errors = [];
  const warnings = [];
  const grouped = new Map();
  const headerlessPdfRows = extractHeaderlessPdfRows(headers, rows, mapping);
  const effectiveMapping = headerlessPdfRows
    ? { ...mapping, name: 0, company: '', phone: 1, status: 2, value: '', origin: '', nextContact: '', nextContactTime: '', nextAction: '', notes: '' }
    : mapping;
  const rowEntries = headerlessPdfRows || rows.map((row, index) => ({ row, line: index + 2 }));

  rowEntries.forEach(({ row, line }) => {
    const company = String(cellAt(row, effectiveMapping.company)).trim();
    const name = String(cellAt(row, effectiveMapping.name)).trim() || company;
    const rawPhone = cellAt(row, effectiveMapping.phone);
    const phone = canonicalPhone(rawPhone);
    if (!name) {
      errors.push({ line, message: 'Sem nome do cliente ou empresa.' });
      return;
    }
    if (!validBrazilPhone(phone)) {
      errors.push({ line, message: `WhatsApp inválido: ${String(rawPhone || 'vazio')}.` });
      return;
    }

    const rawValue = cellAt(row, effectiveMapping.value);
    const value = parseMoney(rawValue);
    if (rawValue !== '' && rawValue != null && value == null) warnings.push({ line, message: 'Valor não reconhecido e ignorado.' });
    if (value != null && value < 0) {
      errors.push({ line, message: 'Valor negativo não pode ser importado.' });
      return;
    }

    const rawDate = cellAt(row, effectiveMapping.nextContact);
    const nextContact = normalizeDate(rawDate);
    if (rawDate !== '' && rawDate != null && !nextContact) warnings.push({ line, message: 'Data de próximo contato não reconhecida e ignorada.' });
    const status = normalizeStatus(cellAt(row, effectiveMapping.status));
    const origin = normalizeOrigin(cellAt(row, effectiveMapping.origin));
    const entry = {
      line,
      name,
      phone,
      company,
      value,
      status,
      origin,
      nextContact,
      nextContactTime: normalizeTime(cellAt(row, effectiveMapping.nextContactTime)),
      nextAction: String(cellAt(row, effectiveMapping.nextAction)).trim(),
      notes: String(cellAt(row, effectiveMapping.notes)).trim(),
    };

    if (status === 'Vendido' && !(Number(value) > 0)) {
      errors.push({ line, message: 'Status vendido exige um valor maior que zero.' });
      return;
    }

    if (grouped.has(phone)) {
      const previous = grouped.get(phone);
      grouped.set(phone, {
        ...previous,
        ...Object.fromEntries(Object.entries(entry).filter(([key, current]) => !['line', 'notes'].includes(key) && current !== '' && current != null)),
        line: previous.line,
        notes: appendNotes(previous.notes, entry.notes),
        duplicateCount: (previous.duplicateCount || 1) + 1,
      });
    } else {
      grouped.set(phone, { ...entry, duplicateCount: 1 });
    }
  });

  const existingByPhone = new Map(existingLeads.map(lead => [canonicalPhone(lead.phone), lead]));
  const now = new Date().toISOString();
  const records = [];

  for (const entry of grouped.values()) {
    const existing = existingByPhone.get(entry.phone);
    const importedStatus = entry.status;
    const status = importedStatus || existing?.status || 'Novo lead';
    const nextContact = CLOSED.includes(status) ? '' : (entry.nextContact || existing?.nextContact || '');
    const nextContactTime = CLOSED.includes(status) ? '' : (entry.nextContactTime || existing?.nextContactTime || '');
    const nextAction = CLOSED.includes(status) ? '' : (entry.nextAction || existing?.nextAction || '');
    const value = entry.value != null ? entry.value : Number(existing?.value || 0);
    const notes = appendNotes(existing?.notes, entry.notes);
    const base = {
      ...(existing || {}),
      name: entry.name || existing?.name || 'Lead sem nome',
      company: entry.company || existing?.company || '',
      phone: entry.phone,
      value,
      status,
      origin: entry.origin || existing?.origin || 'Outro',
      nextContact,
      nextContactTime,
      nextAction,
      notes,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
      lastFollowupAt: existing?.lastFollowupAt || null,
      soldAt: status === 'Vendido' ? (existing?.soldAt || now) : null,
      lostAt: status === 'Perdido' ? (existing?.lostAt || now) : null,
      saleValue: status === 'Vendido' ? Number(entry.value ?? existing?.saleValue ?? value) : null,
      saleValueSource: status === 'Vendido' ? 'confirmed' : null,
    };
    records.push({
      mode: existing ? 'update' : 'create',
      lead: base,
      existingId: existing?.id || null,
      sourceLine: entry.line,
      duplicateCount: entry.duplicateCount,
    });
  }

  const duplicateRows = [...grouped.values()].reduce((sum, item) => sum + Math.max(0, item.duplicateCount - 1), 0);
  return {
    records,
    errors,
    warnings,
    stats: {
      rows: rowEntries.length,
      valid: records.length,
      create: records.filter(record => record.mode === 'create').length,
      update: records.filter(record => record.mode === 'update').length,
      duplicateRows,
      errors: errors.length,
    },
    headers,
  };
}
