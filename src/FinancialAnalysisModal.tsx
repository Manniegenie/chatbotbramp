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
    const [jobId, setJobId] = useState<string | null>(null)
    const [jobStatus, setJobStatus] = useState<any>(null)
    const bankFileRef = useRef<HTMLInputElement>(null)
    const cryptoFileRef = useRef<HTMLInputElement>(null)
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const handleBankFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setBankFile(file)
            setError(null)
            // Ensure processing doesn't start automatically
            if (processing) {
                e.preventDefault()
                return
            }
        }
    }

    const handleCryptoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setCryptoFile(file)
            setError(null)
            // Ensure processing doesn't start automatically
            if (processing) {
                e.preventDefault()
                return
            }
        }
    }

    // Poll for job status
    const pollJobStatus = async (id: string) => {
        try {
            const headers = getHeaders()
            const response = await fetch(`${API_BASE}/financial-analysis/job/${id}`, {
                method: 'GET',
                headers,
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch job status: ${response.status}`)
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch job status')
            }

            setJobStatus(data.data)

            // Update processing step
            const bankStatus = data.data.bankStatement?.status || 'pending'
            const cryptoStatus = data.data.cryptoStatement?.status || 'pending'

            if (bankStatus === 'processing' || cryptoStatus === 'processing') {
                setProcessingStep('Extracting data from statements...')
            } else if (bankStatus === 'completed' && cryptoStatus === 'completed') {
                setProcessingStep('Performing reconciliation analysis...')
            }

            // If job is complete, stop polling and show results
            if (data.data.status === 'completed') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
                setProcessing(false)
                setResult({
                    jobId: id,
                    report: data.data.report,
                    status: 'completed'
                })
            } else if (data.data.status === 'failed') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
                setProcessing(false)
                setError(data.data.error || 'Processing failed. Please try again.')
            }
        } catch (err) {
            console.error('Error polling job status:', err)
            // Don't stop polling on transient errors
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
        setJobStatus(null)
        setProcessingStep('Submitting statements for processing...')

        try {
            // Submit both files together for async processing
            const formData = new FormData()
            formData.append('bankFile', bankFile)
            formData.append('cryptoFile', cryptoFile)

            const headers = getHeaders()

            const response = await fetch(`${API_BASE}/financial-analysis/submit`, {
                method: 'POST',
                headers,
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || 'Failed to submit statements')
            }

            // Job submitted successfully - start polling
            const submittedJobId = data.jobId
            setJobId(submittedJobId)
            setProcessingStep('Processing statements... This may take a few minutes.')

            // Start polling every 3 seconds
            pollIntervalRef.current = setInterval(() => {
                pollJobStatus(submittedJobId)
            }, 3000)

            // Initial poll
            pollJobStatus(submittedJobId)
        } catch (err) {
            if (err instanceof Error) {
                if (err.name === 'AbortError') {
                    setError('Request timed out. The processing is taking longer than expected. Please try again.')
                } else if (err.message.includes('fetch')) {
                    setError('Network error: Unable to connect to the server. Please check your connection and try again.')
                } else {
                    setError(err.message)
                }
            } else {
                setError('An error occurred while processing your statements')
            }
            setProcessingStep('')
            setProcessing(false)
        }
    }

    const handleReset = () => {
        // Clear polling interval
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
        setProcessing(false)
        setError(null)
        setResult(null)
        setJobId(null)
        setJobStatus(null)
        setBankFile(null)
        setCryptoFile(null)
        setProcessingStep('')
        if (bankFileRef.current) bankFileRef.current.value = ''
        if (cryptoFileRef.current) cryptoFileRef.current.value = ''
    }

    // Cleanup on unmount or close
    React.useEffect(() => {
        if (!open && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
            }
        }
    }, [open])

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
                    backgroundColor: 'transparent', // Let page--overlay handle the tint
                    backdropFilter: 'none',
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
                    ) : result && result.status === 'completed' ? (
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
                                {result.report?.combined ? (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '8px',
                                        maxHeight: '400px',
                                        overflowY: 'auto'
                                    }}>
                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)' }}>
                                            Executive Summary
                                        </h4>
                                        {result.report.combined.executiveSummary && (
                                            <div style={{ marginBottom: '16px' }}>
                                                <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                    <strong>Status:</strong> {result.report.combined.executiveSummary.overallReconciliationStatus || 'N/A'}
                                                </p>
                                                <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                    <strong>Discrepancies:</strong> {result.report.combined.executiveSummary.totalDiscrepancies || 0}
                                                </p>
                                                {result.report.combined.executiveSummary.missingFundsAmount > 0 && (
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#dc2626' }}>
                                                        <strong>Missing Funds:</strong> {result.report.combined.executiveSummary.missingFundsAmount} {result.report.combined.executiveSummary.missingFundsCurrency || 'NGN'}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {result.report.combined.auditReport?.keyFindings && (
                                            <div style={{ marginTop: '16px' }}>
                                                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)' }}>
                                                    Key Findings
                                                </h4>
                                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)' }}>
                                                    {result.report.combined.auditReport.keyFindings.slice(0, 5).map((finding: string, idx: number) => (
                                                        <li key={idx} style={{ marginBottom: '4px' }}>{finding}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{
                                        margin: 0,
                                        color: 'var(--txt)',
                                        fontSize: '14px',
                                        lineHeight: '1.5'
                                    }}>
                                        Your financial analysis has been completed successfully. The detailed report has been saved.
                                    </p>
                                )}
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

