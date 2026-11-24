import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/fakes.js';
import {
  ACCOUNTS_KEY,
  SESSION_KEY,
  activateAccountStorage,
  getActiveAccount,
  initializeAccountData,
  logoutAccount,
  readJSON,
  saveAccounts,
  scopedKey,
} from '../src/accountStorage.js';

let storage;
beforeEach(() => {
  storage = installLocalStorage();
  globalThis.window = {};
});

test('readJSON devolve fallback para chave ausente, JSON quebrado e null', () => {
  assert.deepEqual(readJSON('nada', []), []);
  storage.setItem('quebrado', '{oops');
  assert.equal(readJSON('quebrado', 'fb'), 'fb');
  storage.setItem('nulo', 'null');
  assert.equal(readJSON('nulo', 'fb'), 'fb');
  storage.setItem('ok', '{"a":1}');
  assert.deepEqual(readJSON('ok', null), { a: 1 });
});

test('getActiveAccount só devolve a conta da sessão atual', () => {
  assert.equal(getActiveAccount(), null);
  saveAccounts([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }]);
  assert.equal(getActiveAccount(), null);
  storage.setItem(SESSION_KEY, JSON.stringify({ accountId: 'b' }));
  assert.equal(getActiveAccount().name, 'Bia');
  storage.setItem(SESSION_KEY, JSON.stringify({ accountId: 'inexistente' }));
  assert.equal(getActiveAccount(), null);
  storage.setItem(ACCOUNTS_KEY, '{"nao":"array"}');
  storage.setItem(SESSION_KEY, JSON.stringify({ accountId: 'b' }));
  assert.equal(getActiveAccount(), null);
});

test('trocar de conta não vaza leads da conta anterior', () => {
  activateAccountStorage('a');
  storage.setItem('zapflow-leads', '[{"id":"lead-da-ana"}]');

  activateAccountStorage('b');
  assert.equal(storage.getItem('zapflow-leads'), null, 'conta B não pode ver leads da A');
  assert.equal(storage.getItem(scopedKey('zapflow-leads', 'a')), '[{"id":"lead-da-ana"}]');

  storage.setItem('zapflow-leads', '[{"id":"lead-da-bia"}]');
  activateAccountStorage('a');
  assert.equal(storage.getItem('zapflow-leads'), '[{"id":"lead-da-ana"}]');
  assert.equal(storage.getItem(scopedKey('zapflow-leads', 'b')), '[{"id":"lead-da-bia"}]');
});

test('reativar a mesma conta salva o estado atual no escopo dela', () => {
  activateAccountStorage('a');
  storage.setItem('zapflow-messages', '[1]');
  activateAccountStorage('a');
  assert.equal(storage.getItem(scopedKey('zapflow-messages', 'a')), '[1]');
});

test('dados antigos sem dono são assumidos pela primeira conta quando permitido', () => {
  storage.setItem('zapflow-leads', '[{"id":"legado"}]');
  activateAccountStorage('a');
  assert.equal(storage.getItem('zapflow-leads'), '[{"id":"legado"}]');
  assert.equal(storage.getItem(scopedKey('zapflow-leads', 'a')), '[{"id":"legado"}]');
});

test('com allowLegacy=false os dados antigos vão para backup e não aparecem na conta', () => {
  storage.setItem('zapflow-leads', '[{"id":"legado"}]');
  activateAccountStorage('a', { allowLegacy: false });
  assert.equal(storage.getItem('zapflow-leads'), null);
  assert.equal(storage.getItem('zapflow-legacy-backup:zapflow-leads'), '[{"id":"legado"}]');
});

test('activateAccountStorage e initializeAccountData ignoram conta vazia', () => {
  activateAccountStorage('');
  initializeAccountData(null, 'empty');
  assert.equal(storage.length, 0);
});

test('initializeAccountData: modo vazio grava [], outro modo limpa', () => {
  initializeAccountData('a', 'empty');
  assert.equal(storage.getItem(scopedKey('zapflow-leads', 'a')), '[]');
  initializeAccountData('a', 'demo');
  assert.equal(storage.getItem(scopedKey('zapflow-leads', 'a')), null);
});

test('logout limpa sessão, dados globais e token do Supabase, mas guarda os dados da conta', async () => {
  activateAccountStorage('a');
  storage.setItem('zapflow-leads', '[{"id":"x"}]');
  storage.setItem(SESSION_KEY, '{"accountId":"a"}');
  storage.setItem('sb-myllrhcgbrwfvtqxgkcb-auth-token', 'token');
  let signedOut = false;
  globalThis.window.__zapflowSupabaseSignOut = async () => { signedOut = true; };

  await logoutAccount('a');

  assert.equal(signedOut, true);
  assert.equal(storage.getItem('zapflow-leads'), null);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(storage.getItem('sb-myllrhcgbrwfvtqxgkcb-auth-token'), null);
  assert.equal(storage.getItem('zapflow-storage-owner'), null);
  assert.equal(storage.getItem(scopedKey('zapflow-leads', 'a')), '[{"id":"x"}]');
});

test('logout não quebra se o signOut remoto falhar', async () => {
  globalThis.window.__zapflowSupabaseSignOut = async () => { throw new Error('offline'); };
  const originalError = console.error;
  console.error = () => {};
  try {
    await logoutAccount('a');
  } finally {
    console.error = originalError;
  }
  assert.equal(storage.getItem(SESSION_KEY), null);
});
