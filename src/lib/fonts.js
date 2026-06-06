// App-wide font options, applied by setting --app-font on <html>.
export const FONT_OPTIONS = [
  { id: 'inter', name: 'Inter (Default)', stack: '"Inter", system-ui, sans-serif' },
  { id: 'system', name: 'System', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'serif', name: 'Serif (Playfair)', stack: '"Playfair Display", Georgia, serif' },
  { id: 'mono', name: 'Monospace', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  { id: 'georgia', name: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'verdana', name: 'Verdana (High legibility)', stack: 'Verdana, Geneva, sans-serif' },
]

export function fontStackFor(id) {
  return (FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0]).stack
}

export function applyFont(id) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--app-font', fontStackFor(id))
}
