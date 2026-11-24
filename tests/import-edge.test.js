import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeImport,
  detectMapping,
  normalizeDate,
  normalizeOrigin,
  normalizeStatus,
  normalizeText,
  normalizeTime,
  parseDelimitedText,
  parseMoney,
} from '../src/importUtils.js';

test('CSV com vírgula, aspas com vírgula dentro, CRLF e linhas vazias', () => {
  const rows = parseDelimitedText('Nome,Telefone\r\n"Silva, João",21999999999\r\n\r\n,\nAna,21988887777');
  assert.deepEqual(rows, [
    ['Nome', 'Telefone'],
    ['Silva, João', '21999999999'],
    ['Ana', '21988887777'],
  ]);
});

test('CSV com ponto e vírgula vence a vírgula quando ela só aparece nos valores', () => {
  const rows = parseDelimitedText('Nome;Valor;Obs\nAna;1.250,90;"Quer site, logo"');
  assert.deepEqual(rows[1], ['Ana', '1.250,90', 'Quer site, logo']);
});

test('CSV com tab, BOM do Excel e aspas escapadas', () => {
  const rows = parseDelimitedText('﻿Nome\tObs\nAna\t"Disse ""ok"""');
  assert.deepEqual(rows, [['Nome', 'Obs'], ['Ana', 'Disse "ok"']]);
});

test('quebra de linha dentro de aspas fica na mesma célula', () => {
  const rows = parseDelimitedText('Nome;Obs\nAna;"linha 1\nlinha 2"');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'linha 1\nlinha 2');
});

test('parseDelimitedText aguenta entrada vazia e null', () => {
  assert.deepEqual(parseDelimitedText(''), []);
  assert.deepEqual(parseDelimitedText(null), []);
});

test('normalizeText remove acentos, caixa e separadores', () => {
  assert.equal(normalizeText('  Próximo_Contato-Data '), 'proximo contato data');
  assert.equal(normalizeText('SITUAÇÃO'), 'situacao');
  assert.equal(normalizeText(null), '');
});

test('detectMapping reconhece cabeçalhos com acento e caixa alta', () => {
  const mapping = detectMapping(['NOME', 'TELEFONE', 'EMPRESA', 'ORÇAMENTO', 'SITUAÇÃO', 'ORIGEM', 'PRÓXIMO CONTATO', 'HORÁRIO', 'PRÓXIMA AÇÃO', 'OBSERVAÇÕES']);
  assert.deepEqual(mapping, {
    name: 0, phone: 1, company: 2, value: 3, status: 4, origin: 5,
    nextContact: 6, nextContactTime: 7, nextAction: 8, notes: 9,
  });
});

test('detectMapping não usa a mesma coluna para dois campos', () => {
  const mapping = detectMapping(['Nome', 'Celular']);
  assert.equal(mapping.name, 0);
  assert.equal(mapping.phone, 1);
  assert.equal(mapping.company, '');
  assert.equal(mapping.value, '');
});

test('parseMoney aceita formatos brasileiros comuns', () => {
  assert.equal(parseMoney('R$ 1.250,90'), 1250.9);
  assert.equal(parseMoney('R$ 1.500.000,00'), 1500000);
  assert.equal(parseMoney('1250,5'), 1250.5);
  assert.equal(parseMoney(' 1 250,00'), 1250);
  assert.equal(parseMoney('99.90'), 99.9);
  assert.equal(parseMoney('R$ 0,00'), 0);
  assert.equal(parseMoney(350), 350);
  assert.equal(parseMoney(Number.NaN), null);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('   '), null);
  assert.equal(parseMoney(null), null);
  assert.equal(parseMoney('-'), null);
});

// Possível bug (não corrigido): formato americano com milhar em vírgula
// vira número errado. É raro numa base brasileira; registrado no relatório.
test.todo('parseMoney("1,250.50") deveria ser 1250.5 e hoje é 1.2505');

test('normalizeDate aceita dd/mm/aaaa, d/m/aa, ISO e serial do Excel', () => {
  assert.equal(normalizeDate('09/09/2026'), '2026-09-09');
  assert.equal(normalizeDate('1/2/26'), '2026-02-01');
  assert.equal(normalizeDate('9-3-2026'), '2026-03-09');
  assert.equal(normalizeDate('2026/9/9'), '2026-09-09');
  assert.equal(normalizeDate('2026-09-09T10:00:00'), '2026-09-09');
  assert.equal(normalizeDate(45000), '2023-03-15');
  assert.equal(normalizeDate(new Date(2030, 0, 15, 23, 30)), '2030-01-15');
});

test('normalizeDate devolve vazio para lixo e data inválida', () => {
  assert.equal(normalizeDate(''), '');
  assert.equal(normalizeDate(null), '');
  assert.equal(normalizeDate('amanhã'), '');
  assert.equal(normalizeDate('09.09.2026'), '');
  assert.equal(normalizeDate(new Date('invalid')), '');
});

test('normalizeTime aceita H:MM e descarta horários impossíveis', () => {
  assert.equal(normalizeTime('8:30'), '08:30');
  assert.equal(normalizeTime('08:30:15'), '08:30');
  assert.equal(normalizeTime('24:00'), '');
  assert.equal(normalizeTime('12:60'), '');
  assert.equal(normalizeTime('9h30'), '');
  assert.equal(normalizeTime(''), '');
});

test('normalizeStatus cobre negativas comuns de planilha', () => {
  assert.equal(normalizeStatus('Não interessado'), 'Perdido');
  assert.equal(normalizeStatus('sem interesse'), 'Perdido');
  assert.equal(normalizeStatus('Ganho'), 'Fechado');
  assert.equal(normalizeStatus('quente'), 'Interessado');
  assert.equal(normalizeStatus('Respondido'), 'Contatado');
  assert.equal(normalizeStatus('Aguardando pagamento'), 'Novo lead');
  assert.equal(normalizeStatus('xyz'), '');
  assert.equal(normalizeStatus(''), '');
});

// Possível bug (não corrigido): negação antes de "fechado" ainda vira venda.
// Não sei qual etapa o Felipe quer para "Não fechado" (Perdido? Negociação?).
test.todo('normalizeStatus("Não fechado") não deveria virar Fechado');

test('normalizeOrigin agrupa variações', () => {
  assert.equal(normalizeOrigin('Insta / Instagram Ads'), 'Instagram');
  assert.equal(normalizeOrigin('google meu negócio'), 'Google Maps');
  assert.equal(normalizeOrigin('Indicação do Pedro'), 'Indicação');
  assert.equal(normalizeOrigin('zap'), 'WhatsApp');
  assert.equal(normalizeOrigin('Website'), 'Site');
  assert.equal(normalizeOrigin('Feira'), 'Outro');
  assert.equal(normalizeOrigin(''), '');
});

const HEADERS = ['Nome', 'WhatsApp', 'Valor', 'Status', 'Próximo contato'];

test('analyzeImport rejeita linha sem nome e sem telefone válido, com número da linha', () => {
  const mapping = detectMapping(HEADERS);
  const result = analyzeImport({
    headers: HEADERS,
    rows: [
      ['', '21999999999', '', '', ''],
      ['Ana', '(21) 9999-9999', '', '', ''],
      ['Bia', '', '', '', ''],
      ['Caio', '+55 21 98888-7777', '', '', ''],
    ],
    mapping,
  });
  assert.deepEqual(result.errors.map(error => error.line), [2, 3, 4]);
  assert.match(result.errors[2].message, /vazio/);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].lead.phone, '21988887777');
});

test('analyzeImport junta o mesmo número escrito de jeitos diferentes', () => {
  const mapping = detectMapping(HEADERS);
  const result = analyzeImport({
    headers: HEADERS,
    rows: [
      ['José', '+55 (21) 99999-0000', '', '', ''],
      ['José Souza', '21 99999 0000', '', '', ''],
    ],
    mapping,
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.stats.duplicateRows, 1);
  assert.equal(result.records[0].lead.name, 'José Souza');
});

test('analyzeImport recusa valor negativo e venda sem valor', () => {
  const mapping = detectMapping(HEADERS);
  const result = analyzeImport({
    headers: HEADERS,
    rows: [
      ['Ana', '21999999999', '-50', '', ''],
      ['Bia', '21999999998', '', 'Vendido', ''],
    ],
    mapping,
  });
  assert.equal(result.records.length, 0);
  assert.equal(result.errors.length, 2);
});

test('lead fechado na importação perde próximo contato e ganha soldAt e saleValue', () => {
  const mapping = detectMapping(HEADERS);
  const result = analyzeImport({
    headers: HEADERS,
    rows: [['Ana', '21999999999', '1.250,00', 'Pago', '10/10/2030']],
    mapping,
  });
  const lead = result.records[0].lead;
  assert.equal(lead.status, 'Fechado');
  assert.equal(lead.nextContact, '');
  assert.equal(lead.saleValue, 1250);
  assert.ok(lead.soldAt);
  assert.equal(lead.lostAt, null);
});

test('data de próximo contato não reconhecida vira aviso, não erro', () => {
  const mapping = detectMapping(HEADERS);
  const result = analyzeImport({
    headers: HEADERS,
    rows: [['Ana', '21999999999', '', '', 'semana que vem']],
    mapping,
  });
  assert.equal(result.records.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.records[0].lead.nextContact, '');
});

test('atualização mantém dados existentes quando a planilha vem vazia', () => {
  const mapping = detectMapping(HEADERS);
  const existingLeads = [{
    id: 'x', name: 'Ana', phone: '5521999999999', status: 'Negociação', value: 900,
    origin: 'Site', notes: 'antiga', nextContact: '2030-02-01', createdAt: '2030-01-01T00:00:00.000Z',
  }];
  const result = analyzeImport({
    headers: HEADERS,
    rows: [['Ana Paula', '21999999999', '', '', '']],
    mapping,
    existingLeads,
  });
  const record = result.records[0];
  assert.equal(record.mode, 'update');
  assert.equal(record.existingId, 'x');
  assert.equal(record.lead.status, 'Negociação');
  assert.equal(record.lead.value, 900);
  assert.equal(record.lead.origin, 'Site');
  assert.equal(record.lead.nextContact, '2030-02-01');
  assert.equal(record.lead.createdAt, '2030-01-01T00:00:00.000Z');
  assert.equal(record.lead.name, 'Ana Paula');
});

test('nome com acento e empresa como fallback de nome', () => {
  const headers = ['Empresa', 'Telefone'];
  const mapping = detectMapping(headers);
  const result = analyzeImport({ headers, rows: [['Padaria São João', '11 3222-1234']], mapping });
  assert.equal(result.records[0].lead.name, 'Padaria São João');
  assert.equal(result.records[0].lead.company, 'Padaria São João');
});
