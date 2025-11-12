// src/FinancialAnalysisModal.tsx
import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { tokenStore } from './lib/secureStore'
import uploadIcon from './assets/upload.png'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000'

type FinancialAnalysisModalProps = {
    open: boolean
    onClose: () => void
}

function getHeaders() {
    const { access } = tokenStore.getTokens()
    const h = new Headers()
    if (access) h.set('Authorization', `Bearer ${access}`)
    return h
}

export default function FinancialAnalysisModal({ open, onClose }: FinancialAnalysisModalProps) {
    const [bankFile, setBankFile] = useState<File | null>(null)
    const [cryptoFile, setCryptoFile] = useState<File | null>(null)
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<any>(null)
    const [processingStep, setProcessingStep] = useState<string>('')
    const bankFileRef = useRef<HTMLInputElement>(null)
    const cryptoFileRef = useRef<HTMLInputElement>(null)

    const handleBankFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setBankFile(file)
            setError(null)
        }
    }

    const handleCryptoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setCryptoFile(file)
            setError(null)
        }
    }

    const processStatements = async () => {
        if (!bankFile || !cryptoFile) {
            setError('Please upload both bank and crypto statements')
            return
        }

        setProcessing(true)
        setError(null)
        setResult(null)
        setProcessingStep('Processing bank statement...')

        try {
            // Process bank statement first
            const bankFormData = new FormData()
            bankFormData.append('file', bankFile)
            bankFormData.append('statementType', 'bank')

            const headers = getHeaders()
            let bankResponse = await fetch(`${API_BASE}/financial-analysis/process`, {
                method: 'POST',
                headers,
                body: bankFormData,
            })

            if (!bankResponse.ok) {
                const errorData = await bankResponse.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(`Bank statement error: ${errorData.error || `HTTP ${bankResponse.status}`}`)
            }

            const bankData = await bankResponse.json()
            if (!bankData.success) {
                throw new Error(bankData.error || 'Failed to process bank statement')
            }

            setProcessingStep('Processing crypto statement...')

            // Process crypto statement
            const cryptoFormData = new FormData()
            cryptoFormData.append('file', cryptoFile)
            cryptoFormData.append('statementType', 'crypto')

            let cryptoResponse = await fetch(`${API_BASE}/financial-analysis/process`, {
                method: 'POST',
                headers,
                body: cryptoFormData,
            })

            if (!cryptoResponse.ok) {
                const errorData = await cryptoResponse.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(`Crypto statement error: ${errorData.error || `HTTP ${cryptoResponse.status}`}`)
            }

            const cryptoData = await cryptoResponse.json()
            if (!cryptoData.success) {
                throw new Error(cryptoData.error || 'Failed to process crypto statement')
            }

            // Both processed successfully
            setResult({
                bank: bankData.data,
                crypto: cryptoData.data,
            })
            setProcessingStep('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while processing your statements')
            setProcessingStep('')
        } finally {
            setProcessing(false)
        }
    }

    const handleReset = () => {
        setProcessing(false)
        setError(null)
        setResult(null)
        setBankFile(null)
        setCryptoFile(null)
        setProcessingStep('')
        if (bankFileRef.current) bankFileRef.current.value = ''
        if (cryptoFileRef.current) cryptoFileRef.current.value = ''
    }

    if (!open) return null

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: 'var(--bg)',
                        borderRadius: '16px',
                        padding: '32px',
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '24px'
                    }}>
                        <h2 style={{
                            margin: 0,
                            fontSize: '24px',
                            fontWeight: 600,
                            color: 'var(--txt)'
                        }}>
                            Financial Statement Analysis
                        </h2>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--txt)',
                                fontSize: '24px',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {processing ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '16px',
                            padding: '40px 20px'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                border: '4px solid rgba(255, 255, 255, 0.1)',
                                borderTop: '4px solid var(--accent)',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <p style={{
                                color: 'var(--txt)',
                                fontSize: '16px',
                                textAlign: 'center',
                                margin: 0
                            }}>
                                {processingStep || 'Processing your statements...'}
                            </p>
                            <p style={{
                                color: 'var(--muted)',
                                fontSize: '14px',
                                textAlign: 'center',
                                margin: 0
                            }}>
                                This may take a few moments
                            </p>
                            <style>{`
                                @keyframes spin {
                                    0% { transform: rotate(0deg); }
                                    100% { transform: rotate(360deg); }
                                }
                            `}</style>
                        </div>
                    ) : result ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{
                                padding: '16px',
                                backgroundColor: 'rgba(0, 115, 55, 0.1)',
                                borderRadius: '8px',
                                border: '1px solid rgba(0, 115, 55, 0.3)'
                            }}>
                                <h3 style={{
                                    margin: '0 0 12px 0',
                                    fontSize: '18px',
                                    color: 'var(--accent)'
                                }}>
                                    Analysis Complete
                                </h3>
                                <p style={{
                                    margin: 0,
                                    color: 'var(--txt)',
                                    fontSize: '14px',
                                    lineHeight: '1.5'
                                }}>
                                    Both statements have been processed successfully. The detailed reports have been saved.
                                </p>
                            </div>
                            <button
                                onClick={handleReset}
                                className="btn"
                                style={{
                                    width: '100%',
                                    marginTop: '8px'
                                }}
                            >
                                Upload Another Statement
                            </button>
                        </div>
                    ) : error ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{
                                padding: '16px',
                                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                borderRadius: '8px',
                                border: '1px solid rgba(220, 38, 38, 0.3)'
                            }}>
                                <h3 style={{
                                    margin: '0 0 12px 0',
                                    fontSize: '18px',
                                    color: '#dc2626'
                                }}>
                                    Error
                                </h3>
                                <p style={{
                                    margin: 0,
                                    color: 'var(--txt)',
                                    fontSize: '14px',
                                    lineHeight: '1.5'
                                }}>
                                    {error}
                                </p>
                            </div>
                            <button
                                onClick={handleReset}
                                className="btn"
                                style={{
                                    width: '100%',
                                    marginTop: '8px'
                                }}
                            >
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '24px'
                        }}>
                            <p style={{
                                margin: 0,
                                color: 'var(--muted)',
                                fontSize: '14px',
                                textAlign: 'center'
                            }}>
                                Upload both your bank and crypto statements for analysis. We support PDF, DOCX, DOC, TXT, HTML, PNG, and JPEG formats.
                            </p>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: '16px'
                            }}>
                                {/* Bank Statement Upload */}
                                <label
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '32px 24px',
                                        border: '2px dashed rgba(255, 255, 255, 0.2)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                        gap: '16px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent)'
                                        e.currentTarget.style.backgroundColor = 'rgba(0, 115, 55, 0.05)'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                                    }}
                                >
                                    <input
                                        ref={bankFileRef}
                                        type="file"
                                        accept=".pdf,.docx,.doc,.txt,.html,.png,.jpg,.jpeg"
                                        onChange={handleBankFileSelect}
                                        style={{ display: 'none' }}
                                        disabled={processing}
                                    />
                                    <img
                                        src={uploadIcon}
                                        alt="Upload"
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            opacity: bankFile ? 1 : 0.8
                                        }}
                                    />
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span style={{
                                            color: 'var(--txt)',
                                            fontSize: '16px',
                                            fontWeight: 500
                                        }}>
                                            Bank Statement
                                        </span>
                                        {bankFile ? (
                                            <span style={{
                                                color: 'var(--accent)',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }}>
                                                ✓ {bankFile.name.length > 20 ? bankFile.name.substring(0, 20) + '...' : bankFile.name}
                                            </span>
                                        ) : (
                                            <span style={{
                                                color: 'var(--muted)',
                                                fontSize: '12px'
                                            }}>
                                                Click to upload
                                            </span>
                                        )}
                                    </div>
                                </label>

                                {/* Crypto Statement Upload */}
                                <label
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '32px 24px',
                                        border: '2px dashed rgba(255, 255, 255, 0.2)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                        gap: '16px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent)'
                                        e.currentTarget.style.backgroundColor = 'rgba(0, 115, 55, 0.05)'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                                    }}
                                >
                                    <input
                                        ref={cryptoFileRef}
                                        type="file"
                                        accept=".pdf,.docx,.doc,.txt,.html,.png,.jpg,.jpeg"
                                        onChange={handleCryptoFileSelect}
                                        style={{ display: 'none' }}
                                        disabled={processing}
                                    />
                                    <img
                                        src={uploadIcon}
                                        alt="Upload"
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            opacity: cryptoFile ? 1 : 0.8
                                        }}
                                    />
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span style={{
                                            color: 'var(--txt)',
                                            fontSize: '16px',
                                            fontWeight: 500
                                        }}>
                                            Crypto Statement
                                        </span>
                                        {cryptoFile ? (
                                            <span style={{
                                                color: 'var(--accent)',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }}>
                                                ✓ {cryptoFile.name.length > 20 ? cryptoFile.name.substring(0, 20) + '...' : cryptoFile.name}
                                            </span>
                                        ) : (
                                            <span style={{
                                                color: 'var(--muted)',
                                                fontSize: '12px'
                                            }}>
                                                Click to upload
                                            </span>
                                        )}
                                    </div>
                                </label>
                            </div>

                            {bankFile && cryptoFile && !processing && (
                                <button
                                    onClick={processStatements}
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        marginTop: '8px',
                                        padding: '16px',
                                        fontSize: '16px',
                                        fontWeight: 600
                                    }}
                                >
                                    Process Both Statements
                                </button>
                            )}

                            {(!bankFile || !cryptoFile) && (
                                <p style={{
                                    margin: '16px 0 0 0',
                                    color: 'var(--muted)',
                                    fontSize: '12px',
                                    textAlign: 'center'
                                }}>
                                    {!bankFile && !cryptoFile
                                        ? 'Please upload both statements to continue'
                                        : !bankFile
                                            ? 'Please upload bank statement'
                                            : 'Please upload crypto statement'}
                                </p>
                            )}
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    )
}

