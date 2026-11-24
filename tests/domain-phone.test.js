import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPhone,
  currency,
  dateKeyOffset,
  isoOffset,
  localDateKey,
  validBrazilPhone,
  whatsappPhone,
} from '../src/domain.js';

test('canonicalPhone remove +55, espaços, traços, pontos e parênteses', () => {
  assert.equal(canonicalPhone('+55 (21) 99999-9999'), '21999999999');
  assert.equal(canonicalPhone('55 21 99999 9999'), '21999999999');
  assert.equal(canonicalPhone('  21.99999.9999 '), '21999999999');
  assert.equal(canonicalPhone('5521999999999'), '21999999999');
  assert.equal(canonicalPhone('+55 21 3222-1234'), '2132221234');
});

test('canonicalPhone não corta o DDD 55 (RS) de número sem DDI', () => {
  // 11 dígitos começando com 55 é DDD 55 + celular, não DDI.
  assert.equal(canonicalPhone('55 99999-1234'), '55999991234');
  assert.equal(canonicalPhone('5555999991234'), '55999991234');
  assert.equal(validBrazilPhone('55 99999-1234'), true);
});

test('canonicalPhone lida com vazio, null e números', () => {
  assert.equal(canonicalPhone(''), '');
  assert.equal(canonicalPhone(null), '');
  assert.equal(canonicalPhone(undefined), '');
  assert.equal(canonicalPhone('abc'), '');
  assert.equal(canonicalPhone(21999999999), '21999999999');
});

test('validBrazilPhone exige nono dígito em celular e 2-5 em fixo', () => {
  assert.equal(validBrazilPhone('21 99999-9999'), true);
  assert.equal(validBrazilPhone('21 3222-1234'), true);
  assert.equal(validBrazilPhone('11 2345-6789'), true);
  // celular antigo de 8 dígitos (sem o 9) não é aceito
  assert.equal(validBrazilPhone('(21) 9999-9999'), false);
  assert.equal(validBrazilPhone('+55 21 9999-9999'), false);
  // fixo começando com 1 ou 6 não existe
  assert.equal(validBrazilPhone('11 1234-5678'), false);
  assert.equal(validBrazilPhone('21 6222-1234'), false);
  // 11 dígitos sem 9 depois do DDD
  assert.equal(validBrazilPhone('21 89999-9999'), false);
});

test('validBrazilPhone rejeita DDD inexistente, tamanho errado e repetidos', () => {
  assert.equal(validBrazilPhone('20 99999-9999'), false); // DDD 20 não existe
  assert.equal(validBrazilPhone('10 99999-9999'), false);
  assert.equal(validBrazilPhone('99999-9999'), false); // sem DDD
  assert.equal(validBrazilPhone('5521322212345'), false); // dígito a mais
  assert.equal(validBrazilPhone('22222222222'), false);
  assert.equal(validBrazilPhone(''), false);
  assert.equal(validBrazilPhone(null), false);
});

// Possível bug (não corrigido, ver RELATORIO-NOITE.md): planilhas brasileiras
// às vezes trazem o prefixo de discagem 0 ("021 99999-9999", "0 21 ..."), que
// hoje é rejeitado como WhatsApp inválido. Não está claro se deve ser aceito,
// porque 0 + código de operadora (0 15 21 ...) também aparece.
test.todo('aceitar prefixo de discagem 0 antes do DDD (021 99999-9999)');

test('whatsappPhone devolve 55 + número só quando válido', () => {
  assert.equal(whatsappPhone('(21) 99999-9999'), '5521999999999');
  assert.equal(whatsappPhone('+55 21 3222-1234'), '552132221234');
  assert.equal(whatsappPhone('(21) 9999-9999'), '');
  assert.equal(whatsappPhone(''), '');
});

test('localDateKey usa o dia local, não o UTC', () => {
  // 23:30 no horário local continua sendo o mesmo dia, mesmo que em UTC já seja amanhã.
  const late = new Date(2030, 0, 15, 23, 30);
  assert.equal(localDateKey(late), '2030-01-15');
  const early = new Date(2030, 0, 15, 0, 5);
  assert.equal(localDateKey(early), '2030-01-15');
});

test('dateKeyOffset atravessa virada de mês e ano', () => {
  assert.equal(dateKeyOffset(1, new Date(2030, 0, 31, 23, 59)), '2030-02-01');
  assert.equal(dateKeyOffset(-1, new Date(2030, 0, 1, 0, 1)), '2029-12-31');
  assert.equal(dateKeyOffset(1, new Date(2028, 1, 28, 12)), '2028-02-29');
});

test('isoOffset fixa a hora local pedida', () => {
  const iso = isoOffset(2, 9, new Date(2030, 0, 15, 18));
  const date = new Date(iso);
  assert.equal(date.getDate(), 17);
  assert.equal(date.getHours(), 9);
  assert.equal(date.getMinutes(), 0);
});

test('currency formata em reais e trata vazio como zero', () => {
  const clean = value => currency(value).replace(/\s/g, ' ');
  assert.equal(clean(1250.9), 'R$ 1.250,90');
  assert.equal(clean(null), 'R$ 0,00');
  assert.equal(clean(''), 'R$ 0,00');
});
