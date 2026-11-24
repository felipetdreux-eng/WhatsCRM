import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImport, detectMapping, normalizeDate, parseMoney } from '../src/importUtils.js';

const HEADERS = ['Nome', 'WhatsApp', 'Valor', 'Próximo contato'];

test('bug: valor em texto ("a combinar") não pode virar zero', () => {
  assert.equal(parseMoney('a combinar'), null);
  assert.equal(parseMoney('R$ ?'), null);

  // Antes: o 0 sobrescrevia o valor do lead existente e nenhum aviso aparecia.
  const mapping = detectMapping(HEADERS);
  const result = analyzeImport({
    headers: HEADERS,
    rows: [['Ana', '21999999999', 'a combinar', '']],
    mapping,
    existingLeads: [{ id: 'x', name: 'Ana', phone: '21999999999', status: 'Interessado', value: 900 }],
  });
  assert.equal(result.records[0].lead.value, 900);
  assert.equal(result.warnings.length, 1);
});

test('bug: ponto como separador de milhar sem centavos ("R$ 1.250", "1.500.000")', () => {
  // Antes: "R$ 1.250" virava 1,25 e "1.500.000" virava null (valor ignorado).
  assert.equal(parseMoney('R$ 1.250'), 1250);
  assert.equal(parseMoney('1.500.000'), 1500000);
  assert.equal(parseMoney('-1.250'), -1250);
  // Decimal com ponto continua decimal quando não tem grupos de 3 dígitos.
  assert.equal(parseMoney('99.90'), 99.9);
  assert.equal(parseMoney('1.5'), 1.5);
  assert.equal(parseMoney('1250.75'), 1250.75);
});
