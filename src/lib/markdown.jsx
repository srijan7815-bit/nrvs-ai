// Minimal, safe Markdown -> React renderer (no external deps, no raw HTML injection).
// Supports: headings, bold, italic, inline code, code blocks, blockquotes,
// unordered/ordered lists, links, and paragraphs.
import React from 'react'

function renderInline(text, keyPrefix = 'i') {
  const nodes = []
  let remaining = text
  let k = 0
  // Order matters: code first so ** inside code isn't parsed.
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)]+\))/
  while (remaining.length) {
    const m = remaining.match(pattern)
    if (!m) {
      nodes.push(remaining)
      break
    }
    if (m.index > 0) nodes.push(remaining.slice(0, m.index))
    const token = m[0]
    const key = `${keyPrefix}-${k++}`
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[0.85em] text-text-primary"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-text-primary">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      )
    } else if (token.startsWith('[')) {
      const lm = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      nodes.push(
        <a
          key={key}
          href={lm[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue underline-offset-2 hover:underline"
        >
          {lm[1]}
        </a>
      )
    }
    remaining = remaining.slice(m.index + token.length)
  }
  return nodes
}

export default function Markdown({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3)
      const buf = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-md border border-border bg-surface2 p-3 text-body-sm"
        >
          <code className="font-mono text-text-primary">{buf.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const cls =
        level === 1
          ? 'text-heading-lg font-semibold'
          : level === 2
          ? 'text-heading-md font-semibold'
          : 'text-body font-semibold'
      blocks.push(
        <p key={key++} className={`mt-3 mb-1 ${cls}`}>
          {renderInline(h[2], `h${key}`)}
        </p>
      )
      i++
      continue
    }

    // Blockquote
    if (line.trim().startsWith('>')) {
      const buf = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-2 border-l-2 border-border pl-3 text-text-secondary"
        >
          {renderInline(buf.join(' '), `bq${key}`)}
        </blockquote>
      )
      continue
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul${key}-${idx}`)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol${key}-${idx}`)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph (gather consecutive non-blank, non-special lines)
    const para = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !/^#{1,3}\s+/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        {renderInline(para.join(' '), `p${key}`)}
      </p>
    )
  }

  return <div className="text-body text-text-secondary">{blocks}</div>
}
