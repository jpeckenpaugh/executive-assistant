// Mock browser globals for node test
global.Worker = class { constructor() {} postMessage() {} addEventListener() {} };
global.localStorage = {
  getItem: () => JSON.stringify({ provider: 'gemini', apiKey: 'test-key' }),
  setItem: () => {}
};

import { generateBulkItems } from '../js/ai/generator.js';
import assert from 'node:assert';


// Mock fetch for completeJson
global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  assert(body.contents[0].parts[0].text.includes('tasks'));
  assert(body.contents[0].parts[0].text.includes('exactly 5'));

  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              items: [
                { title: 'Task 1', priority: 'high', due_at: '2026-09-10T10:00', recurrence: 'none' },
                { title: 'Task 2', priority: 'medium', due_at: '2026-09-11T14:00', recurrence: 'daily' },
                { title: 'Task 3', priority: 'low', due_at: '2026-09-12T09:00', recurrence: 'weekly' },
                { title: 'Task 4', priority: 'high', due_at: '2026-09-13T16:00', recurrence: 'none' },
                { title: 'Task 5', priority: 'medium', due_at: '2026-09-14T11:00', recurrence: 'monthly' }
              ]
            })
          }]
        }
      }]
    })
  };
};

async function runTest() {
  console.log('Testing generateBulkItems...');
  const items = await generateBulkItems('tasks', 'Generate 5 sample tasks', 5);
  assert.strictEqual(items.length, 5);
  assert.strictEqual(items[0].title, 'Task 1');
  console.log('SUCCESS: generateBulkItems returned valid items!');
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
