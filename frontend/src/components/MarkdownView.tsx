import React from 'react'
import { Link } from 'react-router-dom'

interface MarkdownViewProps {
  content: string
}

export function MarkdownView({ content }: MarkdownViewProps) {
  if (!content) return null

  // Strip trailing unformatted "(assumptions A1, A2...)" or "(based on the planning scenario...)"
  // because these are rendered cleanly in the AnswerMeta context widget below the message
  let cleaned = content.replace(/\n*\((?:based on the planning scenario[^)]*|assumptions\s+[A-Z0-9,\s]+)\)\s*$/gi, '').trim()

  // If the content is the legacy unformatted shortage response, transform it into structured markdown
  const formattedContent = normalizeLegacyShortageText(cleaned)

  // Split into block segments
  const lines = formattedContent.split('\n')
  const blocks: React.ReactNode[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Empty line
    if (!line.trim()) {
      i++
      continue
    }

    // Markdown Table: line starts and ends with '|'
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }
      blocks.push(renderTable(tableLines, blocks.length))
      continue
    }

    // Heading 3: ###
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={blocks.length} className="agent-h3">
          {renderInline(line.replace('### ', ''))}
        </h3>
      )
      i++
      continue
    }

    // Heading 4: ####
    if (line.startsWith('#### ')) {
      blocks.push(
        <h4 key={blocks.length} className="agent-h4">
          {renderInline(line.replace('#### ', ''))}
        </h4>
      )
      i++
      continue
    }

    // Blockquote: >
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote key={blocks.length} className="agent-quote">
          {quoteLines.map((ql, idx) => (
            <p key={idx} style={{ margin: idx ? '4px 0 0' : 0 }}>
              {renderInline(ql)}
            </p>
          ))}
        </blockquote>
      )
      continue
    }

    // Alert Callout banner: starts with 🚨 or ⚠️
    if (line.startsWith('🚨 ') || line.startsWith('⚠️ ')) {
      blocks.push(
        <div key={blocks.length} className="agent-alert-box">
          {renderInline(line)}
        </div>
      )
      i++
      continue
    }

    // Unordered List: line starts with '• ' or '- ' or '* '
    if (/^(\s*[-•*]\s)/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^(\s*[-•*]\s)/.test(lines[i])) {
        listItems.push(lines[i].replace(/^(\s*[-•*]\s)/, ''))
        i++
      }
      blocks.push(
        <ul key={blocks.length} className="agent-list">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Default Paragraph
    blocks.push(
      <p key={blocks.length} className="agent-p">
        {renderInline(line)}
      </p>
    )
    i++
  }

  return <div className="agent-markdown-body">{blocks}</div>
}

/** Helper: normalize legacy unformatted shortage response into clean structured markdown */
function normalizeLegacyShortageText(text: string): string {
  // If it already has markdown tables or headings, leave it
  if (text.includes('| :--- |') || text.includes('### ')) {
    return text
  }

  // Check if it matches the pattern: "X pairs go below safety stock within Y days ... First: MAT-..."
  const shortageMatch = text.match(/(\d+\s+pairs\s+go\s+below\s+safety\s+stock[^\.]+?\.)\s*First:\s*([^]+?)(?:\.\s*On\s+your\s+production\s+orders|\.\s*\(assumptions|\.\s*$|$)/i)
  if (shortageMatch) {
    const summaryHeader = shortageMatch[1]
    const itemsPart = shortageMatch[2]

    // Parse the individual items: e.g. "MAT-BOX-014 at IN-TN-01 — critical, below SS on 01-Nov-2026, stock-out 23-Nov-2026 (114 orders)"
    const rawItems = itemsPart.split(/;\s*/)
    const tableRows = rawItems.map((item) => {
      // Format: "MAT-XXX at PLANT — status, below SS on DATE, stock-out DATE (N orders)"
      const parts = item.split('—').map((s) => s.trim())
      const matPlant = parts[0] || ''
      const details = parts[1] || ''

      const statusMatch = details.match(/^(critical|at\s+risk|excess|healthy)/i)
      const status = statusMatch ? statusMatch[1] : 'Critical'

      const ssMatch = details.match(/below\s+SS\s+on\s+([^\s,]+)/i)
      const ssDate = ssMatch ? ssMatch[1] : '—'

      const soMatch = details.match(/stock-out\s+([^\s,\(]+)/i)
      const soDate = soMatch ? soMatch[1] : 'None'

      const orderMatch = details.match(/\((\d+)\s+orders?\)/i)
      const orders = orderMatch ? `${orderMatch[1]} orders` : '—'

      const badge = status.toLowerCase().includes('critical') ? '🔴 Critical' : '🟡 At Risk'
      const plantMatch = matPlant.match(/^([^\s]+)\s+at\s+([^\s]+)$/i)
      const displayMatPlant = plantMatch ? `**${plantMatch[1]}** @ ${plantMatch[2]}` : matPlant

      return `| ${displayMatPlant} | ${badge} | ${ssDate} | ${soDate} | ${orders} |`
    })

    // Extract production order demand context if present
    const demandMatch = text.match(/On your production orders,([^]+?)(?=\(assumptions|Cites:|$)/i)
    const demandContext = demandMatch ? demandMatch[1].trim() : ''

    const mdLines = [
      `### ⚠️ Material Shortage Forecast (Next 30 Days)`,
      `${summaryHeader.replace(/(\d+\s+of\s+them\s+reach\s+a\s+stock-out[^\.]*)/i, '🚨 **$1**')}`,
      '',
      '#### Most Urgent Materials at Risk:',
      '| Material & Plant | Status | Below Safety Stock | Projected Stock-Out | Impacted Orders |',
      '| :--- | :--- | :--- | :--- | :--- |',
      ...tableRows,
    ]

    if (demandContext) {
      mdLines.push('')
      mdLines.push(`> **Production Orders Impact:** On your production orders, ${demandContext}`)
    }

    return mdLines.join('\n')
  }

  return text
}

/** Render a markdown table */
function renderTable(lines: string[], key: number) {
  if (lines.length < 2) return null

  const parseRow = (line: string) => {
    return line
      .replace(/^\|\s*/, '')
      .replace(/\s*\|$/, '')
      .split('|')
      .map((c) => c.trim())
  }

  const headers = parseRow(lines[0])
  // lines[1] is separator | :--- | :--- |
  const rows = lines.slice(2).map(parseRow)

  return (
    <div key={key} className="agent-table-wrapper">
      <table className="agent-table">
        <thead>
          <tr>
            {headers.map((h, idx) => (
              <th key={idx}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, rIdx) => (
            <tr key={rIdx}>
              {r.map((cell, cIdx) => (
                <td key={cIdx}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Parse inline Markdown: bold (**), code (`), status badges, links ([text](url)) */
function renderInline(text: string): React.ReactNode {
  // Regex to match markdown links, bold text, inline code, and status badges
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|🔴\s*Critical|🟡\s*At\s*Risk|🟢\s*Healthy|🛒\s*Purchase|🔄\s*Transfer)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index))
    }

    const token = match[0]

    // Markdown Link: [label](url)
    if (match[2] && match[3]) {
      const label = match[2]
      const url = match[3]
      if (url.startsWith('http://') || url.startsWith('https://')) {
        // Parse internal links like http://localhost:5173/material/...
        const localPath = url.replace(/^https?:\/\/[^\/]+/, '')
        if (localPath.startsWith('/')) {
          nodes.push(
            <Link key={nodes.length} to={localPath} className="agent-link-pill">
              🔗 {label}
            </Link>
          )
        } else {
          nodes.push(
            <a key={nodes.length} href={url} target="_blank" rel="noreferrer" className="agent-link-pill">
              🔗 {label}
            </a>
          )
        }
      } else {
        nodes.push(
          <Link key={nodes.length} to={url} className="agent-link-pill">
            🔗 {label}
          </Link>
        )
      }
    }
    // Bold: **text**
    else if (match[4]) {
      nodes.push(<strong key={nodes.length}>{match[4]}</strong>)
    }
    // Code: `text`
    else if (match[5]) {
      nodes.push(
        <code key={nodes.length} className="agent-code-chip">
          {match[5]}
        </code>
      )
    }
    // Badges
    else if (token.includes('Critical')) {
      nodes.push(
        <span key={nodes.length} className="status-badge critical">
          🔴 Critical
        </span>
      )
    } else if (token.includes('At Risk')) {
      nodes.push(
        <span key={nodes.length} className="status-badge at-risk">
          🟡 At Risk
        </span>
      )
    } else if (token.includes('Healthy')) {
      nodes.push(
        <span key={nodes.length} className="status-badge healthy">
          🟢 Healthy
        </span>
      )
    } else if (token.includes('Purchase')) {
      nodes.push(
        <span key={nodes.length} className="status-badge purchase">
          🛒 Purchase
        </span>
      )
    } else if (token.includes('Transfer')) {
      nodes.push(
        <span key={nodes.length} className="status-badge transfer">
          🔄 Transfer
        </span>
      )
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex))
  }

  return nodes.length > 0 ? nodes : text
}
