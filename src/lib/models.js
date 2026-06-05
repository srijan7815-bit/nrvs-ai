// Curated, verified-working NVIDIA models grouped by category for the model toggle.
// (Only chat / code / reasoning models are user-selectable, per product spec.)
// Vision/OCR + TTS/STT are handled separately and are NOT in this toggle.

export const MODEL_GROUPS = [
  {
    category: 'Chat',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', hint: 'Balanced default' },
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', hint: 'Reliable' },
      { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', hint: 'Fastest' },
      { id: 'meta/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick', hint: 'Newest Llama' },
      { id: 'moonshotai/kimi-k2.6', name: 'Kimi K2', hint: 'Long context' },
      { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2', hint: 'Versatile' },
    ],
  },
  {
    category: 'Reasoning',
    models: [
      { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', name: 'Nemotron Super 49B', hint: 'Step-by-step' },
      { id: 'nvidia/nemotron-3-super-120b-a12b', name: 'Nemotron 120B', hint: 'Deep reasoning' },
      { id: 'nvidia/nvidia-nemotron-nano-9b-v2', name: 'Nemotron Nano 9B', hint: 'Fast reasoning' },
      { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash', hint: 'Reason + code' },
    ],
  },
  {
    category: 'Code',
    models: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', hint: 'Strong at code' },
      { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash', hint: 'Code specialist' },
    ],
  },
]

// Flat lookup id -> {name, category}
export const MODEL_BY_ID = (() => {
  const map = {}
  for (const g of MODEL_GROUPS) {
    for (const m of g.models) {
      // first category wins for display label uniqueness, but keep name
      if (!map[m.id]) map[m.id] = { ...m, category: g.category }
    }
  }
  return map
})()

export const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'

// Reasoning models stream a separate `reasoning_content` field.
export function isReasoning(id) {
  return /nemotron|deepseek/i.test(id || '')
}

// Vision model used for image attachments / OCR (not user-selectable).
export const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct'

export function modelLabel(id) {
  return MODEL_BY_ID[id]?.name || id
}
