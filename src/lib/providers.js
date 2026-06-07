// Known BYOK providers NRVS can use. Keys are stored in the user's encrypted
// secrets vault (per-account, RLS) and read back by name.
import { getSecrets } from './secrets'

export const PROVIDERS = [
  {
    id: 'nvidia',
    name: 'NVIDIA API Key',
    secretName: 'NVIDIA_API_KEY',
    prefix: 'nvapi-',
    placeholder: 'nvapi-…',
    get: 'https://build.nvidia.com',
    getLabel: 'build.nvidia.com → your profile → API keys',
    expiry: 'NVIDIA keys do not expire by default.',
    purpose: 'Powers NRVS chat, reasoning & code models.',
  },
  {
    id: 'tavily',
    name: 'Tavily API Key',
    secretName: 'TAVILY_API_KEY',
    prefix: 'tvly-',
    placeholder: 'tvly-…',
    get: 'https://app.tavily.com',
    getLabel: 'app.tavily.com → API Keys',
    expiry: 'Tavily keys do not expire (usage-limited on free tier).',
    purpose: 'Powers web search.',
  },
  {
    id: 'e2b',
    name: 'E2B API Key',
    secretName: 'E2B_API_KEY',
    prefix: 'e2b_',
    placeholder: 'e2b_…',
    get: 'https://e2b.dev/dashboard',
    getLabel: 'e2b.dev/dashboard → API Keys',
    expiry: 'E2B keys do not expire.',
    purpose: 'Powers code execution & live app hosting.',
  },
  {
    id: 'googleai',
    name: 'Google AI (Gemini) Key',
    secretName: 'GOOGLE_AI_KEY',
    prefix: 'AIza',
    placeholder: 'AIza…',
    get: 'https://aistudio.google.com/app/apikey',
    getLabel: 'aistudio.google.com → Get API key',
    expiry: 'Google AI keys do not expire.',
    purpose: 'Powers the FUISHAN full-stack website generator.',
  },
]

export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id)
}

// Read a stored provider key from the user's secrets vault (by secretName).
export function getProviderKey(idOrName) {
  const p = providerById(idOrName)
  const target = p?.secretName || idOrName
  const found = getSecrets().find(
    (s) =>
      s.name === target ||
      s.name?.toLowerCase() === (p?.name || '').toLowerCase()
  )
  return found?.value || null
}

export function hasProviderKey(id) {
  return !!getProviderKey(id)
}
