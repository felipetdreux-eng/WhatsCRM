import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import {
  IMPORT_FIELDS,
  analyzeImport,
  detectMapping,
  normalizeStatus,
  parseDelimitedText,
} from './importUtils';
import './import.css';

const ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,.pdf';
const SHEET_FORMATS = new Set(['xlsx', 'xls', 'xlsm', 'ods']);
const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
const FUPLY_STATUSES = new Set(['Novo lead', 'Contatado', 'Interessado', 'Proposta enviada', 'Negociação', 'Fechado', 'Perdido']);

function cleanMatrix(matrix) {
  return (Array.isArray(matrix) ? matrix : [])
    .map(row => Array.isArray(row) ? row : [])
    .filter(row => row.some(cell => String(cell ?? '').trim()));
}

function plainText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeNegotiationStatus(value) {
  const text = plainText(value);
  if (!text || /^(vazio|sem status|sem etapa|n\/a|-)$/.test(text)) return '';
  return normalizeStatus(value) || String(value ?? '').trim();
}

function hasMapped(mapping, key) {
  return mapping?.[key] !== '' && mapping?.[key] != null;
}

function enhanceMapping(headers, baseMapping) {
  const mapping = { ...baseMapping };
  if (!hasMapped(mapping, 'status')) {
    const index = headers.findIndex(header => {
      const text = plainText(header);
      return text === 'estado da negociacao'
        || text === 'estado negociacao'
        || text === 'status da negociacao'
        || text === 'situacao da negociacao'
        || text === 'situacao negociacao'
        || text === 'estado da venda';
    });
    if (index >= 0) mapping.status = index;
  }
  return mapping;
}

function normalizeStatusColumn(rows, mapping) {
  if (!hasMapped(mapping, 'status')) return rows;
  const statusIndex = Number(mapping.status);
  return rows.map(row => {
    const next = [...row];
    next[statusIndex] = normalizeNegotiationStatus(next[statusIndex]);
    return next;
  });
}

function pdfHeaderScore(row) {
  const headers = (Array.isArray(row) ? row : []).map(cell => String(cell ?? '').trim());
  const mapping = enhanceMapping(headers, detectMapping(headers));
  const recognized = Object.values(mapping).filter(value => value !== '' && value != null).length;
  const hasPhone = hasMapped(mapping, 'phone');
  const hasIdentity = hasMapped(mapping, 'name') || hasMapped(mapping, 'company');
  return {
    score: (hasPhone ? 7 : 0) + (hasIdentity ? 6 : 0) + recognized,
    mapping,
  };
}

function looksLikePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

function extractPdfNegotiationStates(matrix, expectedCount) {
  const states = [];
  let collecting = false;

  for (const row of cleanMatrix(matrix)) {
    const cells = row.map(cell => String(cell ?? '').trim()).filter(Boolean);
    if (!cells.length) continue;

    const mapping = enhanceMapping(cells, detectMapping(cells));
    if (hasMapped(mapping, 'status')) {
      collecting = true;
      continue;
    }
    if (!collecting) continue;

    // Stop before a later horizontal block such as Valor/Observações.
    if ((hasMapped(mapping, 'value') || hasMapped(mapping, 'notes')) && !hasMapped(mapping, 'status')) break;

    const statusCell = cells.find(cell => FUPLY_STATUSES.has(normalizeNegotiationStatus(cell)));
    if (statusCell) {
      states.push(normalizeNegotiationStatus(statusCell));
    } else if (cells.some(cell => /^(vazio|sem status|sem etapa|-)$/.test(plainText(cell)))) {
      // Some exported sheets print the word "Vazio" for blank status rows.
      // Keep the placeholder so following rows stay aligned with the contacts.
      states.push('');
    }

    if (states.length >= expectedCount) break;
  }

  return states;
}

function extractPdfContactMatrix(matrix) {
  const contacts = [];

  cleanMatrix(matrix).forEach(row => {
    const cells = row.map(cell => String(cell ?? '').trim()).filter(Boolean);
    const phoneAt = cells.findIndex(looksLikePhone);
    if (phoneAt <= 0) return;

    const identity = cells.slice(0, phoneAt).join(' ').trim();
    const phone = cells[phoneAt];
    if (!identity || !phone) return;

    contacts.push([identity, phone]);
  });

  // Excel/Sheets PDFs often print one logical spreadsheet in horizontal page
  // blocks: contact columns on pages 1-2, status columns later, notes later still.
  // Rebuild the status block by row order so the state of each negotiation is
  // not lost just because the PDF printer threw the columns onto other pages.
  if (contacts.length < 3) return null;

  const states = extractPdfNegotiationStates(matrix, contacts.length);
  if (states.length) {
    return [
      ['Estabelecimento', 'WhatsApp', 'Status'],
      ...contacts.map((contact, index) => [...contact, states[index] || '']),
    ];
  }

  return [['Estabelecimento', 'WhatsApp'], ...contacts];
}

function alignPdfRow(row, headerCount, mapping) {
  const cells = (Array.isArray(row) ? row : []).map(cell => String(cell ?? '').trim());
  if (!cells.length || !headerCount) return cells;

  const phoneColumn = hasMapped(mapping, 'phone') ? Number(mapping.phone) : -1;
  const identityColumn = hasMapped(mapping, 'name')
    ? Number(mapping.name)
    : hasMapped(mapping, 'company')
      ? Number(mapping.company)
      : -1;
  const phoneAt = cells.findIndex(looksLikePhone);

  if (phoneColumn < 0 || phoneAt < 0 || cells.length === headerCount) {
    if (cells.length >= headerCount) return cells;
    return [...cells, ...Array(headerCount - cells.length).fill('')];
  }

  const aligned = Array(headerCount).fill('');
  aligned[phoneColumn] = cells[phoneAt];

  const beforePhone = cells.slice(0, phoneAt).filter(Boolean);
  const afterPhone = cells.slice(phoneAt + 1).filter(Boolean);

  if (identityColumn >= 0 && identityColumn !== phoneColumn && beforePhone.length) {
    aligned[identityColumn] = beforePhone.join(' ');
  }

  const remainingColumns = Array.from({ length: headerCount }, (_, index) => index)
    .filter(index => index !== phoneColumn && index !== identityColumn);
  const afterColumns = remainingColumns.filter(index => index > phoneColumn);
  const beforeColumns = remainingColumns.filter(index => index < phoneColumn);

  afterPhone.forEach((value, index) => {
    const target = afterColumns[index] ?? remainingColumns[index];
    if (target != null && !aligned[target]) aligned[target] = value;
  });

  if (identityColumn < 0) {
    beforePhone.forEach((value, index) => {
      const target = beforeColumns[index];
      if (target != null && !aligned[target]) aligned[target] = value;
    });
  }

  return aligned;
}

function normalizePdfMatrix(matrix) {
  const cleaned = cleanMatrix(matrix);
  if (cleaned.length < 2) return cleaned;

  let bestIndex = -1;
  let bestScore = -1;
  let bestMapping = null;

  cleaned.forEach((row, index) => {
    const candidate = pdfHeaderScore(row);
    if (candidate.score > bestScore) {
      bestIndex = index;
      bestScore = candidate.score;
      bestMapping = candidate.mapping;
    }
  });

  const hasRequiredColumns = hasMapped(bestMapping, 'phone')
    && (hasMapped(bestMapping, 'name') || hasMapped(bestMapping, 'company'));

  // PDFs exported from Excel frequently contain titles, totals and instructions
  // before the actual table. Only promote a row to header when we can identify
  // both the phone and an identity column with confidence.
  if (!hasRequiredColumns || bestScore < 15) return cleaned;

  const headers = cleaned[bestIndex].map((header, index) => String(header || `Coluna ${index + 1}`).trim());
  const headerCount = headers.length;
  const rows = cleaned
    .slice(bestIndex + 1)
    .filter(row => {
      const candidate = pdfHeaderScore(row);
      const repeatedHeader = hasMapped(candidate.mapping, 'phone')
        && (hasMapped(candidate.mapping, 'name') || hasMapped(candidate.mapping, 'company'))
        && candidate.score >= 15;
      return !repeatedHeader;
    })
    .map(row => alignPdfRow(row, headerCount, bestMapping))
    .filter(row => row.some(cell => String(cell ?? '').trim()));

  return [headers, ...rows];
}

function pdfItemsToRow(items) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  const cells = [];
  let current = '';
  let lastEnd = null;

  ordered.forEach(item => {
    const text = String(item.text || '').trim();
    if (!text) return;
    const gap = lastEnd == null ? 0 : item.x - lastEnd;

    if (current && gap > 14) {
      cells.push(current.trim());
      current = text;
    } else {
      current = current ? `${current}${gap > 2 ? ' ' : ''}${text}` : text;
    }

    lastEnd = Math.max(lastEnd ?? item.x, item.x + Math.max(0, item.width || 0));
  });

  if (current.trim()) cells.push(current.trim());
  return cells;
}

async function readPdf(file) {
  const pdfjs = await import(/* @vite-ignore */ PDFJS_URL);
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pdf = await loadingTask.promise;
  const matrix = [];
  let extractedItems = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rowGroups = [];

    content.items.forEach(item => {
      const text = String(item?.str || '').trim();
      if (!text || !Array.isArray(item?.transform)) return;
      extractedItems += 1;
      const x = Number(item.transform[4] || 0);
      const y = Number(item.transform[5] || 0);
      const width = Number(item.width || 0);
      let group = rowGroups.find(row => Math.abs(row.y - y) <= 3);
      if (!group) {
        group = { y, items: [] };
        rowGroups.push(group);
      }
      group.items.push({ text, x, width });
    });

    rowGroups
      .sort((a, b) => b.y - a.y)
      .map(row => pdfItemsToRow(row.items))
      .filter(row => row.length)
      .forEach(row => matrix.push(row));
  }

  if (!extractedItems) {
    throw new Error('Esse PDF parece ser escaneado ou só imagem. Exporte a tabela como PDF com texto selecionável, CSV ou Excel.');
  }

  const contactMatrix = extractPdfContactMatrix(matrix);
  if (contactMatrix) return contactMatrix;
  return normalizePdfMatrix(matrix);
}

async function readSpreadsheet(file) {
  const extension = String(file?.name || '').toLowerCase().split('.').pop();
  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
    return cleanMatrix(parseDelimitedText(await file.text()));
  }
  if (SHEET_FORMATS.has(extension)) {
    const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) return [];
    return cleanMatrix(XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false }));
  }
  if (extension === 'pdf') return readPdf(file);
  throw new Error('Formato não suportado. Use CSV, TSV, XLSX, XLS, XLSM, ODS ou PDF.');
}

export default function LeadImporter({ leads = [], setLeads, onClose, onActivity, onDone }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const analysis = useMemo(() => analyzeImport({ headers, rows, mapping, existingLeads: leads }), [headers, rows, mapping, leads]);
  const mappedPhone = mapping.phone !== '' && mapping.phone != null;
  const mappedIdentity = (mapping.name !== '' && mapping.name != null) || (mapping.company !== '' && mapping.company != null);
  const ready = rows.length > 0 && mappedPhone && mappedIdentity && analysis.records.length > 0;

  const loadFile = async file => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('O arquivo é grande demais. Use um arquivo de até 12 MB.');
      const matrix = await readSpreadsheet(file);
      if (matrix.length < 2) throw new Error('Não encontrei linhas de dados. A primeira linha deve conter os títulos das colunas.');
      const nextHeaders = matrix[0].map((header, index) => String(header || `Coluna ${index + 1}`).trim());
      const nextMapping = enhanceMapping(nextHeaders, detectMapping(nextHeaders));
      const nextRows = normalizeStatusColumn(matrix.slice(1), nextMapping);
      setFileName(file.name);
      setHeaders(nextHeaders);
      setRows(nextRows);
      setMapping(nextMapping);
    } catch (loadError) {
      console.error('Spreadsheet import failed:', loadError);
      setFileName('');
      setHeaders([]);
      setRows([]);
      setMapping({});
      const message = String(loadError?.message || '');
      if (/password/i.test(message)) setError('Esse PDF está protegido por senha. Remova a senha e tente novamente.');
      else setError(message || 'Não foi possível ler esse arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!ready || applying) return;
    setApplying(true);
    const created = analysis.records
      .filter(record => record.mode === 'create')
      .map(record => ({ ...record.lead, id: crypto.randomUUID() }));
    const updates = new Map(analysis.records
      .filter(record => record.mode === 'update')
      .map(record => [record.existingId, { ...record.lead, id: record.existingId }]));

    setLeads(current => {
      const updated = current.map(lead => updates.get(lead.id) || lead);
      return [...created, ...updated];
    });

    analysis.records.filter(record => record.mode === 'update').forEach(record => {
      const previous = leads.find(lead => lead.id === record.existingId);
      if (previous) onActivity?.(previous, 'lead_updated', 'Lead atualizado por planilha', `Dados importados da linha ${record.sourceLine}.`, { source: 'spreadsheet_import' });
    });

    onDone?.({ ...analysis.stats, fileName });
    window.setTimeout(() => {
      setApplying(false);
      onClose?.();
    }, 80);
  };

  return (
    <div className="modal-backdrop import-backdrop" onMouseDown={() => !applying && onClose?.()}>
      <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-header import-header">
          <div><h2 id="import-title">Importar contatos</h2><p>Traga sua base atual por planilha ou PDF sem cadastrar cliente por cliente.</p></div>
          <button type="button" className="icon-button" onClick={onClose} disabled={applying} aria-label="Fechar"><X size={20} /></button>
        </div>

        {!rows.length ? (
          <>
            <button
              type="button"
              className={`import-dropzone ${dragging ? 'dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={event => { event.preventDefault(); setDragging(true); }}
              onDragOver={event => event.preventDefault()}
              onDragLeave={event => { event.preventDefault(); setDragging(false); }}
              onDrop={event => { event.preventDefault(); setDragging(false); loadFile(event.dataTransfer.files?.[0]); }}
              disabled={loading}
            >
              <div className="import-drop-icon"><FileSpreadsheet size={28} /></div>
              <strong>{loading ? 'Lendo arquivo...' : 'Arraste sua planilha ou PDF aqui'}</strong>
              <span>ou clique para escolher um arquivo</span>
              <small>CSV, TSV, XLSX, XLS, XLSM, ODS ou PDF · até 12 MB</small>
            </button>
            <input ref={inputRef} className="sr-only" type="file" accept={ACCEPT} onChange={event => loadFile(event.target.files?.[0])} />
            <div className="import-security"><CheckCircle2 size={16} /><span>O arquivo só vira lead depois da sua confirmação. PDFs precisam ter texto selecionável; PDF escaneado ainda não dá para ler automaticamente.</span></div>
          </>
        ) : (
          <>
            <div className="import-filebar">
              <div><FileSpreadsheet size={18} /><span><strong>{fileName}</strong><small>{rows.length} linhas encontradas</small></span></div>
              <button type="button" onClick={() => { setRows([]); setHeaders([]); setMapping({}); setFileName(''); setError(''); }}>Trocar arquivo</button>
            </div>

            <section className="import-section">
              <div className="import-section-head"><div><h3>1. Confira as colunas</h3><p>O Fuply tentou reconhecer tudo sozinho. Ajuste só o que estiver errado.</p></div></div>
              <div className="import-mapping">
                {IMPORT_FIELDS.map(field => (
                  <label key={field.key} className={(field.key === 'phone' || field.key === 'name') ? 'important' : ''}>
                    <span>{field.label}{field.key === 'phone' ? ' *' : ''}</span>
                    <select value={mapping[field.key] ?? ''} onChange={event => setMapping(current => ({ ...current, [field.key]: event.target.value === '' ? '' : Number(event.target.value) }))}>
                      <option value="">Não importar</option>
                      {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Coluna ${index + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {!mappedPhone && <div className="import-inline-error"><AlertTriangle size={15} /> Escolha qual coluna contém o WhatsApp.</div>}
              {!mappedIdentity && <div className="import-inline-error"><AlertTriangle size={15} /> Escolha Nome ou Empresa para identificar o cliente.</div>}
            </section>

            <section className="import-section">
              <div className="import-section-head"><div><h3>2. Revise o que vai acontecer</h3><p>WhatsApp repetido é tratado como o mesmo cliente, não como clones malignos no CRM.</p></div></div>
              <div className="import-stats">
                <div><span>Novos leads</span><strong>{analysis.stats.create}</strong></div>
                <div><span>Atualizações</span><strong>{analysis.stats.update}</strong></div>
                <div><span>Duplicados unidos</span><strong>{analysis.stats.duplicateRows}</strong></div>
                <div className={analysis.stats.errors ? 'danger' : ''}><span>Linhas com erro</span><strong>{analysis.stats.errors}</strong></div>
              </div>

              {analysis.records.length > 0 && (
                <div className="import-preview-wrap">
                  <table className="import-preview">
                    <thead><tr><th>Ação</th><th>Cliente</th><th>WhatsApp</th><th>Status</th><th>Valor</th></tr></thead>
                    <tbody>{analysis.records.slice(0, 8).map(record => (
                      <tr key={`${record.lead.phone}-${record.sourceLine}`}>
                        <td><span className={`import-mode ${record.mode}`}>{record.mode === 'create' ? 'Criar' : 'Atualizar'}</span></td>
                        <td><strong>{record.lead.name}</strong><small>{record.lead.company || 'Sem empresa'}</small></td>
                        <td>{record.lead.phone}</td>
                        <td>{record.lead.status}</td>
                        <td>{Number(record.lead.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {analysis.records.length > 8 && <div className="import-preview-more">+ {analysis.records.length - 8} clientes na importação</div>}
                </div>
              )}

              {(analysis.errors.length > 0 || analysis.warnings.length > 0) && (
                <div className="import-issues">
                  {analysis.errors.slice(0, 5).map(issue => <div className="error" key={`e-${issue.line}-${issue.message}`}><AlertTriangle size={14} /><span>Linha {issue.line}: {issue.message}</span></div>)}
                  {analysis.warnings.slice(0, 3).map(issue => <div className="warning" key={`w-${issue.line}-${issue.message}`}><AlertTriangle size={14} /><span>Linha {issue.line}: {issue.message}</span></div>)}
                  {analysis.errors.length > 5 && <small>Mais {analysis.errors.length - 5} linhas com erro serão ignoradas.</small>}
                </div>
              )}
            </section>
          </>
        )}

        {error && <div className="import-error" role="alert"><AlertTriangle size={16} />{error}</div>}

        <footer className="import-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={applying}>Cancelar</button>
          {rows.length > 0 && (
            <button type="button" className="primary-button" disabled={!ready || applying} onClick={apply}>
              {applying ? <><RefreshCw size={16} className="spin" /> Importando...</> : <><Upload size={16} /> Importar {analysis.records.length} lead{analysis.records.length === 1 ? '' : 's'}</>}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
