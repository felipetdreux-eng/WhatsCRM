import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Roda o cálculo num processo com TZ=America/Sao_Paulo para provar que
// "hoje" é o dia local do usuário, não o dia em UTC.
const root = fileURLToPath(new URL('..', import.meta.url));

function runInSaoPaulo(code) {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: root,
    env: { ...process.env, TZ: 'America/Sao_Paulo' },
    encoding: 'utf8',
  });
  return JSON.parse(output);
}

test('23:30 em São Paulo (02:30 UTC do dia seguinte) ainda é hoje', () => {
  const result = runInSaoPaulo(`
    import { localDateKey, dateKeyOffset } from './src/domain.js';
    import { temperatureDayDiff } from './src/leadTemperature.js';
    import { dayDiff } from './src/autopilotEngine.js';
    const now = new Date('2030-01-16T02:30:00Z');
    console.log(JSON.stringify({
      key: localDateKey(now),
      tomorrow: dateKeyOffset(1, now),
      temp: temperatureDayDiff('2030-01-15', now),
      auto: dayDiff('2030-01-15', now),
      autoYesterday: dayDiff('2030-01-14', now),
    }));
  `);
  assert.deepEqual(result, { key: '2030-01-15', tomorrow: '2030-01-16', temp: 0, auto: 0, autoYesterday: -1 });
});

test('fila do autopilot em São Paulo não marca como atrasado o follow-up de hoje à noite', () => {
  const result = runInSaoPaulo(`
    import { scoreAutopilotLead } from './src/autopilotEngine.js';
    const item = scoreAutopilotLead({
      id: '1', name: 'Ana', status: 'Contatado', value: 0, nextContact: '2030-01-15',
      updatedAt: '2030-01-15T20:00:00-03:00',
    }, new Date('2030-01-16T02:30:00Z'));
    console.log(JSON.stringify({ due: item.due, reason: item.primaryReason }));
  `);
  assert.equal(result.due, 0);
  assert.equal(result.reason, 'follow-up marcado para hoje');
});

test('importação: data como objeto Date usa o dia local', () => {
  const result = runInSaoPaulo(`
    import { normalizeDate } from './src/importUtils.js';
    console.log(JSON.stringify(normalizeDate(new Date('2030-01-16T02:30:00Z'))));
  `);
  assert.equal(result, '2030-01-15');
});
