import test from 'node:test';
import assert from 'node:assert/strict';
import { createPendingLeadWrites } from '../src/pendingLeadWrites.js';

test('consome apenas eventos produzidos pelas gravações desta aba', () => {
  const pending = createPendingLeadWrites();
  pending.mark(['lead-1'], 1000);

  assert.equal(pending.consume('lead-1', 1001), true);
  assert.equal(pending.consume('lead-1', 1002), false);
  assert.equal(pending.consume('lead-de-outra-aba', 1002), false);
});

test('mantém a contagem quando o mesmo lead é salvo mais de uma vez', () => {
  const pending = createPendingLeadWrites();
  pending.mark(['lead-1'], 1000);
  pending.mark(['lead-1'], 1001);

  assert.equal(pending.consume('lead-1', 1002), true);
  assert.equal(pending.consume('lead-1', 1003), true);
  assert.equal(pending.consume('lead-1', 1004), false);
});

test('não bloqueia atualizações remotas depois que a gravação local expira', () => {
  const pending = createPendingLeadWrites(100);
  pending.mark(['lead-1'], 1000);

  assert.equal(pending.consume('lead-1', 1101), false);
});

test('release desfaz a marcação quando a gravação falha', () => {
  const pending = createPendingLeadWrites();
  pending.mark(['lead-1', 'lead-2'], 1000);
  pending.release(['lead-1'], 1001);
  assert.equal(pending.consume('lead-1', 1002), false);
  assert.equal(pending.consume('lead-2', 1002), true);
});

test('aceita id único, ignora vazios e duplicados na mesma chamada', () => {
  const pending = createPendingLeadWrites();
  pending.mark('lead-1', 1000);
  pending.mark(['', null, undefined], 1000);
  pending.mark(['lead-2', 'lead-2'], 1000);
  assert.equal(pending.consume('lead-1', 1001), true);
  assert.equal(pending.consume('lead-2', 1001), true);
  assert.equal(pending.consume('lead-2', 1001), false, 'duplicado na mesma chamada conta uma vez só');
  assert.equal(pending.consume('', 1001), false);
  assert.equal(pending.consume(null, 1001), false);
});

test('nova marcação renova o prazo de expiração', () => {
  const pending = createPendingLeadWrites(100);
  pending.mark(['lead-1'], 1000);
  pending.mark(['lead-1'], 1090);
  assert.equal(pending.consume('lead-1', 1150), true);
});
