import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDemoLeads,
  canonicalPhone,
  dateKeyOffset,
  validBrazilPhone,
  whatsappPhone,
} from '../src/domain.js';

test('normaliza telefone brasileiro com DDI', () => {
  assert.equal(canonicalPhone('+55 (21) 99999-9999'), '21999999999');
  assert.equal(whatsappPhone('(21) 99999-9999'), '5521999999999');
});

test('rejeita telefone inválido e aceita celular com DDD válido', () => {
  assert.equal(validBrazilPhone('11111111111'), false);
  assert.equal(validBrazilPhone('00999999999'), false);
  assert.equal(validBrazilPhone('21999999999'), true);
});

test('datas demo acompanham a data atual em vez de ficar hardcoded', () => {
  const base = new Date('2030-01-15T12:00:00');
  const leads = buildDemoLeads(base);
  assert.equal(leads[0].nextContact, '2030-01-14');
  assert.equal(leads[1].nextContact, '2030-01-15');
  assert.equal(leads[4].nextContact, '2030-01-16');
  assert.equal(dateKeyOffset(3, base), '2030-01-18');
});

test('vendas demo sempre têm valor final positivo', () => {
  const sold = buildDemoLeads(new Date('2030-01-15T12:00:00')).filter(lead => lead.status === 'Fechado');
  assert.ok(sold.length > 0);
  assert.ok(sold.every(lead => Number(lead.saleValue) > 0));
});
