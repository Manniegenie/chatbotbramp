// utils/messageRenderer.tsx
// Shared message rendering utilities with COPYABLE marker support
import React from 'react'
import CopyButton from '../components/CopyButton'

const URL_REGEX = /https?:\/\/[^\s<>"')]+/gi
const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const COPYABLE_REGEX = /\{\{COPYABLE:([^:]+):([A-Z_]+)\}\}/g

export function shortenUrlForDisplay(raw: string): string {
  try {
    const u = new URL(raw)
    const host = u.host.replace(/^www\./, '')
    let path = u.pathname || ''
    if (path.length > 20) {
      const segs = path.split('/').filter(Boolean)
      if (segs.length > 2) path = `/${segs[0]}/…/${segs[segs.length - 1]}`
    }
    let label = host + (path === '/' ? '' : path)
    if (u.search || u.hash) label += '…'
    return label.length > 48 ? label.slice(0, 45) + '…' : raw
  } catch {
    return raw.length > 48 ? raw.slice(0, 45) + '…' : raw
  }
}

function processTextSegment(text: string, keyPrefix: string, baseOffset: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0

  // Handle all bold patterns: **bold**, ##bold##, # #bold# #
  text.replace(/(\*\*.*?\*\*|##.*?##|# #.*?# #)/g, (match, offset: number) => {
    if (offset > last) nodes.push(text.slice(last, offset))

    let content = match
    if (match.startsWith('**') && match.endsWith('**')) {
      content = match.slice(2, -2)
    } else if (match.startsWith('##') && match.endsWith('##')) {
      content = match.slice(2, -2)
    } else if (match.startsWith('# #') && match.endsWith('# #')) {
      content = match.slice(3, -3)
    }

    nodes.push(
      <strong key={`${keyPrefix}-bold-${baseOffset + offset}`}>
        {content}
      </strong>
    )
    last = offset + match.length
    return match
  })

  if (last < text.length) {
    const remainingText = text.slice(last)
    let linkLast = 0
    remainingText.replace(MD_LINK, (match, label: string, url: string, offset: number) => {
      if (offset > linkLast) nodes.push(remainingText.slice(linkLast, offset))
      nodes.push(
        <a key={`${keyPrefix}-md-${baseOffset + last + offset}`} href={url} target="_blank" rel="noopener noreferrer">
          {shortenUrlForDisplay(url)}
        </a>
      )
      linkLast = offset + match.length
      return match
    })
    if (linkLast < remainingText.length) nodes.push(remainingText.slice(linkLast))
  }

  const finalNodes: React.ReactNode[] = []
  nodes.forEach((node, i) => {
    if (typeof node !== 'string') { finalNodes.push(node); return }
    let idx = 0
    node.replace(URL_REGEX, (url: string, offset: number) => {
      const trimmed = url.replace(/[),.;!?]+$/g, '')
      const trailing = url.slice(trimmed.length)
      if (offset > idx) finalNodes.push(node.slice(idx, offset))
      finalNodes.push(
        <a key={`${keyPrefix}-url-${baseOffset}-${i}-${offset}`} href={trimmed} target="_blank" rel="noopener noreferrer">
          {shortenUrlForDisplay(trimmed)}
        </a>
      )
      if (trailing) finalNodes.push(trailing)
      idx = offset + url.length
      return url
    })
    if (idx < node.length) finalNodes.push(node.slice(idx))
  })

  return finalNodes
}

export function inlineRender(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0

  // Handle COPYABLE markers first (from normalization service)
  text.replace(COPYABLE_REGEX, (match, copyText: string, type: string, offset: number) => {
    if (offset > last) {
      const beforeText = text.slice(last, offset)
      if (beforeText) {
        nodes.push(...processTextSegment(beforeText, keyPrefix, offset))
      }
    }
    nodes.push(
      <CopyButton
        key={`${keyPrefix}-copyable-${offset}`}
        text={copyText}
        type={type as any}
      />
    )
    last = offset + match.length
    return match
  })

  if (last < text.length) {
    const remainingText = text.slice(last)
    nodes.push(...processTextSegment(remainingText, keyPrefix, last))
  }

  return nodes
}

export function renderMessageText(text: string): React.ReactNode {
  const paragraphs = text.split(/\r?\n\s*\r?\n/)
  const rendered: React.ReactNode[] = []

  paragraphs.forEach((para, pi) => {
    const lines = para.split(/\r?\n/)
    const isListBlock = lines.length > 1 && lines.every((l) => l.trim().startsWith('- '))
    if (isListBlock) {
      rendered.push(
        <ul key={`ul-${pi}`} style={{ margin: '8px 0', paddingLeft: 18 }}>
          {lines.map((l, li) => {
            const item = l.replace(/^\s*-\s*/, '')
            return (
              <li key={`li-${pi}-${li}`} style={{ margin: '4px 0' }}>
                {inlineRender(item, `li-${pi}-${li}`)}
              </li>
            )
          })}
        </ul>
      )
    } else {
      const pieces = para.split(/\r?\n/)
      rendered.push(
        <p key={`p-${pi}`} style={{ margin: '8px 0' }}>
          {pieces.map((line, li) => (
            <React.Fragment key={`p-${pi}-line-${li}`}>
              {inlineRender(line, `p-${pi}-line-${li}`)}
              {li < pieces.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      )
    }
  })

  return rendered
}

