const CONFIG_KEY = 'ea_ai_config';

const DEFAULT_CONFIG = {
  provider: 'gemini',
  apiKey: '',
  customEndpoint: ''
};

export function getAiConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    const config = {
      ...DEFAULT_CONFIG,
      ...parsed
    };
    if (config.customEndpoint && !/^https?:\/\//i.test(config.customEndpoint.trim())) {
      config.customEndpoint = `https://${config.customEndpoint.trim()}`;
    }
    return config;
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAiConfig({ provider, apiKey, customEndpoint } = {}) {
  const current = getAiConfig();
  let normalizedEndpoint = customEndpoint !== undefined ? customEndpoint.trim() : current.customEndpoint;
  if (normalizedEndpoint && !/^https?:\/\//i.test(normalizedEndpoint)) {
    normalizedEndpoint = `https://${normalizedEndpoint}`;
  }
  const updated = {
    provider: provider !== undefined ? provider : current.provider,
    apiKey: apiKey !== undefined ? apiKey : current.apiKey,
    customEndpoint: normalizedEndpoint
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

export function validateAiConfig(config) {
  const cfg = config || getAiConfig();
  const apiKey = (cfg.apiKey || '').trim();
  const customEndpoint = (cfg.customEndpoint || '').trim();
  const provider = cfg.provider || 'gemini';

  if (provider === 'opencode') {
    return Boolean(apiKey || customEndpoint);
  }
  return Boolean(apiKey);
}
