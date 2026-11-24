import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDuplicateIndex, duplicateGroupCount } from '../src/duplicateLeads.js';

const reasonsOf = (index, id) => index.get(id)?.matches.map(match => match.reason) || [];

test('mesmo WhatsApp com e sem +55 e formatação é duplicata 100%', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'Ana', phone: '+55 (21) 99999-0000' },
    { id: 'b', name: 'Outra pessoa', phone: '21 99999 0000' },
  ]);
  assert.equal(index.get('a').highestConfidence, 100);
  assert.deepEqual(reasonsOf(index, 'b'), ['Mesmo WhatsApp']);
  assert.equal(duplicateGroupCount(index), 1);
});

test('mesmo nome com acento/caixa diferente e mesma empresa sem LTDA', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'João Silva', company: 'Padaria Pão Quente LTDA', phone: '21911112222' },
    { id: 'b', name: 'joao  silva', company: 'Padaria Pao Quente', phone: '21933334444' },
  ]);
  assert.equal(index.get('a').highestConfidence, 97);
  assert.deepEqual(reasonsOf(index, 'a'), ['Mesmo nome e mesma empresa']);
});

test('mesmo nome e WhatsApp com um dígito trocado (erro de digitação)', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'Ana', phone: '21999990000' },
    { id: 'b', name: 'ANA', phone: '21999990001' },
  ]);
  assert.equal(index.get('b').highestConfidence, 94);
});

test('nomes diferentes com um dígito trocado não são duplicata', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'Ana', phone: '21999990000' },
    { id: 'b', name: 'Bia', phone: '21999990001' },
  ]);
  assert.equal(index.size, 0);
});

test('telefone curto igual (lixo de planilha) não marca duplicata', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'Ana', phone: '12345' },
    { id: 'b', name: 'Bia', phone: '12345' },
    { id: 'c', name: 'Caio', phone: '' },
    { id: 'd', name: 'Duda', phone: '' },
  ]);
  assert.equal(index.size, 0);
});

test('nomes parecidos mas não iguais com empresas diferentes não casam', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'Mariana Souza', company: 'Estúdio M', phone: '21911112222' },
    { id: 'b', name: 'Mariana Sousa', company: 'Clínica Bela', phone: '21933334444' },
  ]);
  assert.equal(index.size, 0);
});

test('ignora entradas sem id, id repetido e lista inválida', () => {
  assert.equal(buildDuplicateIndex(null).size, 0);
  assert.equal(buildDuplicateIndex([{ id: 'a', name: 'Ana', phone: '21999990000' }, { id: 'a', name: 'Ana', phone: '21999990000' }, { name: 'Ana', phone: '21999990000' }]).size, 0);
  assert.equal(duplicateGroupCount(null), 0);
  assert.equal(duplicateGroupCount(new Map()), 0);
});

test('matches ficam ordenados por confiança e nome vazio vira "Lead sem nome"', () => {
  const index = buildDuplicateIndex([
    { id: 'b', name: 'N', company: 'Co', phone: '21999990000' },
    { id: 'c', name: 'N', company: 'Co', phone: '21911112222' },
    { id: 'a', name: '', phone: '21999990000' },
  ]);
  const matches = index.get('b').matches;
  assert.deepEqual(matches.map(match => match.confidence), [100, 97]);
  assert.equal(matches[0].name, 'Lead sem nome');
});

test('dois pares independentes contam como dois grupos', () => {
  const index = buildDuplicateIndex([
    { id: 'a', name: 'Ana', phone: '21999990000' },
    { id: 'b', name: 'Ana', phone: '21999990000' },
    { id: 'c', name: 'Caio', phone: '21988887777' },
    { id: 'd', name: 'Caio', phone: '21988887777' },
  ]);
  assert.equal(duplicateGroupCount(index), 2);
});

// Possível bug (não corrigido): A~B (mesmo WhatsApp) e B~C (mesmo nome e empresa)
// formam um único grupo de fato, mas duplicateGroupCount devolve 2 porque só olha
// os vizinhos diretos do primeiro item. Depende do que o Felipe chama de "grupo".
test.todo('cadeia A~B~C deveria contar como 1 grupo de duplicados');

// Possível bug (não corrigido): o mesmo celular salvo com e sem o nono dígito
// (21 9999-0000 x 21 99999-0000) não é detectado como duplicata.
test.todo('detectar duplicata entre celular com e sem nono dígito');
