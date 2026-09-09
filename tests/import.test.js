import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeImport,
  detectMapping,
  normalizeDate,
  normalizeStatus,
  parseDelimitedText,
  parseMoney,
} from '../src/importUtils.js';

test('lê CSV brasileiro com ponto e vírgula e aspas', () => {
  const rows = parseDelimitedText('Nome;WhatsApp;Observações\n"João Silva";21999999999;"Pediu site; urgente"');
  assert.deepEqual(rows[0], ['Nome', 'WhatsApp', 'Observações']);
  assert.equal(rows[1][2], 'Pediu site; urgente');
});

test('detecta colunas comuns automaticamente', () => {
  const mapping = detectMapping(['Cliente', 'Celular', 'Valor Total', 'Situação', 'Pedido']);
  assert.equal(mapping.name, 0);
  assert.equal(mapping.phone, 1);
  assert.equal(mapping.value, 2);
  assert.equal(mapping.status, 3);
  assert.equal(mapping.notes, 4);
});

test('normaliza valores, datas e status de planilhas reais', () => {
  assert.equal(parseMoney('R$ 1.250,90'), 1250.9);
  assert.equal(normalizeDate('09/09/2026'), '2026-09-09');
  assert.equal(normalizeStatus('Orçamento enviado'), 'Proposta enviada');
  assert.equal(normalizeStatus('Pago'), 'Vendido');
});

test('une WhatsApps repetidos e reconhece cliente existente', () => {
  const headers = ['Nome', 'WhatsApp', 'Pedido', 'Valor', 'Status'];
  const mapping = detectMapping(headers);
  const rows = [
    ['Ana', '21999999999', 'Landing page', '500,00', 'Interessado'],
    ['Ana', '21999999999', 'Também pediu logo', '650,00', 'Proposta enviada'],
    ['Bruno', '21999999998', 'Site', '900,00', 'Novo'],
  ];
  const existingLeads = [{ id: 'existing-id', name: 'Ana antiga', phone: '21999999999', status: 'Contatado', value: 300, origin: 'Outro', notes: '' }];
  const result = analyzeImport({ headers, rows, mapping, existingLeads });
  assert.equal(result.stats.update, 1);
  assert.equal(result.stats.create, 1);
  assert.equal(result.stats.duplicateRows, 1);
  const ana = result.records.find(record => record.existingId === 'existing-id');
  assert.equal(ana.lead.status, 'Proposta enviada');
  assert.equal(ana.lead.value, 650);
  assert.match(ana.lead.notes, /Landing page/);
  assert.match(ana.lead.notes, /Também pediu logo/);
});
