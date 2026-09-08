// Global browser environment mocks for Node.js execution
globalThis.Worker = class Worker {
  constructor() {}
  postMessage() {}
  addEventListener() {}
};

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new LocalStorageMock();

import assert from 'node:assert';

const { getAiConfig, saveAiConfig, validateAiConfig } = await import('../js/ai/config.js');
const { completeJson } = await import('../js/ai/cloud-client.js');
const { generateBulkItems } = await import('../js/ai/generator.js');
const { processCommand } = await import('../js/ai/command-agent.js');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    throw err;
  }
}

console.log('Starting Cloud AI Integration Verification Suite...\n');

// ==========================================
// 1. config.js Tests
// ==========================================
console.log('--- 1. Testing config.js ---');

test('getAiConfig returns default fallback when empty or corrupted', () => {
  localStorage.clear();
  const defaultConfig = getAiConfig();
  assert.deepStrictEqual(defaultConfig, {
    provider: 'gemini',
    apiKey: '',
    customEndpoint: ''
  });

  localStorage.setItem('ea_ai_config', 'invalid json {{{');
  const fallbackConfig = getAiConfig();
  assert.deepStrictEqual(fallbackConfig, {
    provider: 'gemini',
    apiKey: '',
    customEndpoint: ''
  });
});

test('saveAiConfig saves and retrieves configuration correctly', () => {
  localStorage.clear();
  const saved = saveAiConfig({
    provider: 'openai',
    apiKey: 'sk-test-key',
    customEndpoint: 'https://custom.openai.com/v1'
  });

  assert.deepStrictEqual(saved, {
    provider: 'openai',
    apiKey: 'sk-test-key',
    customEndpoint: 'https://custom.openai.com/v1'
  });

  const retrieved = getAiConfig();
  assert.deepStrictEqual(retrieved, {
    provider: 'openai',
    apiKey: 'sk-test-key',
    customEndpoint: 'https://custom.openai.com/v1'
  });

  // Partial update
  const updated = saveAiConfig({ apiKey: 'sk-updated-key' });
  assert.strictEqual(updated.provider, 'openai');
  assert.strictEqual(updated.apiKey, 'sk-updated-key');
  assert.strictEqual(updated.customEndpoint, 'https://custom.openai.com/v1');
});

test('validateAiConfig validates configuration correctly across providers', () => {
  // Gemini
  assert.strictEqual(validateAiConfig({ provider: 'gemini', apiKey: '' }), false);
  assert.strictEqual(validateAiConfig({ provider: 'gemini', apiKey: '   ' }), false);
  assert.strictEqual(validateAiConfig({ provider: 'gemini', apiKey: 'key123' }), true);

  // OpenAI
  assert.strictEqual(validateAiConfig({ provider: 'openai', apiKey: '' }), false);
  assert.strictEqual(validateAiConfig({ provider: 'openai', apiKey: 'sk-123' }), true);

  // Anthropic
  assert.strictEqual(validateAiConfig({ provider: 'anthropic', apiKey: '' }), false);
  assert.strictEqual(validateAiConfig({ provider: 'anthropic', apiKey: 'ant-123' }), true);

  // OpenCode (allows apiKey OR customEndpoint)
  assert.strictEqual(validateAiConfig({ provider: 'opencode', apiKey: '', customEndpoint: '' }), false);
  assert.strictEqual(validateAiConfig({ provider: 'opencode', apiKey: 'key123', customEndpoint: '' }), true);
  assert.strictEqual(validateAiConfig({ provider: 'opencode', apiKey: '', customEndpoint: 'http://localhost:8080' }), true);
});

// ==========================================
// 2. cloud-client.js Tests
// ==========================================
console.log('\n--- 2. Testing cloud-client.js ---');

await asyncTest('completeJson throws error when credentials are missing', async () => {
  localStorage.clear();
  await assert.rejects(
    async () => {
      await completeJson({ prompt: 'test prompt' });
    },
    {
      name: 'Error',
      message: 'Please configure your AI API key in Workspace settings.'
    }
  );
});

await asyncTest('completeJson verifies payload structure & headers for gemini provider', async () => {
  let capturedUrl = '';
  let capturedOptions = {};

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"response": "gemini_ok"}' }] } }]
      })
    };
  };

  const config = { provider: 'gemini', apiKey: 'gemini-secret-key' };
  const res = await completeJson({
    prompt: 'user prompt text',
    systemInstruction: 'sys prompt text',
    config
  });

  assert.deepStrictEqual(res, { response: 'gemini_ok' });
  assert(capturedUrl.includes('generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'));
  assert(capturedUrl.includes('key=gemini-secret-key'));
  assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');

  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.contents[0].parts[0].text, 'sys prompt text\n\nuser prompt text');
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
});

await asyncTest('completeJson verifies payload structure & headers for openai provider', async () => {
  let capturedUrl = '';
  let capturedOptions = {};

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"response": "openai_ok"}' } }]
      })
    };
  };

  const config = { provider: 'openai', apiKey: 'openai-secret-key' };
  const res = await completeJson({
    prompt: 'openai user prompt',
    systemInstruction: 'openai sys instruction',
    config
  });

  assert.deepStrictEqual(res, { response: 'openai_ok' });
  assert.strictEqual(capturedUrl, 'https://api.openai.com/v1/chat/completions');
  assert.strictEqual(capturedOptions.headers['Authorization'], 'Bearer openai-secret-key');
  assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');

  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.model, 'gpt-4o-mini');
  assert.deepStrictEqual(body.messages, [
    { role: 'system', content: 'openai sys instruction' },
    { role: 'user', content: 'openai user prompt' }
  ]);
  assert.deepStrictEqual(body.response_format, { type: 'json_object' });
});

await asyncTest('completeJson verifies payload structure & headers for opencode provider', async () => {
  let capturedUrl = '';
  let capturedOptions = {};

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"response": "opencode_ok"}' } }]
      })
    };
  };

  const config = { provider: 'opencode', apiKey: 'opencode-secret-key', customEndpoint: 'http://localhost:11434/v1/chat/completions' };
  const res = await completeJson({
    prompt: 'opencode prompt',
    config
  });

  assert.deepStrictEqual(res, { response: 'opencode_ok' });
  assert.strictEqual(capturedUrl, 'http://localhost:11434/v1/chat/completions');
  assert.strictEqual(capturedOptions.headers['Authorization'], 'Bearer opencode-secret-key');

  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.model, 'default');
});

await asyncTest('completeJson verifies payload structure & headers for anthropic provider', async () => {
  let capturedUrl = '';
  let capturedOptions = {};

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      json: async () => ({
        content: [{ text: '{"response": "anthropic_ok"}' }]
      })
    };
  };

  const config = { provider: 'anthropic', apiKey: 'anthropic-secret-key' };
  const res = await completeJson({
    prompt: 'anthropic prompt',
    systemInstruction: 'anthropic sys',
    config
  });

  assert.deepStrictEqual(res, { response: 'anthropic_ok' });
  assert.strictEqual(capturedUrl, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(capturedOptions.headers['x-api-key'], 'anthropic-secret-key');
  assert.strictEqual(capturedOptions.headers['anthropic-version'], '2023-06-01');
  assert.strictEqual(capturedOptions.headers['anthropic-dangerous-direct-browser-access'], 'true');

  const body = JSON.parse(capturedOptions.body);
  assert.strictEqual(body.model, 'claude-3-5-sonnet-20241022');
  assert.strictEqual(body.system, 'anthropic sys');
  assert.deepStrictEqual(body.messages, [{ role: 'user', content: 'anthropic prompt' }]);
});

await asyncTest('completeJson correctly strips markdown code fences from response', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: '```json\n{\n  "cleaned": true\n}\n```' }] } }]
    })
  });

  const res = await completeJson({
    prompt: 'test prompt',
    config: { provider: 'gemini', apiKey: 'test-key' }
  });

  assert.deepStrictEqual(res, { cleaned: true });
});

await asyncTest('completeJson performs single retry on JSON parse error', async () => {
  let callCount = 0;
  const capturedPrompts = [];

  globalThis.fetch = async (url, options) => {
    callCount++;
    const body = JSON.parse(options.body);
    capturedPrompts.push(body.contents[0].parts[0].text);

    if (callCount === 1) {
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'NOT VALID JSON RESPONSE' }] } }]
        })
      };
    }

    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"retried": true}' }] } }]
      })
    };
  };

  const res = await completeJson({
    prompt: 'original prompt',
    config: { provider: 'gemini', apiKey: 'test-key' },
    maxRetries: 1
  });

  assert.strictEqual(callCount, 2);
  assert.deepStrictEqual(res, { retried: true });
  assert.strictEqual(capturedPrompts[0], 'original prompt');
  assert(capturedPrompts[1].includes('original prompt'));
  assert(capturedPrompts[1].includes('Your previous response was not valid JSON. Return ONLY valid JSON.'));
});

await asyncTest('completeJson throws if retry also fails to produce valid JSON', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'STILL INVALID JSON' }] } }]
    })
  });

  await assert.rejects(
    async () => {
      await completeJson({
        prompt: 'original prompt',
        config: { provider: 'gemini', apiKey: 'test-key' },
        maxRetries: 1
      });
    },
    SyntaxError
  );
});

// ==========================================
// 3. generator.js Tests
// ==========================================
console.log('\n--- 3. Testing generator.js ---');
saveAiConfig({ provider: 'gemini', apiKey: 'test-api-key' });

await asyncTest('generateBulkItems matches schema definitions for all supported types', async () => {
  const supportedTypes = ['tasks', 'commitments', 'contacts', 'notes', 'reminders', 'inbox_items'];
  const capturedSchemas = [];

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    const text = body.contents[0].parts[0].text;
    capturedSchemas.push(text);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ sample: 1 }] }) }] } }]
      })
    };
  };

  for (const type of supportedTypes) {
    const items = await generateBulkItems(type, 'Generate sample', 1);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].sample, 1);
  }

  assert.strictEqual(capturedSchemas.length, 6);
  assert(capturedSchemas[0].includes("priority ('low'|'medium'|'high')"));
  assert(capturedSchemas[1].includes("kind ('meeting'|'other')"));
  assert(capturedSchemas[2].includes('relationship_context'));
  assert(capturedSchemas[3].includes("kind ('general'|'preparation'|'follow_up')"));
  assert(capturedSchemas[4].includes('remind_at'));
  assert(capturedSchemas[5].includes('inbox_items'));
});

await asyncTest('generateBulkItems throws error for unsupported entity types', async () => {
  await assert.rejects(
    async () => {
      await generateBulkItems('unsupported_type', 'prompt', 5);
    },
    {
      name: 'Error',
      message: 'Unsupported entity type: unsupported_type'
    }
  );
});

await asyncTest('generateBulkItems parses candidate items successfully', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              items: [
                { title: 'Task 1', priority: 'high' },
                { title: 'Task 2', priority: 'medium' }
              ]
            })
          }]
        }
      }]
    })
  });

  const items = await generateBulkItems('tasks', 'Generate 2 tasks', 2);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, 'Task 1');
  assert.strictEqual(items[1].title, 'Task 2');
});

await asyncTest('generateBulkItems throws error when items array is missing in response', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ invalid_key: [] }) }] } }]
    })
  });

  await assert.rejects(
    async () => {
      await generateBulkItems('tasks', 'Generate tasks', 2);
    },
    {
      name: 'Error',
      message: 'Invalid response from AI: expected an object with an "items" array.'
    }
  );
});

// ==========================================
// 4. command-agent.js Tests
// ==========================================
console.log('\n--- 4. Testing command-agent.js ---');
saveAiConfig({ provider: 'gemini', apiKey: 'test-api-key' });

await asyncTest('processCommand injects date context into system instruction', async () => {
  let capturedSystemText = '';

  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    capturedSystemText = body.contents[0].parts[0].text;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                actions: [{ type: 'task', data: { title: 'Test Task' } }]
              })
            }]
          }
        }]
      })
    };
  };

  const actions = await processCommand('Schedule task tomorrow at 9am');
  assert.strictEqual(actions.length, 1);
  assert.strictEqual(actions[0].type, 'task');
  assert.strictEqual(actions[0].data.title, 'Test Task');

  assert(capturedSystemText.includes('The current local time is:'));
  assert(capturedSystemText.includes('Convert all relative dates and times'));
});

await asyncTest('processCommand throws error on empty command prompt', async () => {
  await assert.rejects(
    async () => {
      await processCommand('   ');
    },
    {
      name: 'Error',
      message: 'Command prompt cannot be empty.'
    }
  );
});

await asyncTest('processCommand parses actions array from AI response', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              actions: [
                { type: 'commitment', data: { title: 'Meeting', starts_at: '2026-09-10T10:00' } },
                { type: 'reminder', data: { title: 'Reminder', remind_at: '2026-09-10T09:00' } }
              ]
            })
          }]
        }
      }]
    })
  });

  const actions = await processCommand('Schedule meeting and reminder');
  assert.strictEqual(actions.length, 2);
  assert.strictEqual(actions[0].type, 'commitment');
  assert.strictEqual(actions[1].type, 'reminder');
});

await asyncTest('processCommand throws error when actions array is missing in response', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ result: 'ok' }) }] } }]
    })
  });

  await assert.rejects(
    async () => {
      await processCommand('Do something');
    },
    {
      name: 'Error',
      message: 'Invalid response from AI: expected an object with an "actions" array.'
    }
  );
});

console.log(`\n==========================================`);
console.log(`Verification Complete: ${passedTests}/${totalTests} tests passed cleanly.`);
console.log(`==========================================\n`);
