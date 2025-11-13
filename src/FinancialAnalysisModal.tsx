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
    const [uploading, setUploading] = useState(false)
    const [extracting, setExtracting] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
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
            if (uploading || extracting || analyzing) {
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
            if (uploading || extracting || analyzing) {
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

            console.log(`[Poll ${id}] Received job status:`, {
                status: data.data.status,
                extractionStatus: data.data.extractionStatus,
                analysisStatus: data.data.analysisStatus,
                hasReport: !!data.data.report,
                reportKeys: data.data.report ? Object.keys(data.data.report) : []
            })

            setJobStatus(data.data)

            // Update processing step based on status
            const bankStatus = data.data.bankStatement?.status || 'pending'
            const cryptoStatus = data.data.cryptoStatement?.status || 'pending'
            const extractionStatus = data.data.extractionStatus || 'pending'
            const analysisStatus = data.data.analysisStatus || 'pending'

            // Update loading states
            if (extractionStatus === 'processing') {
                setExtracting(true)
                setAnalyzing(false)
                if (bankStatus === 'processing') {
                    setProcessingStep('Extracting bank statement...')
                } else if (cryptoStatus === 'processing') {
                    setProcessingStep('Extracting crypto statement...')
                } else {
                    setProcessingStep('Extracting data from statements...')
                }
            } else if (extractionStatus === 'completed' && analysisStatus === 'processing') {
                setExtracting(false)
                setAnalyzing(true)
                setProcessingStep('Analyzing with GPT...')
            } else if (extractionStatus === 'completed' && analysisStatus === 'completed') {
                // Both extraction and analysis are complete
                setExtracting(false)
                setAnalyzing(false)
                setProcessingStep('Analysis complete!')
            }

            // Check if job is complete (check both status and report availability)
            const isComplete = data.data.status === 'completed' && analysisStatus === 'completed' && data.data.report;

            if (isComplete) {
                console.log('✅ Job completed! Report received:', {
                    hasReport: !!data.data.report,
                    hasCombined: !!data.data.report?.combined,
                    reportKeys: data.data.report ? Object.keys(data.data.report) : []
                })

                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }

                // Clear all loading states
                setExtracting(false)
                setAnalyzing(false)
                setUploading(false)
                setProcessingStep('')

                // Set result - this should trigger the UI to show the report
                const reportData = {
                    jobId: id,
                    report: data.data.report,
                    status: 'completed' as const
                }
                console.log('Setting result:', {
                    hasReport: !!reportData.report,
                    hasCombined: !!reportData.report?.combined,
                    reportStructure: reportData.report ? JSON.stringify(Object.keys(reportData.report), null, 2) : 'null'
                })
                setResult(reportData)

                // Don't clear jobStatus - keep it for reference but result takes priority
            } else if (data.data.status === 'failed') {
                console.error('❌ Job failed:', data.data.error)
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
                setExtracting(false)
                setAnalyzing(false)
                setUploading(false)
                setProcessingStep('')
                setError(data.data.error || 'Processing failed. Please try again.')
            } else {
                // Debug: Log current status for ongoing jobs
                if (data.data.status !== 'completed' || !data.data.report) {
                    console.log('📊 Job in progress:', {
                        status: data.data.status,
                        extractionStatus,
                        analysisStatus,
                        hasReport: !!data.data.report,
                        jobId: id
                    })
                }
            }
        } catch (err) {
            console.error('Error polling job status:', err)
            // Don't stop polling on transient errors
        }
    }

    // Upload files
    const uploadFiles = async () => {
        if (!bankFile || !cryptoFile) {
            setError('Please upload both bank and crypto statements')
            return
        }

        setUploading(true)
        setError(null)
        setResult(null)
        setJobStatus(null)

        try {
            const formData = new FormData()
            formData.append('bankFile', bankFile)
            formData.append('cryptoFile', cryptoFile)

            const { access } = tokenStore.getTokens()
            const headers: Record<string, string> = {}
            if (access) {
                headers['Authorization'] = `Bearer ${access}`
            }

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
                throw new Error(data.error || 'Failed to upload statements')
            }

            setJobId(data.jobId)
            setUploading(false)
            setExtracting(true) // Start extraction automatically
            setProcessingStep('Extraction started automatically...')

            // Start polling for job status (every 5 seconds to avoid rate limits)
            pollIntervalRef.current = setInterval(() => {
                pollJobStatus(data.jobId)
            }, 5000)

            // Initial poll
            pollJobStatus(data.jobId)
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('An error occurred while uploading your statements')
            }
            setUploading(false)
        }
    }

    // Extract statements
    const extractStatements = async () => {
        if (!jobId) {
            setError('No job ID found. Please upload files first.')
            return
        }

        setExtracting(true)
        setError(null)
        setProcessingStep('Starting extraction...')

        try {
            const headers = getHeaders()
            headers.set('Content-Type', 'application/json')

            const response = await fetch(`${API_BASE}/financial-analysis/extract`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ jobId }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || 'Failed to start extraction')
            }

            // Start polling for extraction status (every 5 seconds to avoid rate limits)
            pollIntervalRef.current = setInterval(() => {
                pollJobStatus(jobId)
            }, 5000)

            // Initial poll
            pollJobStatus(jobId)
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('An error occurred while starting extraction')
            }
            setExtracting(false)
            setProcessingStep('')
        }
    }

    // Analyze statements
    const analyzeStatements = async () => {
        if (!jobId) {
            setError('No job ID found.')
            return
        }

        setAnalyzing(true)
        setError(null)
        setProcessingStep('Starting analysis...')

        try {
            const headers = getHeaders()
            headers.set('Content-Type', 'application/json')

            const response = await fetch(`${API_BASE}/financial-analysis/analyze`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ jobId }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
                throw new Error(errorData.error || `HTTP ${response.status}`)
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || 'Failed to start analysis')
            }

            // Continue polling for analysis status (every 5 seconds to avoid rate limits)
            if (!pollIntervalRef.current) {
                pollIntervalRef.current = setInterval(() => {
                    pollJobStatus(jobId)
                }, 5000)
            }

            // Initial poll
            pollJobStatus(jobId)
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('An error occurred while starting analysis')
            }
            setAnalyzing(false)
            setProcessingStep('')
        }
    }

    const handleReset = () => {
        // Clear polling interval
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
        setUploading(false)
        setExtracting(false)
        setAnalyzing(false)
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

    // Debug: Log current state
    React.useEffect(() => {
        if (result) {
            console.log('🎯 Result state:', {
                status: result.status,
                hasReport: !!result.report,
                hasCombined: !!result.report?.combined,
                reportKeys: result.report ? Object.keys(result.report) : []
            })
        }
        if (jobStatus) {
            console.log('📊 Job status:', {
                status: jobStatus.status,
                extractionStatus: jobStatus.extractionStatus,
                analysisStatus: jobStatus.analysisStatus,
                hasReport: !!jobStatus.report,
                hasCombined: !!jobStatus.report?.combined
            })

            // Auto-set result if job is complete and report exists, but result isn't set yet
            if (jobStatus.status === 'completed' && jobStatus.analysisStatus === 'completed' && jobStatus.report && !result) {
                console.log('🔄 Auto-setting result from jobStatus...')
                setResult({
                    jobId: jobId || jobStatus.jobId,
                    report: jobStatus.report,
                    status: 'completed'
                })
                setExtracting(false)
                setAnalyzing(false)
                setUploading(false)
                setProcessingStep('')

                // Stop polling
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
            }
        }
    }, [result, jobStatus, jobId])

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

                    {/* Show result FIRST if available - priority over loading states */}
                    {((result && result.status === 'completed' && result.report) || (jobStatus && jobStatus.status === 'completed' && jobStatus.analysisStatus === 'completed' && jobStatus.report)) ? (
                        (() => {
                            // Use result if available, otherwise use jobStatus
                            const displayReport = result?.report || jobStatus?.report;
                            const displayJobId = result?.jobId || jobStatus?.jobId || jobId;

                            console.log('🖼️ Rendering report:', {
                                hasResult: !!result,
                                hasJobStatus: !!jobStatus,
                                hasReport: !!displayReport,
                                hasCombined: !!displayReport?.combined,
                                reportType: displayReport ? typeof displayReport : 'null'
                            });

                            if (!displayReport) {
                                return (
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 193, 7, 0.3)'
                                    }}>
                                        <p style={{ margin: 0, color: '#ffc107', fontSize: '14px' }}>
                                            Report is being processed. Please wait...
                                        </p>
                                    </div>
                                );
                            }

                            if (!displayReport.combined) {
                                return (
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255, 193, 7, 0.3)'
                                    }}>
                                        <p style={{ margin: 0, color: '#ffc107', fontSize: '14px' }}>
                                            Report structure incomplete. Available keys: {displayReport ? Object.keys(displayReport).join(', ') : 'none'}
                                        </p>
                                        <pre style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)', overflow: 'auto', maxHeight: '400px' }}>
                                            {JSON.stringify(displayReport, null, 2)}
                                        </pre>
                                    </div>
                                );
                            }

                            return (
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
                                        {displayReport.combined ? (
                                            <div style={{
                                                marginTop: '16px',
                                                padding: '16px',
                                                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                                borderRadius: '8px',
                                                maxHeight: '600px',
                                                overflowY: 'auto'
                                            }}>
                                                {/* Executive Summary */}
                                                {displayReport.combined.executiveSummary && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                            Executive Summary
                                                        </h4>
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Status:</strong> {displayReport.combined.executiveSummary.overallReconciliationStatus || 'N/A'}
                                                            </p>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Discrepancies:</strong> {displayReport.combined.executiveSummary.totalDiscrepancies || 0}
                                                            </p>
                                                            {displayReport.combined.executiveSummary.missingFundsAmount > 0 && (
                                                                <p style={{ margin: '4px 0', fontSize: '14px', color: '#dc2626', fontWeight: 500 }}>
                                                                    <strong>Missing Funds:</strong> {displayReport.combined.executiveSummary.missingFundsAmount} {displayReport.combined.executiveSummary.missingFundsCurrency || 'NGN'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Reconciliation */}
                                                {displayReport.combined.reconciliation && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                            Reconciliation
                                                        </h4>
                                                        <div style={{
                                                            padding: '12px',
                                                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                            borderRadius: '6px',
                                                            fontSize: '14px',
                                                            color: 'var(--txt)'
                                                        }}>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Matched Transactions:</strong> {displayReport.combined.reconciliation.matchedTransactions || 0}
                                                            </p>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Reconciliation Rate:</strong> {displayReport.combined.reconciliation.reconciliationRate || 0}%
                                                            </p>
                                                            {displayReport.combined.reconciliation.discrepancies && displayReport.combined.reconciliation.discrepancies.length > 0 && (
                                                                <div style={{ marginTop: '12px' }}>
                                                                    <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                        Discrepancies ({displayReport.combined.reconciliation.discrepancies.length})
                                                                    </h5>
                                                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                        {displayReport.combined.reconciliation.discrepancies.slice(0, 5).map((disc: any, idx: number) => (
                                                                            <li key={idx} style={{ marginBottom: '6px' }}>
                                                                                <strong>{disc.type}:</strong> {disc.description} ({disc.amount} {disc.currency})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Missing Funds */}
                                                {displayReport.combined.missingFunds && displayReport.combined.missingFunds.totalMissing > 0 && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#dc2626', fontWeight: 600 }}>
                                                            Missing Funds
                                                        </h4>
                                                        <div style={{
                                                            padding: '12px',
                                                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                                            borderRadius: '6px',
                                                            fontSize: '14px',
                                                            color: '#dc2626'
                                                        }}>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: 500 }}>
                                                                <strong>Total Missing:</strong> {displayReport.combined.missingFunds.totalMissing} {displayReport.combined.missingFunds.currency || 'NGN'}
                                                            </p>
                                                            {displayReport.combined.missingFunds.recommendations && (
                                                                <div style={{ marginTop: '12px' }}>
                                                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                                                                        {Array.isArray(displayReport.combined.missingFunds.recommendations)
                                                                            ? displayReport.combined.missingFunds.recommendations.map((rec: string, idx: number) => (
                                                                                <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
                                                                            ))
                                                                            : <li>{String(displayReport.combined.missingFunds.recommendations)}</li>
                                                                        }
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Financial Analysis */}
                                                {displayReport.combined.financialAnalysis && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                            Financial Analysis
                                                        </h4>
                                                        <div style={{
                                                            padding: '12px',
                                                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                            borderRadius: '6px',
                                                            fontSize: '14px',
                                                            color: 'var(--txt)'
                                                        }}>
                                                            {displayReport.combined.financialAnalysis.profitLoss && (
                                                                <div style={{ marginBottom: '12px' }}>
                                                                    <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                        Profit/Loss
                                                                    </h5>
                                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                        <strong style={{ color: 'var(--txt)' }}>Net P/L:</strong> {displayReport.combined.financialAnalysis.profitLoss.netProfitLoss || 0} {displayReport.combined.financialAnalysis.profitLoss.currency || 'USD'}
                                                                    </p>
                                                                    {displayReport.combined.financialAnalysis.profitLoss.ngnEquivalent && (
                                                                        <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                            <strong style={{ color: 'var(--txt)' }}>NGN Equivalent:</strong> {displayReport.combined.financialAnalysis.profitLoss.ngnEquivalent} NGN
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Compliance */}
                                                {displayReport.combined.compliance && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                            Compliance
                                                        </h4>
                                                        <div style={{
                                                            padding: '12px',
                                                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                            borderRadius: '6px',
                                                            fontSize: '14px',
                                                            color: 'var(--txt)'
                                                        }}>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Status:</strong> {displayReport.combined.compliance.complianceStatus || 'N/A'}
                                                            </p>
                                                            {displayReport.combined.compliance.taxObligations && displayReport.combined.compliance.taxObligations.length > 0 && (
                                                                <div style={{ marginTop: '12px' }}>
                                                                    <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                        Tax Obligations
                                                                    </h5>
                                                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                        {displayReport.combined.compliance.taxObligations.map((obligation: string, idx: number) => (
                                                                            <li key={idx} style={{ marginBottom: '6px' }}>{obligation}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Risk Assessment */}
                                                {displayReport.combined.riskAssessment && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                            Risk Assessment
                                                        </h4>
                                                        <div style={{
                                                            padding: '12px',
                                                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                            borderRadius: '6px',
                                                            fontSize: '14px',
                                                            color: 'var(--txt)'
                                                        }}>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Overall Risk Level:</strong> {displayReport.combined.riskAssessment.overallRiskLevel || 'N/A'}
                                                            </p>
                                                            {displayReport.combined.riskAssessment.suspiciousTransactions && displayReport.combined.riskAssessment.suspiciousTransactions.length > 0 && (
                                                                <div style={{ marginTop: '12px' }}>
                                                                    <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#dc2626', fontWeight: 500 }}>
                                                                        Suspicious Transactions ({displayReport.combined.riskAssessment.suspiciousTransactions.length})
                                                                    </h5>
                                                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                        {displayReport.combined.riskAssessment.suspiciousTransactions.slice(0, 3).map((tx: any, idx: number) => (
                                                                            <li key={idx} style={{ marginBottom: '6px' }}>
                                                                                <strong>{tx.type}:</strong> {tx.description} ({tx.amount} - {tx.riskLevel})
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Audit Report */}
                                                {displayReport.combined.auditReport && (
                                                    <div style={{ marginBottom: '20px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                            Audit Report
                                                        </h4>
                                                        {displayReport.combined.auditReport.keyFindings && (
                                                            <div style={{ marginBottom: '12px' }}>
                                                                <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                    Key Findings
                                                                </h5>
                                                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                    {Array.isArray(displayReport.combined.auditReport.keyFindings)
                                                                        ? displayReport.combined.auditReport.keyFindings.map((finding: string, idx: number) => (
                                                                            <li key={idx} style={{ marginBottom: '6px' }}>{finding}</li>
                                                                        ))
                                                                        : <li>{String(displayReport.combined.auditReport.keyFindings)}</li>
                                                                    }
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {displayReport.combined.auditReport.recommendations && (
                                                            <div style={{ marginTop: '12px' }}>
                                                                <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                    Recommendations
                                                                </h5>
                                                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                    {Array.isArray(displayReport.combined.auditReport.recommendations)
                                                                        ? displayReport.combined.auditReport.recommendations.map((rec: string, idx: number) => (
                                                                            <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
                                                                        ))
                                                                        : <li>{String(displayReport.combined.auditReport.recommendations)}</li>
                                                                    }
                                                                </ul>
                                                            </div>
                                                        )}
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
                                                Your financial analysis has been completed successfully. Report data is being processed.
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
                            );
                        })()
                    ) : (uploading || extracting || analyzing) ? (
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
                    ) : error ? (
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
                                        maxHeight: '600px',
                                        overflowY: 'auto'
                                    }}>
                                        {/* Executive Summary */}
                                        {result.report.combined.executiveSummary && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Executive Summary
                                                </h4>
                                                <div style={{ marginBottom: '12px' }}>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                        <strong style={{ color: 'var(--txt)' }}>Status:</strong> {result.report.combined.executiveSummary.overallReconciliationStatus || 'N/A'}
                                                    </p>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                        <strong style={{ color: 'var(--txt)' }}>Discrepancies:</strong> {result.report.combined.executiveSummary.totalDiscrepancies || 0}
                                                    </p>
                                                    {result.report.combined.executiveSummary.missingFundsAmount > 0 && (
                                                        <p style={{ margin: '4px 0', fontSize: '14px', color: '#dc2626', fontWeight: 500 }}>
                                                            <strong>Missing Funds:</strong> {result.report.combined.executiveSummary.missingFundsAmount} {result.report.combined.executiveSummary.missingFundsCurrency || 'NGN'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Analysis Report */}
                                        {result.report.combined.analysisReport && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Analysis Report
                                                </h4>
                                                {typeof result.report.combined.analysisReport === 'string' ? (
                                                    <div style={{
                                                        padding: '12px',
                                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                        borderRadius: '6px',
                                                        fontSize: '14px',
                                                        color: 'var(--txt)',
                                                        lineHeight: '1.6',
                                                        whiteSpace: 'pre-wrap'
                                                    }}>
                                                        {result.report.combined.analysisReport}
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        padding: '12px',
                                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                        borderRadius: '6px',
                                                        fontSize: '14px',
                                                        color: 'var(--txt)',
                                                        lineHeight: '1.6'
                                                    }}>
                                                        {JSON.stringify(result.report.combined.analysisReport, null, 2)}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Audit Report */}
                                        {result.report.combined.auditReport && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Audit Report
                                                </h4>
                                                {result.report.combined.auditReport.keyFindings && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                            Key Findings
                                                        </h5>
                                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                            {Array.isArray(result.report.combined.auditReport.keyFindings)
                                                                ? result.report.combined.auditReport.keyFindings.map((finding: string, idx: number) => (
                                                                    <li key={idx} style={{ marginBottom: '6px' }}>{finding}</li>
                                                                ))
                                                                : <li>{String(result.report.combined.auditReport.keyFindings)}</li>
                                                            }
                                                        </ul>
                                                    </div>
                                                )}
                                                {result.report.combined.auditReport.recommendations && (
                                                    <div style={{ marginTop: '12px' }}>
                                                        <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                            Recommendations
                                                        </h5>
                                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                            {Array.isArray(result.report.combined.auditReport.recommendations)
                                                                ? result.report.combined.auditReport.recommendations.map((rec: string, idx: number) => (
                                                                    <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
                                                                ))
                                                                : <li>{String(result.report.combined.auditReport.recommendations)}</li>
                                                            }
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Reconciliation */}
                                        {result.report.combined.reconciliation && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Reconciliation
                                                </h4>
                                                <div style={{
                                                    padding: '12px',
                                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    color: 'var(--txt)'
                                                }}>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                        <strong style={{ color: 'var(--txt)' }}>Matched Transactions:</strong> {result.report.combined.reconciliation.matchedTransactions || 0}
                                                    </p>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                        <strong style={{ color: 'var(--txt)' }}>Reconciliation Rate:</strong> {result.report.combined.reconciliation.reconciliationRate || 0}%
                                                    </p>
                                                    {result.report.combined.reconciliation.discrepancies && result.report.combined.reconciliation.discrepancies.length > 0 && (
                                                        <div style={{ marginTop: '12px' }}>
                                                            <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                Discrepancies ({result.report.combined.reconciliation.discrepancies.length})
                                                            </h5>
                                                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                {result.report.combined.reconciliation.discrepancies.slice(0, 5).map((disc: any, idx: number) => (
                                                                    <li key={idx} style={{ marginBottom: '6px' }}>
                                                                        <strong>{disc.type}:</strong> {disc.description} ({disc.amount} {disc.currency})
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Missing Funds */}
                                        {result.report.combined.missingFunds && result.report.combined.missingFunds.totalMissing > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#dc2626', fontWeight: 600 }}>
                                                    Missing Funds
                                                </h4>
                                                <div style={{
                                                    padding: '12px',
                                                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    color: '#dc2626'
                                                }}>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: 500 }}>
                                                        <strong>Total Missing:</strong> {result.report.combined.missingFunds.totalMissing} {result.report.combined.missingFunds.currency || 'NGN'}
                                                    </p>
                                                    {result.report.combined.missingFunds.recommendations && (
                                                        <div style={{ marginTop: '12px' }}>
                                                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                                                                {Array.isArray(result.report.combined.missingFunds.recommendations)
                                                                    ? result.report.combined.missingFunds.recommendations.map((rec: string, idx: number) => (
                                                                        <li key={idx} style={{ marginBottom: '6px' }}>{rec}</li>
                                                                    ))
                                                                    : <li>{String(result.report.combined.missingFunds.recommendations)}</li>
                                                                }
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Financial Analysis */}
                                        {result.report.combined.financialAnalysis && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Financial Analysis
                                                </h4>
                                                <div style={{
                                                    padding: '12px',
                                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    color: 'var(--txt)'
                                                }}>
                                                    {result.report.combined.financialAnalysis.profitLoss && (
                                                        <div style={{ marginBottom: '12px' }}>
                                                            <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                Profit/Loss
                                                            </h5>
                                                            <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                <strong style={{ color: 'var(--txt)' }}>Net P/L:</strong> {result.report.combined.financialAnalysis.profitLoss.netProfitLoss || 0} {result.report.combined.financialAnalysis.profitLoss.currency || 'USD'}
                                                            </p>
                                                            {result.report.combined.financialAnalysis.profitLoss.ngnEquivalent && (
                                                                <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                                    <strong style={{ color: 'var(--txt)' }}>NGN Equivalent:</strong> {result.report.combined.financialAnalysis.profitLoss.ngnEquivalent} NGN
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Compliance */}
                                        {result.report.combined.compliance && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Compliance
                                                </h4>
                                                <div style={{
                                                    padding: '12px',
                                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    color: 'var(--txt)'
                                                }}>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                        <strong style={{ color: 'var(--txt)' }}>Status:</strong> {result.report.combined.compliance.complianceStatus || 'N/A'}
                                                    </p>
                                                    {result.report.combined.compliance.taxObligations && result.report.combined.compliance.taxObligations.length > 0 && (
                                                        <div style={{ marginTop: '12px' }}>
                                                            <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--txt)', fontWeight: 500 }}>
                                                                Tax Obligations
                                                            </h5>
                                                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                {result.report.combined.compliance.taxObligations.map((obligation: string, idx: number) => (
                                                                    <li key={idx} style={{ marginBottom: '6px' }}>{obligation}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Risk Assessment */}
                                        {result.report.combined.riskAssessment && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--txt)', fontWeight: 600 }}>
                                                    Risk Assessment
                                                </h4>
                                                <div style={{
                                                    padding: '12px',
                                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    color: 'var(--txt)'
                                                }}>
                                                    <p style={{ margin: '4px 0', fontSize: '14px', color: 'var(--muted)' }}>
                                                        <strong style={{ color: 'var(--txt)' }}>Overall Risk Level:</strong> {result.report.combined.riskAssessment.overallRiskLevel || 'N/A'}
                                                    </p>
                                                    {result.report.combined.riskAssessment.suspiciousTransactions && result.report.combined.riskAssessment.suspiciousTransactions.length > 0 && (
                                                        <div style={{ marginTop: '12px' }}>
                                                            <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#dc2626', fontWeight: 500 }}>
                                                                Suspicious Transactions ({result.report.combined.riskAssessment.suspiciousTransactions.length})
                                                            </h5>
                                                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
                                                                {result.report.combined.riskAssessment.suspiciousTransactions.slice(0, 3).map((tx: any, idx: number) => (
                                                                    <li key={idx} style={{ marginBottom: '6px' }}>
                                                                        <strong>{tx.type}:</strong> {tx.description} ({tx.amount} - {tx.riskLevel})
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
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
                                        Your financial analysis has been completed successfully. Report data is being processed.
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
                                textAlign: 'center',
                                marginBottom: '12px'
                            }}>
                                Upload both your bank and crypto statements for analysis. We support PDF, DOCX, DOC, TXT, HTML, PNG, and JPEG formats.
                            </p>

                            <div style={{
                                padding: '12px',
                                backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 193, 7, 0.3)',
                                marginBottom: '16px'
                            }}>
                                <p style={{
                                    margin: 0,
                                    color: '#ffc107',
                                    fontSize: '13px',
                                    textAlign: 'center',
                                    fontWeight: 500
                                }}>
                                    ⚠️ Important: Only statements covering 1 month or less are allowed. Maximum file size: 200KB per file.
                                </p>
                            </div>

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
                                        disabled={uploading || extracting || analyzing}
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
                                        disabled={uploading || extracting || analyzing}
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

                            {!jobId && bankFile && cryptoFile && !uploading && (
                                <button
                                    onClick={uploadFiles}
                                    className="btn"
                                    style={{
                                        width: '100%',
                                        marginTop: '8px',
                                        padding: '16px',
                                        fontSize: '16px',
                                        fontWeight: 600
                                    }}
                                    disabled={uploading}
                                >
                                    {uploading ? 'Uploading...' : 'Upload Statements'}
                                </button>
                            )}

                            {jobId && jobStatus && !result && !error && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px',
                                    backgroundColor: 'rgba(0, 115, 55, 0.1)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(0, 115, 55, 0.3)'
                                }}>
                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--accent)' }}>
                                        {jobStatus.extractionStatus === 'completed' && jobStatus.analysisStatus === 'processing'
                                            ? '✓ Extraction complete. Analysis in progress...'
                                            : jobStatus.extractionStatus === 'processing'
                                                ? '⏳ Extraction in progress...'
                                                : '⏳ Processing...'
                                        }
                                    </p>
                                </div>
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

