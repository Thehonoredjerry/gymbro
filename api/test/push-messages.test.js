import test from 'node:test';
import assert from 'node:assert/strict';
import { dayReminderPush, restTimerPush, testPush } from '../push-messages.js';

test('localizes every server-generated notification in pt-BR', () => {
  assert.deepEqual(restTimerPush('pt-BR'), {
    title: 'Descanso terminado 💪',
    body: 'Hora da próxima série.',
    tag: 'rest-timer',
  });
  assert.deepEqual(testPush('pt-BR'), {
    title: 'GymBro',
    body: 'Notificação de teste ✅ É assim que os alertas aparecem.',
    tag: 'test',
  });
  assert.deepEqual(dayReminderPush('pt-BR', { name: 'Treino A', emoji: '💪' }), {
    title: '💪 Treino A hoje',
    body: 'Está no seu plano. Bora treinar 💪',
    tag: 'day-reminder',
  });
});

test('keeps the existing English copy as the fallback', () => {
  assert.deepEqual(restTimerPush('fr'), restTimerPush('en'));
  assert.equal(dayReminderPush('unknown', null).title, 'Workout planned today');
  assert.equal(testPush(undefined).body, 'Test notification ✅ This is what alerts look like.');
});

test('every server-generated notification has its own Thai text', () => {
  const routine = { name: 'Leg Day', emoji: '🦵' };
  const pairs = [
    [restTimerPush('th'), restTimerPush('en')],
    [dayReminderPush('th', routine), dayReminderPush('en', routine)],
    [dayReminderPush('th', null), dayReminderPush('en', null)],
  ];
  for (const [th, en] of pairs) {
    for (const key of ['title', 'body']) {
      assert.ok(th[key], key + ' is set');
      assert.notEqual(th[key], en[key], `${key} is Thai, not the English fallback: ${th[key]}`);
    }
  }
  // The test notification keeps the brand as its title; its body is the translated part.
  assert.notEqual(testPush('th').body, testPush('en').body);
  assert.match(restTimerPush('th').title, /[฀-๿]/);
});
