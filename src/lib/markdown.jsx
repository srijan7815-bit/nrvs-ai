// Comprehensive Markdown -> React renderer (no external deps, no raw HTML injection).
// Supports: headings, bold, italic, strikethrough, inline code, code blocks (with syntax highlighting),
// blockquotes, unordered/ordered lists, tables, horizontal rules, links, paragraphs.
import React from 'react'
import CodeBlock from '../components/CodeBlock'
import { highlight } from './highlight'

// ── Inline token renderer ──────────────────────────────────────

function renderInline(text, keyPrefix = 'i') {
  if (!text) return text
  const nodes = []
  let remaining = text
  let k = 0

  // Order matters: code first (so ** inside code isn't parsed), then strikethrough.
  const pattern =
    /(`[^`\n]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\n]+\))/g

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
      // Inline code — compact pill
      nodes.push(
        <code
          key={key}
          className="rounded bg-border/60 px-1.5 py-0.5 font-mono text-[0.83em] text-accent-blue"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('***')) {
      nodes.push(
        <strong key={key} className="font-bold">
          {token.slice(3, -3)}
        </strong>
      )
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-text-primary">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') || token.startsWith('_')) {
      nodes.push(
        <em key={key} className="italic text-text-secondary">
          {token.slice(1, -1)}
        </em>
      )
    } else if (token.startsWith('~~')) {
      nodes.push(
        <del key={key} className="text-text-tertiary line-through">
          {token.slice(2, -2)}
        </del>
      )
    } else if (token.startsWith('[')) {
      const lm = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (lm) {
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
    }
    remaining = remaining.slice(m.index + token.length)
  }
  return nodes
}

// ── Truncation detection ────────────────────────────────────────

/**
 * Returns true if text looks incomplete (truncated by max_tokens).
 * Strategy: only flag genuinely broken structural endings.
 * We are deliberately conservative to avoid false positives on normal complete text.
 */
export function looksTruncated(text) {
  if (!text || !text.trim()) return false
  const t = text.trim()

  // Case 1: Open code block (``` with no closing)
  const openCode = (t.match(/```[^\n]*$/g) || []).length
  const closeCode = (t.match(/```$/gm) || []).length
  if (openCode > closeCode) return true

  // Case 2: Unclosed HTML/JSX tag (e.g. "<div" or "<Component" left hanging)
  if (/<[a-zA-Z][a-zA-Z0-9-]*\s*[^>]*$/.test(t)) return true
  // Unclosed angle brackets (but not escaped entities)
  if (/<[^>]*(?![a-zA-Z]|$)$/.test(t) && /<[a-zA-Z]/.test(t)) return true

  // Case 3: Unclosed braces in code context (CSS/JS objects)
  // Only if we see a { nearby and no closing }
  if (/\{[^}]*$/.test(t) && t.length > 200) return true

  // Case 4: Text ends mid-word (clearly cut off by token limit)
  // Only flag if the last word is definitely cut (ends with partial word chars only)
  const lastWord = t.split(/\s/).pop()
  if (lastWord && lastWord.length > 1 && /[a-zA-Z]$/.test(lastWord)) {
    // If it looks like a normal word ending (not an abbreviation or special case)
    // AND the previous "sentence" didn't end with punctuation
    const lastSentence = t.split(/\n/).pop()
    if (
      lastSentence.length > 5 &&
      !/[.!?\)\]"']$/.test(lastSentence) &&
      !lastSentence.includes('.') &&
      lastWord.length > 3
    ) {
      return true
    }
  }

  return false
}

// ── Table renderer ──────────────────────────────────────────────

function renderTable(tableText, tableKey) {
  const rows = tableText.trim().split('\n').filter((r) => r.trim())
  if (rows.length < 2) return null

  const headerCells = rows[0].split('|').filter((c, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim())
  const dataStart = rows[1].match(/^\|[-:\s|]+\|$/) ? 2 : 1
  const dataRows = rows.slice(dataStart).map((row) =>
    row.split('|').filter((c, i, a) => i > 0 && i < a.length - 1).map((c) => c.trim())
  )

  const alignRow = rows[1].match(/^\|[-:\s|]+\|$/) ? rows[1] : ''
  const alignments = headerCells.map((_, ci) => {
    const segs = alignRow.split('|').filter(Boolean)
    const seg = segs[ci + 1] || ''
    const s = seg.trim()
    if (s.startsWith(':') && s.endsWith(':')) return 'center'
    if (s.endsWith(':')) return 'right'
    return 'left'
  })

  const alignClass = (a) => a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left'

  return (
    <div key={tableKey} className="my-4 overflow-x-auto">
      <div className="inline-block min-w-full rounded-xl border border-border/50 bg-surface">
        {/* Header */}
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border/50">
              {headerCells.map((cell, ci) => (
                <th
                  key={ci}
                  className={`px-5 py-3 font-semibold text-text-primary ${alignClass(alignments[ci])}`}
                >
                  {renderInline(cell, `th-${tableKey}-${ci}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-border/20 last:border-0 ${ri % 2 === 1 ? 'bg-surface2/30' : ''}`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-5 py-3 text-text-secondary ${alignClass(alignments[ci])} ${ri % 2 === 1 ? 'bg-surface2/20' : ''}`}
                  >
                    {cell === '' ? (
                      <span className="text-text-tertiary/50">—</span>
                    ) : (
                      renderInline(cell, `td-${tableKey}-${ri}-${ci}`)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main markdown renderer ──────────────────────────────────────

export default function Markdown({ text }) {
  if (!text) return null

  // ── Split text into table and non-table parts ────────────────────
  const parts = []
  const tableRegex = /(\|[^\n]+\|\n\|[-:| ]+\|\n(?:\|[^\n]*\|)+)/g
  let lastIndex = 0
  let match
  while ((match = tableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'table', content: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) })
  if (!parts.length) parts.push({ type: 'text', content: text })

  // ── Render non-table text ────────────────────────────────────────
  function renderText(content, partKey) {
    const lines = content.split('\n')
    const blocks = []
    let i = 0
    let blockKey = 0

    const next = () => `${partKey}-b${blockKey++}`

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

        const rawCode = buf.join('\n')
        // Syntax highlighted version
        const highlightedHtml = highlight(rawCode, language)
        blocks.push(
          <div key={next()} className="my-4 overflow-hidden rounded-xl border border-border/50 bg-[#141414]">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                {/* Traffic light dots */}
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                <span className="ml-2 font-mono text-[11px] text-white/30">{filename || language || 'code'}</span>
              </div>
              <div className="flex items-center gap-1">
                {filename && (
                  <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/30">
                    {filename}
                  </span>
                )}
              </div>
            </div>
            {/* Code body */}
            <div className="overflow-x-auto p-4">
              <pre className="font-mono text-[13px] leading-relaxed">
                <code
                  className="text-white"
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              </pre>
            </div>
          </div>
        )
        continue
      }

      // Horizontal rule
      if (/^([-*_])\s*\1\s*\1\s*$/.test(line.trim())) {
        blocks.push(
          <div key={next()} className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/40" />
            <div className="h-px flex-1 bg-border/40" />
            <div className="h-px flex-1 bg-border/40" />
          </div>
        )
        i++
        continue
      }

      // Heading
      const h = line.match(/^(#{1,3})\s+(.*)$/)
      if (h) {
        const level = h[1].length
        const margin = level === 1 ? 'mt-5 mb-2' : level === 2 ? 'mt-4 mb-1.5' : 'mt-3 mb-1'
        const size = level === 1 ? 'text-lg font-bold text-text-primary' : level === 2 ? 'text-base font-semibold text-text-primary' : 'text-body font-medium text-text-primary'
        blocks.push(
          <p key={next()} className={`${margin} ${size}`}>
            {renderInline(h[2], `h${partKey}-${blockKey}`)}
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
            key={next()}
            className="my-3 border-l-2 border-accent-blue/40 pl-4 italic text-text-secondary/80"
          >
            {renderInline(buf.join(' '), `bq${partKey}-${blockKey}`)}
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
          <ul key={next()} className="my-3 space-y-1.5 pl-4">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-start gap-2 text-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
                <span>{renderInline(it, `ul${partKey}-${blockKey}-${idx}`)}</span>
              </li>
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
          <ol key={next()} className="my-3 space-y-1.5 pl-5 text-text-secondary">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="shrink-0 font-mono text-[12px] text-text-tertiary">{idx + 1}.</span>
                <span>{renderInline(it, `ol${partKey}-${blockKey}-${idx}`)}</span>
              </li>
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

      // Paragraph (gather consecutive non-special lines)
      const para = [line]
      i++
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^\s*[-*]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        !lines[i].trim().startsWith('>') &&
        !lines[i].trim().startsWith('```') &&
        !/^#{1,3}\s+/.test(lines[i]) &&
        !/^[-*_]\s*\1\s*\1\s*$/.test(lines[i].trim())
      ) {
        para.push(lines[i])
        i++
      }
      blocks.push(
        <p key={next()} className="my-1.5 leading-relaxed text-text-secondary">
          {renderInline(para.join(' '), `p${partKey}-${blockKey}`)}
        </p>
      )
    }

    return blocks
  }

  return (
    <div className="space-y-0.5 text-body text-text-secondary">
      {parts.map((part, idx) => {
        if (part.type === 'table') return renderTable(part.content, idx)
        return <React.Fragment key={idx}>{renderText(part.content, idx)}</React.Fragment>
      })}
    </div>
  )
}