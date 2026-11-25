import test from 'node:test';
import assert from 'node:assert/strict';
import {
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

test('datas com deslocamento em dias', () => {
  const base = new Date('2030-01-15T12:00:00');
  assert.equal(dateKeyOffset(3, base), '2030-01-18');
});
