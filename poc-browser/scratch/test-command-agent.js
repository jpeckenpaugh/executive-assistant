global.Worker = class { constructor() {} postMessage() {} addEventListener() {} };
global.localStorage = {
  getItem: () => JSON.stringify({ provider: 'gemini', apiKey: 'test-key' }),
  setItem: () => {}
};

import assert from 'node:assert';

// Mock fetch for completeJson
global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  const promptText = body.contents[0].parts[0].text;
  assert(promptText.includes('current local time is'));
  assert(promptText.includes('Schedule meeting tomorrow 2pm'));

  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              actions: [
                {
                  type: 'commitment',
                  data: {
                    title: 'Meeting with Sarah',
                    kind: 'meeting',
                    starts_at: '2026-09-09T14:00',
                    duration_minutes: 60,
                    location: 'Conference Room A'
                  }
                },
                {
                  type: 'reminder',
                  data: {
                    title: 'Prep for meeting with Sarah',
                    remind_at: '2026-09-09T13:00'
                  }
                }
              ]
            })
          }]
        }
      }]
    })
  };
};

async function runTest() {
  const { processCommand } = await import('../js/ai/command-agent.js');
  console.log('Testing processCommand...');
  const actions = await processCommand('Schedule meeting tomorrow 2pm with Sarah and remind me 1 hour before');
  assert.strictEqual(actions.length, 2);
  assert.strictEqual(actions[0].type, 'commitment');
  assert.strictEqual(actions[0].data.title, 'Meeting with Sarah');
  assert.strictEqual(actions[0].data.starts_at, '2026-09-09T14:00');
  assert.strictEqual(actions[1].type, 'reminder');
  assert.strictEqual(actions[1].data.remind_at, '2026-09-09T13:00');
  console.log('SUCCESS: processCommand parsed command actions successfully!');
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
