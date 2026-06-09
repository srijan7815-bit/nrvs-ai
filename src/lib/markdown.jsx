// Minimal, safe Markdown -> React renderer (no external deps, no raw HTML injection).
// Supports: headings, bold, italic, inline code, code blocks, blockquotes,
// unordered/ordered lists, tables, links, and paragraphs.
import React from 'react'
import CodeBlock from '../components/CodeBlock'

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

  // ── Table extraction ──────────────────────────────────────────────
  // Pull out pipe tables so we can process them separately.
  const parts = []
  const tableRegex = /(\|[^\n]+\|\n\|[-:| ]+\|\n(?:\|[^\n]*\|\n?)+)/g
  let lastIndex = 0
  let match
  while ((match = tableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'table', content: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  if (parts.length === 0) parts.push({ type: 'text', content: text })

  // ── Render plain text parts ───────────────────────────────────────
  function renderText(content) {
    const lines = content.split('\n')
    const blocks = []
    let i = 0
    let key = 0

    while (i < lines.length) {
      const line = lines[i]

      // Code block (with optional language:filename info string)
      if (line.trim().startsWith('```')) {
        const info = line.trim().slice(3).trim()
        let language = info
        let filename = null
        if (info.includes(':')) {
          const [l, f] = info.split(':')
          language = l.trim()
          filename = f.trim()
        }
        const buf = []
        i++
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          buf.push(lines[i])
          i++
        }
        i++ // skip closing fence
        blocks.push(
          <CodeBlock
            key={key++}
            language={language || 'text'}
            filename={filename}
            code={buf.join('\n')}
          />
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

    return blocks
  }

  // ── Render a table ────────────────────────────────────────────────
  function renderTable(tableText) {
    const rows = tableText.trim().split('\n').filter((r) => r.trim())
    if (rows.length < 2) return null

    // Parse header row
    const headerCells = rows[0].split('|').filter((c, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim())

    // Skip separator row (second row with dashes/colons)
    const dataStart = rows[1].match(/^\|[-:\s|]+\|$/) ? 2 : 1

    // Parse data rows
    const dataRows = rows.slice(dataStart).map((row) =>
      row.split('|').filter((c, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim())
    )

    // Alignment from separator row
    const alignRow = rows[1].match(/^\|[-:\s|]+\|$/) ? rows[1] : ''
    const alignments = headerCells.map((_, colIdx) => {
      const segments = alignRow.split('|').filter(Boolean)
      // segments[0] is before first |, skip; segments[1..N] are between |s
      const seg = segments[colIdx + 1]
      if (!seg) return 'left'
      if (seg.trim().startsWith(':') && seg.trim().endsWith(':')) return 'center'
      if (seg.trim().endsWith(':')) return 'right'
      return 'left'
    })

    return (
      <div key={Math.random()} className="my-3 overflow-x-auto">
        <table className="min-w-full divide-y divide-border rounded-lg border border-border text-body-sm">
          <thead>
            <tr className="bg-surface2">
              {headerCells.map((cell, ci) => (
                <th
                  key={ci}
                  className={`px-4 py-2 text-left font-semibold text-text-primary ${
                    alignments[ci] === 'center' ? 'text-center' : alignments[ci] === 'right' ? 'text-right' : ''
                  }`}
                >
                  {renderInline(cell, `th-${ci}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {dataRows.map((row, ri) => (
              <tr key={ri} className="transition-colors hover:bg-border/30">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-2 text-text-secondary ${
                      alignments[ci] === 'center' ? 'text-center' : alignments[ci] === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {cell === '' ? (
                      <span className="text-text-tertiary italic">—</span>
                    ) : (
                      renderInline(cell, `td-${ri}-${ci}`)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="text-body text-text-secondary">
      {parts.map((part, idx) => {
        if (part.type === 'table') return renderTable(part.content)
        return <React.Fragment key={idx}>{renderText(part.content)}</React.Fragment>
      })}
    </div>
  )
}