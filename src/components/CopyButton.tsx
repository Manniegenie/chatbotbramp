// components/CopyButton.tsx
import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  type?: 'DEPOSIT_ADDRESS' | 'DEPOSIT_MEMO' | 'PAYMENT_ID' | 'ACCOUNT_NUMBER' | 'ACCOUNT_NAME' | 'BANK_CODE' | 'BANK_NAME'
  className?: string
}

export default function CopyButton({ text, type, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Gradient styles based on type
  const getGradientStyle = () => {
    const baseStyle: React.CSSProperties = {
      background: 'linear-gradient(135deg, #A80077, #66FF00)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      transition: 'all 0.2s ease',
      padding: '2px 4px',
      borderRadius: '4px'
    }

    return baseStyle
  }

  return (
    <span
      onClick={handleCopy}
      className={className}
      style={getGradientStyle()}
      title={`Click to copy ${text}`}
    >
      {text}
      {copied ? (
        <Check size={14} style={{ color: '#66FF00' }} />
      ) : (
        <Copy size={14} />
      )}
    </span>
  )
}

