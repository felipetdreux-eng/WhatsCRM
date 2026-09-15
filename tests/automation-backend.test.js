import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUTOMATION_SETTINGS,
  automationKindLabel,
  automationStatusLabel,
} from '../src/automationBackend.js';

test('automation defaults keep the motor useful but conservative', () => {
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.enabled, true);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.first_contact_enabled, true);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.first_contact_delay_minutes, 5);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.followup_enabled, true);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.followup_delay_hours, 24);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.max_followup_attempts, 3);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.pause_on_response, true);
  assert.equal(DEFAULT_AUTOMATION_SETTINGS.pause_on_stage_change, true);
});

test('automation labels are readable in the control center', () => {
  assert.equal(automationKindLabel('first_contact'), 'Primeiro contato');
  assert.equal(automationKindLabel('followup'), 'Follow-up');
  assert.equal(automationStatusLabel('ready'), 'Pronta');
  assert.equal(automationStatusLabel('pending'), 'Agendada');
  assert.equal(automationStatusLabel('sent'), 'Enviada');
  assert.equal(automationStatusLabel('failed'), 'Falhou');
  assert.equal(automationStatusLabel('cancelled'), 'Cancelada');
});
