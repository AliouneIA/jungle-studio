'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Sparkles, ChevronLeft, Copy, Check, Network, Zap, ZoomIn, ZoomOut, AlertCircle, History, Calendar, MessageCircle, ArrowRight, Search } from 'lucide-react'
import type { RawResponse, FusionPhases, Exchange, FusionMode } from '@/hooks/useFusionEngine'
import FusionExchangePanel from './FusionExchangePanel'
import { createClient } from '@/utils/supabase/client'

interface ReflectionPanelProps {
    isOpen: boolean
    onClose: () => void
    rawResponses: RawResponse[]
    isLoading?: boolean
    fusionResult?: string | null
    phases?: FusionPhases | null
    exchanges?: Exchange[]
    fusionMode?: FusionMode
    activeConversationId?: string
    requestedRunId?: string | null
    supabaseClient?: any
}

const ModelIcon = ({ src, fallback, className }: { src?: string, fallback: string, className?: string }) => {
    const [error, setError] = useState(false)

    if (src && !error) {
        return (
            <img
                src={src}
                alt=""
                className={`w-5 h-5 object-contain rounded-md inline-block mr-2 ${className || ''}`}
                onError={() => setError(true)}
            />
        )
    }

    return <span className="mr-2">{fallback}</span>
}

// Fix Bug 6: Factory functions au lieu d'instances JSX au module-level
const MODEL_INFO: Record<string, { name: string, color: string, bg: string, icon: () => React.ReactNode }> = {
    'gpt-5': { name: 'GPT-5.2', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: () => <ModelIcon src="/gpt 1.png" fallback="🟢" /> },
    'gpt': { name: 'GPT-4o', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: () => <ModelIcon src="/gpt 1.png" fallback="🟢" /> },
    'o3': { name: 'o3-pro', color: 'text-pink-400', bg: 'bg-pink-500/10', icon: () => <ModelIcon src="/gpt 1.png" fallback="🧠" /> },
    'claude': { name: 'Claude Opus', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: () => <ModelIcon src="/claude 2.jpg" fallback="🟣" /> },
    'gemini': { name: 'Gemini 3', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: () => <ModelIcon src="/gemini.png" fallback="🔵" className="scale-125" /> },
    'nano': { name: 'Nano Banana', color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: () => <ModelIcon src="/gemini.png" fallback="🍌" className="scale-125" /> },
    'grok': { name: 'Grok 4.1', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: () => <ModelIcon src="/logos/Grok-Logo-PNG.png" fallback="🦊" className="scale-125" /> },
    'default': { name: 'AI', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: () => <ModelIcon fallback="⚪" /> }
}

function getModelInfo(slug: string) {
    for (const [key, info] of Object.entries(MODEL_INFO)) {
        if (slug.toLowerCase().includes(key)) return info
    }
    return MODEL_INFO.default
}

// Fix Bug 1: Échapper le HTML pour éviter XSS, puis transformer les URLs en liens
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function renderContentWithLinks(content: string): string {
    // 1. Échapper tout le HTML brut (anti-XSS)
    let safe = escapeHtml(content)

    // Fix Bug 5: Appliquer le regex Markdown EN PREMIER (avant que les URLs soient transformées)
    // Markdown links: [texte](url) → <a>texte</a>
    safe = safe.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #1a1a1a; text-decoration: underline;">$1</a>'
    )

    // 2. URLs brutes restantes (celles qui ne sont pas déjà dans un href="...")
    safe = safe.replace(
        /(?<!href=")(https?:\/\/[^\s<>"')\]]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1a1a1a; text-decoration: underline;">$1</a>'
    )

    return safe
}

export default function ReflectionPanel({
    isOpen,
    onClose,
    rawResponses: initialRawResponses,
    isLoading,
    fusionResult: initialFusionResult,
    phases: initialPhases,
    exchanges: initialExchanges = [],
    fusionMode: initialFusionMode = 'fusion',
    activeConversationId,
    requestedRunId,
    supabaseClient
}: ReflectionPanelProps) {
    const supabase = supabaseClient || createClient()
    const [activeTab, setActiveTab] = useState<number>(0)
    const [viewMode, setViewMode] = useState<'responses' | 'exchanges' | 'history'>('responses')
    const [copied, setCopied] = useState<number | null>(null)
    const [zoomLevel, setZoomLevel] = useState<number>(1.0)
    const [dismissedError, setDismissedError] = useState<boolean>(false)

    // Set default view mode to history if no current responses
    useEffect(() => {
        if (isOpen && initialRawResponses.length === 0) {
            setViewMode('history')
        } else if (isOpen) {
            setViewMode('responses')
        }
    }, [isOpen, initialRawResponses.length])

    // Dynamic state for current view (can be from history or current run)
    const [currentRawResponses, setCurrentRawResponses] = useState<RawResponse[]>(initialRawResponses)
    const [currentFusionResult, setCurrentFusionResult] = useState<string | null>(initialFusionResult || null)
    const [currentPhases, setCurrentPhases] = useState<FusionPhases | null>(initialPhases || null)
    const [currentExchanges, setCurrentExchanges] = useState<Exchange[]>(initialExchanges)
    const [currentFusionMode, setCurrentFusionMode] = useState<FusionMode>(initialFusionMode)

    // History state
    const [historyRuns, setHistoryRuns] = useState<any[]>([])
    const [isHistoryLoading, setIsHistoryLoading] = useState(false)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [filterMode, setFilterMode] = useState<string>('all')

    // Fix Bug 4: Flag pour éviter boucle infinie dans auto-load exchanges
    const hasAttemptedAutoLoadRef = useRef(false)

    // Consolidate synchronization of props and history loading
    useEffect(() => {
        if (isOpen) {
            fetchHistory()
            // Reset auto-load flag quand le panel s'ouvre
            hasAttemptedAutoLoadRef.current = false
        }
    }, [isOpen, activeConversationId])

    useEffect(() => {
        if (!selectedRunId) {
            setCurrentRawResponses(initialRawResponses)
            setCurrentFusionResult(initialFusionResult || null)
            setCurrentPhases(initialPhases || null)
            setCurrentExchanges(initialExchanges)
            setCurrentFusionMode(initialFusionMode)
        }
    }, [initialRawResponses, initialFusionResult, initialPhases, initialExchanges, initialFusionMode, selectedRunId, isOpen])

    // Fix Bug 4: Auto-load dernière fusion pour l'onglet Échanges (avec flag anti-boucle)
    useEffect(() => {
        if (isOpen && viewMode === 'exchanges' && !selectedRunId && historyRuns.length > 0) {
            if (!hasAttemptedAutoLoadRef.current) {
                const hasNoData = !currentPhases || (currentPhases.initial.length === 0 && currentPhases.crossAnalysis.length === 0)
                if (hasNoData) {
                    hasAttemptedAutoLoadRef.current = true
                    loadRunDetails(historyRuns[0])
                }
            }
        }
    }, [isOpen, viewMode, historyRuns, selectedRunId])
    // Fix Bug 4: Retiré currentPhases des dépendances pour éviter la boucle

    // Fix Bug 2: Ajouter user_id au fetchHistory
    const fetchHistory = async () => {
        setIsHistoryLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            setIsHistoryLoading(false)
            return
        }

        let query = supabase
            .from('fusion_runs')
            .select(`
                *,
                conversations!inner(mode),
                fusion_raw_responses(*),
                fusion_syntheses(*),
                fusion_critiques(*)
            `)
            .eq('user_id', user.id) // Fix Bug 2
            .order('created_at', { ascending: false })
            .limit(50)

        if (activeConversationId) {
            query = query.eq('conversation_id', activeConversationId)
        }

        const { data, error } = await query
        if (data) setHistoryRuns(data)
        setIsHistoryLoading(false)
    }


    // Fetch unique run if requested but not in history
    // Fix Bug 3: Ajouter user_id au fetchSpecificRun
    useEffect(() => {
        const fetchSpecificRun = async (runId: string) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('fusion_runs')
                .select(`
                    *,
                    conversations!inner(mode),
                    fusion_raw_responses(*),
                    fusion_syntheses(*),
                    fusion_critiques(*),
                    fusion_refinements(*)
                `)
                .eq('id', runId)
                .eq('user_id', user.id) // Fix Bug 3
                .single()

            if (data) {
                setHistoryRuns(prev => {
                    const exists = prev.find(r => r.id === data.id)
                    if (exists) return prev
                    return [data, ...prev]
                })
                loadRunDetails(data)
            }
        }

        if (isOpen && requestedRunId) {
            const run = historyRuns.find(r => r.id === requestedRunId)
            if (run) {
                loadRunDetails(run)
            } else {
                fetchSpecificRun(requestedRunId)
            }
        }
    }, [isOpen, requestedRunId])

    const loadRunDetails = (run: any) => {
        setSelectedRunId(run.id)

        // Map raw responses
        const mappedRaw: RawResponse[] = (run.fusion_raw_responses || []).map((r: any) => ({
            slug: r.model_slug,
            content: r.content,
            status: 'success'
        }))

        // Map phases
        const masterResponse = run.fusion_syntheses?.[0]
        const mappedPhases: FusionPhases = {
            initial: mappedRaw.map(r => ({ slug: r.slug, content: r.content })),
            crossAnalysis: (run.fusion_critiques || []).map((c: any) => ({
                slug: c.critic_model_slug,
                content: c.critique_content,
                analyzedBy: c.target_model_slug?.split(',') || []
            })),
            refinement: (run.fusion_refinements || []).map((ref: any) => ({
                slug: ref.model_slug,
                content: ref.content,
                tokens: ref.tokens
            })),
            synthesis: (masterResponse || run.master_model_slug) ? {
                masterSlug: masterResponse?.master_model_slug || run.master_model_slug,
                content: masterResponse?.final_content || run.final_content || '',
                fact_check_report: masterResponse?.fact_check_report
            } : (mappedRaw.length === 1 ? {
                masterSlug: mappedRaw[0].slug,
                content: mappedRaw[0].content
            } : null)
        }

        // Map exchanges
        const mappedExchanges: Exchange[] = (run.fusion_critiques || []).flatMap((c: any) =>
            (c.target_model_slug?.split(',') || []).map((target: string) => ({
                from: target,
                to: c.critic_model_slug,
                type: 'analysis' as const
            }))
        )

        setCurrentRawResponses(mappedRaw)
        setCurrentFusionResult(masterResponse?.final_content || (mappedRaw.length === 1 ? mappedRaw[0].content : null))
        setCurrentPhases(mappedPhases)
        setCurrentExchanges(mappedExchanges)

        // Détection correcte du mode
        const detectedMode = run.master_model_slug === 'manus-agent' ? 'manus' : (run.fusion_critiques?.length > 0 ? 'supernova' : 'fusion')
        setCurrentFusionMode(detectedMode)

        // Fix Bug 7: Appel direct sans setTimeout
        setViewMode('responses')
        setActiveTab(mappedRaw.length === 1 ? 0 : -1)
    }

    // Reset dismissal when new loading starts
    useEffect(() => {
        if (isLoading) setDismissedError(false)
    }, [isLoading])

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text)
        setCopied(index)
        setTimeout(() => setCopied(null), 2000)
    }

    if (!isOpen) return null

    const isSupernova = currentFusionMode === 'supernova'
    const hasFailedResponses = currentRawResponses.some((r: RawResponse) => r.status === 'failed')
    const tokenLimitReached = currentRawResponses.some((r: RawResponse) => r.error?.toLowerCase().includes('token') || r.error?.toLowerCase().includes('limit'))

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#F8F6F2]/95 backdrop-blur-md flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#5C4B40]/10 bg-[#EAE1D3]/50 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-3 py-2 text-[#5C4B40]/70 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-lg transition-all"
                    >
                        <ChevronLeft size={20} />
                        <span className="text-sm font-bold">Retour au Chat</span>
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    {/* Zoom Controls */}
                    <div className="flex items-center bg-secondary/10 rounded-lg p-1 mr-2">
                        <button
                            onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.1))}
                            className="p-1.5 hover:bg-white rounded transition-colors text-foreground/60"
                            title="Dézoomer"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Rapport de vérification Master</h4>
                        <span className="text-[10px] font-bold w-10 text-center text-foreground/40">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                            onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
                            className="p-1.5 hover:bg-white rounded transition-colors text-foreground/60"
                            title="Zoomer"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    {isSupernova && (
                        <div className="text-xs text-orange-600 flex items-center gap-1 font-bold">
                            <Zap size={12} className="fill-orange-600" />
                            10 appels API
                        </div>
                    )}
                    <div className="text-xs text-foreground/40 font-medium flex items-center gap-2">
                        {currentRawResponses.length} modèles analysés
                        {(hasFailedResponses || tokenLimitReached) && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 border border-red-100 rounded-full text-red-500 font-bold animate-pulse">
                                <AlertCircle size={10} />
                                <span className="text-[9px] uppercase tracking-tighter">Échec Partiel</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-secondary/10 bg-[#F4F1EC]">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('responses')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'responses'
                            ? 'bg-white shadow-md text-[#5C4B40] border border-[#5C4B40]/10'
                            : 'text-[#5C4B40]/50 hover:text-[#5C4B40] hover:bg-[#EAE1D3]'
                            }`}
                    >
                        <Sparkles size={16} />
                        Réponses
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history'
                            ? 'bg-white shadow-md text-[#5C4B40] border border-[#5C4B40]/10'
                            : 'text-[#5C4B40]/50 hover:text-[#5C4B40] hover:bg-[#EAE1D3]'
                            }`}
                    >
                        <History size={16} />
                        Historique
                        {historyRuns.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-[#5C4B40]/10 rounded text-[10px] tabular-nums">
                                {historyRuns.length}
                            </span>
                        )}
                    </button>
                    {(currentFusionMode === 'supernova' || currentFusionMode === 'fusion' || currentExchanges.length > 0) && (
                        <button
                            onClick={() => setViewMode('exchanges')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'exchanges'
                                ? 'bg-white shadow-md text-[#5C4B40] border border-[#5C4B40]/10'
                                : 'text-[#5C4B40]/50 hover:text-[#5C4B40] hover:bg-[#EAE1D3]'
                                }`}
                        >
                            <Network size={16} />
                            Échanges
                        </button>
                    )}
                </div>
            </div>

            {/* Response Tabs Navigation (only in responses view) */}
            {viewMode === 'responses' && (
                <div className="flex items-center gap-1 px-6 py-3 border-b border-[#5C4B40]/10 bg-[#F4F1EC]/50 overflow-x-auto no-scrollbar">
                    {currentRawResponses.map((response: RawResponse, idx: number) => {
                        const info = getModelInfo(response.slug)
                        const isActive = activeTab === idx
                        return (
                            <button
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive
                                    ? `${info.bg} ${info.color} border border-current font-bold shadow-sm`
                                    : 'text-foreground/50 hover:text-foreground hover:bg-secondary/10'
                                    }`}
                            >
                                {/* Fix Bug 6: Appeler la factory function */}
                                <span>{info.icon()}</span>
                                <span>{info.name}</span>
                                {response.status === 'failed' && <span className="text-red-500">⚠</span>}
                            </button>
                        )
                    })}

                    {/* Fusion Result Tab */}
                    {currentFusionResult && (
                        <button
                            onClick={() => setActiveTab(-1)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ml-4 ${activeTab === -1
                                ? 'bg-gradient-to-r from-secondary/20 to-foreground/5 text-foreground border border-secondary/50 shadow-sm'
                                : 'text-foreground/50 hover:text-foreground hover:bg-secondary/10'
                                }`}
                        >
                            <Sparkles size={16} />
                            <span>Synthèse {currentFusionMode === 'supernova' ? 'Supernova' : 'Fusion'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#F8F6F2] no-scrollbar">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="relative">
                            <Sparkles className={`animate-pulse ${initialFusionMode === 'supernova' ? 'text-orange-500' : 'text-secondary'}`} size={48} />
                            <div className={`absolute inset-0 blur-xl animate-ping ${initialFusionMode === 'supernova' ? 'bg-orange-500/30' : 'bg-secondary/30'}`} />
                        </div>
                        <p className="text-foreground/60 text-lg">
                            {initialFusionMode === 'supernova' ? 'Supernova en cours... 🔥' : 'Analyse en cours...'}
                        </p>
                    </div>
                ) : viewMode === 'history' ? (
                    <div className="max-w-4xl mx-auto py-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-bold text-[#5C4B40]">Archives des Réflexions</h2>
                            </div>

                            {/* Filtres d'historique sous forme d'onglets */}
                            <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                                {[
                                    { id: 'all', label: 'Tout', icon: <Brain size={16} className={filterMode === 'all' ? 'text-white' : 'text-[#5C4B40]'} /> },
                                    {
                                        id: 'fusion',
                                        label: 'Fusion',
                                        icon: <img src="/fusion.png" alt="" className={`w-4 h-4 object-contain brightness-[10] contrast-[10] ${filterMode === 'fusion' ? '' : 'opacity-70'}`} />
                                    },
                                    {
                                        id: 'supernova',
                                        label: 'Supernova',
                                        icon: <img src="/fusion.png" alt="" className={`w-4 h-4 object-contain sepia saturate-[5] brightness-125 hue-rotate-[10deg] drop-shadow-[0_2px_10px_rgba(255,215,0,0.4)] ${filterMode === 'supernova' ? '' : 'opacity-70'}`} />
                                    },
                                    { id: 'manus', label: 'Manus', icon: <img src="/Manus1.png" alt="" className="w-3.5 h-3.5 object-contain" /> },
                                    { id: 'solo', label: 'Solo', icon: <Sparkles size={16} className={filterMode === 'solo' ? 'text-white' : 'text-[#5C4B40]'} /> },
                                    { id: 'research', label: 'Recherche', icon: <Search size={16} className={filterMode === 'research' ? 'text-white' : 'text-[#5C4B40]/60'} /> }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilterMode(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border ${filterMode === tab.id
                                            ? 'bg-[#5C4B40] text-white border-[#5C4B40] shadow-md scale-105'
                                            : 'bg-white/50 text-[#5C4B40]/60 border-[#5C4B40]/10 hover:bg-white hover:text-[#5C4B40] hover:border-[#5C4B40]/30'
                                            }`}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {isHistoryLoading && historyRuns.length === 0 ? (
                                <div className="flex justify-center py-20">
                                    <div className="w-8 h-8 border-4 border-[#5C4B40]/20 border-t-[#5C4B40] rounded-full animate-spin" />
                                </div>
                            ) : historyRuns.length === 0 ? (
                                <div className="text-center py-20 bg-white/50 backdrop-blur rounded-2xl border border-dashed border-[#5C4B40]/20">
                                    <History size={48} className="mx-auto mb-4 text-[#5C4B40]/20" />
                                    <p className="text-[#5C4B40]/40 font-bold">Aucun historique pour cette conversation</p>
                                    <p className="text-[#5C4B40]/30 text-sm">Les futures fusions seront automatiquement sauvegardées ici.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {historyRuns
                                        .filter(run => {
                                            if (filterMode === 'all') return true
                                            const runMode = run.conversations?.mode || 'solo'
                                            return runMode === filterMode
                                        })
                                        .map((run) => {
                                            const isSupernova = run.fusion_critiques?.length > 0
                                            const isManus = run.master_model_slug === 'manus-agent'
                                            const isResearch = run.conversations?.mode === 'research'
                                            const isSolo = run.fusion_raw_responses?.length === 1 && !isManus && !isResearch

                                            return (
                                                <motion.button
                                                    key={run.id}
                                                    whileHover={{ x: 8 }}
                                                    onClick={() => loadRunDetails(run)}
                                                    className={`flex items-center justify-between p-5 rounded-xl border transition-all text-left group ${selectedRunId === run.id
                                                        ? 'bg-white border-[#5C4B40] shadow-md ring-2 ring-[#5C4B40]/10'
                                                        : 'bg-white/40 border-[#5C4B40]/10 hover:bg-white hover:border-[#5C4B40]/30 hover:shadow-sm'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-lg ${isSupernova ? 'bg-[#4a0505] text-white shadow-[0_0_10px_rgba(74,5,5,0.3)]' :
                                                            isManus ? 'bg-emerald-500/10 text-emerald-600' :
                                                                isResearch ? 'bg-[#5C4B40]/10 text-[#5C4B40]' :
                                                                    isSolo ? 'bg-[#5C4B40]/10 text-[#5C4B40]' :
                                                                        'bg-[#5C4B40]/10 text-[#5C4B40]'}`}>
                                                            {isSupernova ? (
                                                                <img src="/fusion.png" alt="" className="w-5 h-5 object-contain sepia saturate-[5] brightness-125 hue-rotate-[10deg]" />
                                                            ) : isManus ? (
                                                                <img src="/Manus1.png" alt="Manus" className="w-5 h-5 object-contain" />
                                                            ) : isResearch ? (
                                                                <Search size={20} />
                                                            ) : isSolo ? (
                                                                <Sparkles size={20} />
                                                            ) : (
                                                                <img src="/fusion.png" alt="" className="w-5 h-5 object-contain contrast-[10] grayscale invert" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-[#5C4B40] line-clamp-1 mb-1">
                                                                {run.prompt_original}
                                                            </h3>
                                                            <div className="flex items-center gap-3 text-[10px] text-[#5C4B40]/50 font-bold uppercase tracking-wider">
                                                                <span className="flex items-center gap-1">
                                                                    <Calendar size={10} />
                                                                    {new Date(run.created_at).toLocaleString('fr-FR')}
                                                                </span>
                                                                {isResearch ? (
                                                                    <span className="flex items-center gap-1 text-[#5C4B40] font-black">
                                                                        Recherche approfondie • {run.fusion_raw_responses?.length || 'Plusieurs'} sources
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1 bg-[#5C4B40]/5 px-1.5 py-0.5 rounded">
                                                                        {run.fusion_raw_responses?.length} modèles
                                                                    </span>
                                                                )}
                                                                {run.fusion_critiques?.length > 0 && (
                                                                    <span className="text-[#4a0505] bg-[#4a0505]/5 px-1.5 py-0.5 rounded">
                                                                        Supernova
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ArrowRight size={20} className="text-[#5C4B40]/30 group-hover:text-[#5C4B40] transition-colors" />
                                                </motion.button>
                                            )
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : viewMode === 'exchanges' ? (
                    // Exchange Visualization
                    <FusionExchangePanel
                        phases={currentPhases}
                        exchanges={currentExchanges}
                        isLoading={isLoading}
                        rawResponses={currentRawResponses}
                    />
                ) : currentRawResponses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-foreground/30">
                        <Brain size={64} />
                        <p className="text-xl">Aucune réflexion pour l'instant</p>
                        <p className="text-sm">Envoyez un message en mode Fusion pour voir les analyses</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {activeTab === -1 && currentFusionResult ? (
                            // Fusion Result View
                            <motion.div
                                key="fusion"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-4xl mx-auto"
                            >
                                <div className={`bg-white border rounded-2xl p-8 shadow-lg ${currentFusionMode === 'supernova' ? 'border-orange-200' : 'border-secondary/30'}`}>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <Sparkles className={currentFusionMode === 'supernova' ? 'text-orange-500' : 'text-secondary'} size={28} />
                                            <h2 className="text-2xl font-bold text-foreground">
                                                {currentFusionMode === 'supernova' ? 'Synthèse Supernova 🔥' : 'Synthèse Fusionnée'}
                                            </h2>
                                        </div>
                                        <button
                                            onClick={() => currentFusionResult && handleCopy(currentFusionResult, -1)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${copied === -1 ? 'bg-[#5C4B40] text-white' : 'bg-secondary/10 hover:bg-secondary/20 text-foreground/60'}`}
                                        >
                                            {copied === -1 ? <Check size={14} /> : <Copy size={14} />}
                                            {copied === -1 ? 'Copié!' : 'Copier'}
                                        </button>
                                    </div>
                                    {/* Fix Bug 1 + Fix Bug 5: Contenu sanitisé avec liens dans le bon ordre */}
                                    <p
                                        className="text-foreground/90 leading-relaxed whitespace-pre-wrap transition-all transform-gpu"
                                        style={{ fontSize: `${18 * zoomLevel}px` }}
                                        dangerouslySetInnerHTML={{
                                            __html: renderContentWithLinks(currentFusionResult)
                                        }}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            // Individual Model View
                            currentRawResponses[activeTab] && (
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="max-w-4xl mx-auto"
                                >
                                    {(() => {
                                        const response = currentRawResponses[activeTab]
                                        const info = getModelInfo(response.slug)
                                        return (
                                            <div className="bg-white border border-secondary/20 rounded-2xl p-8 shadow-md">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-3">
                                                        {/* Fix Bug 6: Appeler la factory function */}
                                                        <span className="text-3xl">{info.icon()}</span>
                                                        <div>
                                                            <h2 className="text-2xl font-bold text-foreground">{info.name}</h2>
                                                            <p className="text-sm opacity-60 text-foreground">{response.slug}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopy(response.content, activeTab)}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${copied === activeTab ? 'bg-[#5C4B40] text-white' : 'bg-secondary/10 hover:bg-secondary/20 text-foreground/70'}`}
                                                    >
                                                        {copied === activeTab ? <Check size={14} /> : <Copy size={14} />}
                                                        {copied === activeTab ? 'Copié!' : 'Copier'}
                                                    </button>
                                                </div>

                                                {response.status === 'failed' ? (
                                                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600">
                                                        <p className="font-bold mb-2">⚠ Erreur</p>
                                                        <p>{response.error || 'Une erreur est survenue'}</p>
                                                    </div>
                                                ) : (
                                                    /* Fix Bug 1 + Fix Bug 5: Contenu sanitisé avec liens dans le bon ordre */
                                                    <p
                                                        className="text-foreground/90 leading-relaxed whitespace-pre-wrap transition-all transform-gpu"
                                                        style={{ fontSize: `${18 * zoomLevel}px` }}
                                                        dangerouslySetInnerHTML={{
                                                            __html: renderContentWithLinks(response.content)
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        )
                                    })()}
                                </motion.div>
                            )
                        )}
                    </AnimatePresence>
                )}
            </div>
        </motion.div>
    )
}
