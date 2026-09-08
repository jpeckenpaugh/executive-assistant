import { getAiConfig, validateAiConfig } from './config.js';

function cleanAndParseJson(text) {
  if (typeof text !== 'string') {
    throw new Error('Response text is empty or invalid.');
  }
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  return JSON.parse(cleaned);
}

function getUrl(customEndpoint, fallback) {
  if (!customEndpoint) return fallback;
  const trimmed = customEndpoint.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export async function completeJson({ prompt, systemInstruction, config, maxRetries = 1 }) {
  const aiConfig = config || getAiConfig();
  if (!validateAiConfig(aiConfig)) {
    throw new Error('Please configure your AI API key in Workspace settings.');
  }

  const provider = (aiConfig.provider || 'gemini').toLowerCase();
  let attempts = 0;
  let currentPrompt = prompt;

  while (attempts <= maxRetries) {
    let rawText = '';
    try {
      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${aiConfig.apiKey}`;
        const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${currentPrompt}` : currentPrompt;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Gemini API error (${res.status}): ${errText || res.statusText}`);
        }

        const data = await res.json();
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'openai') {
        const url = getUrl(aiConfig.customEndpoint, 'https://api.openai.com/v1/chat/completions');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + aiConfig.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemInstruction || 'You return valid JSON.' },
              { role: 'user', content: currentPrompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`OpenAI API error (${res.status}): ${errText || res.statusText}`);
        }

        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'opencode') {
        const url = getUrl(aiConfig.customEndpoint, 'https://api.openai.com/v1/chat/completions');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + aiConfig.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'default',
            messages: [
              { role: 'system', content: systemInstruction || 'You return valid JSON.' },
              { role: 'user', content: currentPrompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`OpenCode API error (${res.status}): ${errText || res.statusText}`);
        }

        const data = await res.json();
        rawText = data.choices?.[0]?.message?.content || '';
      } else if (provider === 'anthropic') {
        const url = getUrl(aiConfig.customEndpoint, 'https://api.anthropic.com/v1/messages');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'x-api-key': aiConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: systemInstruction || 'You return valid JSON.',
            messages: [
              { role: 'user', content: currentPrompt }
            ]
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Anthropic API error (${res.status}): ${errText || res.statusText}`);
        }

        const data = await res.json();
        rawText = data.content?.[0]?.text || '';
      } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
      }

      return cleanAndParseJson(rawText);
    } catch (err) {
      const isJsonParseError = err instanceof SyntaxError || err.message?.includes('JSON') || err.message?.includes('Response text is empty');
      if (isJsonParseError && attempts < maxRetries) {
        attempts++;
        currentPrompt = `${prompt}\n\nYour previous response was not valid JSON. Return ONLY valid JSON.`;
        continue;
      }
      throw err;
    }
  }
}
