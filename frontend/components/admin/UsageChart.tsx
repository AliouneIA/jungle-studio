'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus,
  Zap, DollarSign, Hash, ArrowUpRight, ArrowDownRight, Layers, Sparkles, ChevronDown,
  Wallet, AlertCircle, CheckCircle2, KeyRound
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface ModelStats {
  model: string
  label: string
  provider: string
  tokens: number
  cost: number
  requests: number
  sources: Record<string, number>
  lastMonth: { tokens: number; cost: number; requests: number }
  change: number | null
}

interface UsageData {
  thisMonth: {
    totalTokens: number
    totalCost: number
    totalRequests: number
    byModel: ModelStats[]
    byProvider: Record<string, { tokens: number; cost: number; requests: number }>
    bySource: Record<string, number>
  }
  lastMonth: { totalTokens: number; totalCost: number }
  change: { tokens: number | null; cost: number | null }
  lastAnalyzed: string
}

interface BillingEntry {
  provider: string
  label: string
  spent_this_month?: number
  status: 'ok' | 'limited' | 'no_api' | 'error'
  note?: string
  error?: string
  username?: string
}

const PROVIDER_COLORS: Record<string, { bar: string; bg: string; text: string; label: string }> = {
  openai: { bar: '#10B981', bg: 'bg-green-50', text: 'text-green-700', label: 'OpenAI' },
  anthropic: { bar: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Anthropic' },
  google: { bar: '#3B82F6', bg: 'bg-blue-50', text: 'text-blue-700', label: 'Google' },
  xai: { bar: '#6366F1', bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'xAI' },
  mistral: { bar: '#8B5CF6', bg: 'bg-violet-50', text: 'text-violet-700', label: 'Mistral' },
  replicate: { bar: '#EC4899', bg: 'bg-pink-50', text: 'text-pink-700', label: 'Replicate' },
  unknown: { bar: '#94A3B8', bg: 'bg-slate-50', text: 'text-slate-700', label: 'Autre' },
}

const SOURCE_LABELS: Record<string, string> = {
  chat: '💬 Chat',
  fusion: '🔀 Fusion',
  studio: '🎨 Studio',
  video: '🎬 Vidéo',
  canvas: '📄 Canvas',
  research: '🔍 Research',
  memory: '🧠 Mémoire',
  tts: '🎙️ TTS',
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(3)}`
  return `$${n.toFixed(4)}`
}

// Helper composant logo avec fallback — identique à ChatInput
const SynthesisModelIcon = ({ src, fallback }: { src: string; fallback: string }) => {
  const [err, setErr] = React.useState(false)
  // Guard : ne jamais passer src vide à <img>
  if (!src || err) return <span className="text-xs">{fallback}</span>
  return <img src={src} alt="" className="w-4 h-4 object-contain rounded" onError={() => setErr(true)} />
}

const SYNTHESIS_MODELS = [
  { slug: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai', logo: '/gpt 1.png', fallback: '🟢' },
  { slug: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', provider: 'openai', logo: '/gpt 1.png', fallback: '💎' },
  { slug: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'anthropic', logo: '/claude 2.jpg', fallback: '🟣' },
  { slug: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', provider: 'anthropic', logo: '/claude 2.jpg', fallback: '🎭' },
  { slug: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', provider: 'google', logo: '/gemini.png', fallback: '🔵' },
  { slug: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'google', logo: '/gemini.png', fallback: '⚡' },
  { slug: 'grok-4-2', label: 'Grok 4.2', provider: 'xai', logo: '/logos/Grok-Logo-PNG.png', fallback: '🦊' },
]

export default function UsageChart() {
  const supabase = createClient()
  const [data, setData] = useState<UsageData | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'tokens' | 'cost' | 'requests'>('tokens')
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)
  const [selectedBar, setSelectedBar] = useState<string | null>(null)
  const [synthesis, setSynthesis] = useState<string | null>(null)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [synthesisModel, setSynthesisModel] = useState('gpt-4o-mini')
  const [showSynthesisSelector, setShowSynthesisSelector] = useState(false)
  const [hasRealOpenAI, setHasRealOpenAI] = useState(false)
  const [billing, setBilling] = useState<BillingEntry[]>([])
  const [isBillingLoading, setIsBillingLoading] = useState(false)
  const [isBillingOpen, setIsBillingOpen] = useState(false)
  const [billingFilter, setBillingFilter] = useState<'all' | string>('all')

  const fetchBilling = useCallback(async () => {
    setIsBillingLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=billing`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        }
      })
      const result = await res.json()
      if (result.balances) setBilling(result.balances)
    } catch (err) {
      console.error('[UsageChart] Billing error:', err)
    } finally {
      setIsBillingLoading(false)
    }
  }, [supabase])

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=stats`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        }
      })
      const result = await res.json()
      if (result.thisMonth) setData(result)
      if (result.real_openai) setHasRealOpenAI(true)
    } catch (err) {
      console.error('[UsageChart] Stats fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchBilling()
    fetchStats()
  }, [fetchBilling, fetchStats])

  const analyze = useCallback(async () => {
    setIsAnalyzing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        }
      })

      setIsLoading(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=stats`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        }
      })

      const result = await res.json()
      if (result.thisMonth) setData(result)
      if (result.real_openai) setHasRealOpenAI(true)

      fetchBilling()
    } catch (err) {
      console.error('[UsageChart] Error:', err)
    } finally {
      setIsAnalyzing(false)
      setIsLoading(false)
    }
  }, [supabase, fetchBilling])

  const handleSynthesize = useCallback(async () => {
    setIsSynthesizing(true)
    setSynthesis(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=synthesize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model_slug: synthesisModel })
      })

      const result = await res.json()
      if (result.synthesis) setSynthesis(result.synthesis)
      else if (result.error) setSynthesis(`❌ ${result.error}`)
    } catch (err) {
      console.error('[UsageChart] Synthesis error:', err)
      setSynthesis('❌ Erreur lors de la synthèse')
    } finally {
      setIsSynthesizing(false)
    }
  }, [supabase, synthesisModel])

  // All models (no filter on chart)
  const activeModels = data ? data.thisMonth.byModel : []

  const maxValue = activeModels.length > 0
    ? Math.max(...activeModels.map(m =>
      viewMode === 'tokens' ? m.tokens : viewMode === 'cost' ? m.cost : m.requests
    ), 1)
    : 1

  // Fixed bar width — scroll handles overflow
  const barWidth = 64

  // Short model name (logo handles provider identity)
  function shortName(slug: string): string {
    const map: Record<string, string> = {
      'gemini-3-flash': '3 Flash',
      'gemini-3-pro': '3 Pro',
      'gemini-3.0-pro': '3 Pro',
      'gemini-2.0-flash': '2 Flash',
      'gemini-2.5-pro': '2.5 Pro',
      'gpt-5.2': '5.2',
      'gpt-5.2-pro': 'Pro 5.2',
      'gpt-4o': '4o',
      'gpt-4o-mini': '4o Mini',
      'gpt-4': '4',
      'gpt-4-turbo': '4 Turbo',
      'claude-opus-4.6': 'Opus 4.6',
      'claude-opus': 'Opus',
      'claude-sonnet': 'Sonnet',
      'claude-3.5-sonnet': 'Son 3.5',
      'claude-3-haiku': 'Haiku',
      'grok-3': 'Grok 3',
      'grok-3-mini': 'Grok m',
      'grok-video': 'Video',
      'grok-imagine-pro': 'Imagine',
      'dall-e-3': 'DALL-E 3',
      'flux': 'Flux',
      'nano-banana-pro': 'Banana',
      'whisper-1': 'Whisper',
      'gpt-4o-transcribe': 'Transcr.',
      'mistral-large': 'Large',
      'mistral-small': 'Small',
      'o1': 'o1',
      'o1-mini': 'o1 Mini',
      'o3-mini': 'o3 Mini',
    }
    if (map[slug]) return map[slug]
    return slug.length > 10 ? slug.substring(0, 9) + '…' : slug
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-xl">
            <BarChart3 size={20} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#5C4B40]">Usage des Ressources</h3>
            <p className="text-xs text-[#5C4B40]/50">
              {data ? `Dernière analyse : ${new Date(data.lastAnalyzed).toLocaleString('fr-FR')}` : 'Cliquez sur Analyser pour scanner votre consommation'}
            </p>
          </div>
        </div>
        <button
          onClick={analyze}
          disabled={isAnalyzing}
          className="px-5 py-2.5 bg-[#5C4B40] text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {isAnalyzing ? 'Analyse...' : 'Analyser'}
        </button>
      </div>

      {/* Empty State */}
      {!data && !isAnalyzing && (
        <div className="flex flex-col items-center justify-center py-20 text-[#5C4B40]/20">
          <BarChart3 size={48} className="mb-4 opacity-30" />
          <p className="text-sm font-bold text-[#5C4B40]/30">Aucune donnée</p>
          <p className="text-xs text-[#5C4B40]/20 mt-1">Cliquez sur "Analyser" pour scanner vos conversations, images et vidéos</p>
        </div>
      )}

      {/* Loading */}
      {isAnalyzing && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-[#5C4B40]/30">
          <Loader2 size={32} className="animate-spin mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">Scan de toutes les tables...</p>
          <p className="text-[10px] text-[#5C4B40]/20 mt-1">Messages, Fusion, Studio, Vidéos...</p>
        </div>
      )}

      {/* Billing / Account Balances (Collapsible) - Moved here to be always visible if loaded */}
      {billing.length > 0 && (
        <div className="bg-white border border-[#5C4B40]/10 rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={(e) => { e.stopPropagation(); setIsBillingOpen(!isBillingOpen) }}
            className="w-full flex items-center justify-between p-4 hover:bg-[#5C4B40]/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-[#5C4B40]/40" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/30">Solde des comptes</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Provider Filter - always visible */}
              <select
                value={billingFilter}
                onChange={(e) => { e.stopPropagation(); setBillingFilter(e.target.value) }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-[#5C4B40]/10 rounded-lg px-2 py-1 text-[9px] font-bold text-[#5C4B40] focus:outline-none cursor-pointer shadow-sm"
              >
                <option value="all">Tous</option>
                {billing.map(b => (
                  <option key={b.provider} value={b.provider}>{b.label}</option>
                ))}
              </select>
              {/* Minified avatars when closed */}
              {!isBillingOpen && (
                <div className="flex -space-x-2">
                  {billing
                    .filter(b => billingFilter === 'all' || b.provider === billingFilter)
                    .slice(0, 4).map((b, idx) => (
                      <div
                        key={b.provider}
                        className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[7px] font-black text-white shadow-sm"
                        style={{ backgroundColor: PROVIDER_COLORS[b.provider]?.bar || '#94A3B8', zIndex: 10 - idx }}
                      >
                        {b.label.charAt(0)}
                      </div>
                    ))}
                </div>
              )}
              <ChevronDown size={14} className={`text-[#5C4B40]/30 transition-transform duration-300 ${isBillingOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          <AnimatePresence>
            {isBillingOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-[#5C4B40]/5"
              >
                <div className="p-4 pt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {billing
                    .filter(b => billingFilter === 'all' || b.provider === billingFilter)
                    .map((b) => {
                      const cfg = PROVIDER_COLORS[b.provider] || PROVIDER_COLORS.unknown
                      return (
                        <div
                          key={b.provider}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${b.status === 'ok' ? 'border-green-200 bg-green-50/50' :
                            b.status === 'limited' ? 'border-amber-200 bg-amber-50/50' :
                              'border-[#5C4B40]/10 bg-[#F8F6F2]'
                            }`}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.bar + '20' }}>
                            {b.status === 'ok' ? (
                              <CheckCircle2 size={14} style={{ color: cfg.bar }} />
                            ) : b.status === 'limited' ? (
                              <AlertCircle size={14} className="text-amber-500" />
                            ) : (
                              <KeyRound size={14} className="text-[#5C4B40]/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-[#5C4B40] truncate">{b.label}</p>
                            {b.status === 'ok' && b.spent_this_month !== undefined ? (
                              <p className="text-xs font-black text-[#5C4B40]">
                                ${b.spent_this_month.toFixed(2)} <span className="text-[9px] font-normal text-[#5C4B40]/40">dépensé ce mois</span>
                              </p>
                            ) : b.status === 'limited' ? (
                              <p className="text-[9px] text-amber-600">{b.error || 'Accès limité'}</p>
                            ) : (
                              <p className="text-[9px] text-[#5C4B40]/40">{b.note || 'Clé configurée ✓'}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Dashboard */}
      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Tokens ce mois', value: formatTokens(data.thisMonth.totalTokens), icon: Zap, change: data.change.tokens, color: 'text-violet-600', bg: 'bg-violet-50' },
              { label: 'Coût estimé', value: formatCost(data.thisMonth.totalCost), icon: DollarSign, change: data.change.cost, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Requêtes', value: data.thisMonth.totalRequests.toString(), icon: Hash, change: null, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Modèles utilisés', value: data.thisMonth.byModel.length.toString(), icon: Layers, change: null, color: 'text-amber-600', bg: 'bg-amber-50' }
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-[#5C4B40]/10 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${kpi.bg}`}>
                    <kpi.icon size={12} className={kpi.color} />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#5C4B40]/40">{kpi.label}</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-[#5C4B40]">{kpi.value}</span>
                  {kpi.change !== null && (
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 mb-1 ${kpi.change > 0 ? 'text-red-500' : kpi.change < 0 ? 'text-green-500' : 'text-slate-400'}`}>
                      {kpi.change > 0 ? <ArrowUpRight size={10} /> : kpi.change < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                      {Math.abs(kpi.change)}% vs mois dernier
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* View Mode Tabs + Legend */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-white border border-[#5C4B40]/10 rounded-xl p-1">
              {[
                { key: 'tokens' as const, label: 'Tokens', icon: Zap },
                { key: 'cost' as const, label: 'Coût ($)', icon: DollarSign },
                { key: 'requests' as const, label: 'Requêtes', icon: Hash },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setViewMode(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === tab.key ? 'bg-[#5C4B40] text-white' : 'text-[#5C4B40]/40 hover:bg-[#5C4B40]/5'}`}
                >
                  <tab.icon size={10} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Provider Legend */}
            <div className="flex gap-2 flex-wrap">
              {Object.entries(data.thisMonth.byProvider).map(([provider]) => {
                const cfg = PROVIDER_COLORS[provider] || PROVIDER_COLORS.unknown
                return (
                  <div key={provider} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.bar }} />
                    <span className="text-[9px] font-bold text-[#5C4B40]/40">{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bar Chart — horizontal scroll with thin scrollbar */}
          <div
            className="bg-white border border-[#5C4B40]/10 rounded-2xl p-6 overflow-x-auto"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#5C4B4020 transparent'
            }}
          >
            <style>{`
              .usage-chart-scroll::-webkit-scrollbar { height: 4px; }
              .usage-chart-scroll::-webkit-scrollbar-track { background: transparent; }
              .usage-chart-scroll::-webkit-scrollbar-thumb { background: #5C4B4020; border-radius: 4px; }
              .usage-chart-scroll::-webkit-scrollbar-thumb:hover { background: #5C4B4040; }
            `}</style>
            {activeModels.length > 0 ? (
              <div
                className="flex items-end gap-2 usage-chart-scroll"
                style={{
                  height: '280px',
                  minWidth: `${activeModels.length * (barWidth + 8)}px`
                }}
              >
                {activeModels.map((model, i) => {
                  const value = viewMode === 'tokens' ? model.tokens : viewMode === 'cost' ? model.cost : model.requests
                  const barHeight = Math.max((value / maxValue) * 240, 4)
                  const cfg = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.unknown
                  const isHovered = hoveredBar === model.model
                  const isSelected = selectedBar === model.model

                  const sLabel = shortName(model.model)

                  return (
                    <div
                      key={model.model}
                      className="flex-1 flex flex-col items-center justify-end relative"
                      style={{ minWidth: `${barWidth}px`, maxWidth: `${barWidth + 16}px` }}
                      onMouseEnter={() => setHoveredBar(model.model)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >

                      {/* Value Label */}
                      <span className="text-[9px] font-bold text-[#5C4B40]/40 mb-1">
                        {viewMode === 'tokens' ? formatTokens(value) : viewMode === 'cost' ? formatCost(value as number) : value}
                      </span>

                      {/* Bar */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: barHeight }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                        className="w-full rounded-t-lg cursor-pointer transition-all"
                        onClick={() => setSelectedBar(isSelected ? null : model.model)}
                        style={{
                          backgroundColor: cfg.bar,
                          opacity: isHovered || isSelected ? 1 : 0.8,
                          maxWidth: `${barWidth}px`,
                          minWidth: '20px',
                          filter: (isHovered || isSelected) ? 'brightness(1.1)' : 'none',
                          boxShadow: isSelected ? `0 0 0 2px ${cfg.bar}, 0 4px 12px ${cfg.bar}40` : 'none'
                        }}
                      />

                      {/* Logo LLM + Model Name */}
                      <div className="mt-2 w-full flex flex-col items-center gap-1">
                        {/* Override par slug de modèle */}
                        {(() => {
                          const slug = model.model.toLowerCase()
                          // Overrides par modèle
                          if (slug.includes('nano-banana') || slug.includes('nanobanana')) {
                            return <img src="/gemini.png" alt="Gemini" className="w-5 h-5 rounded-md object-contain" title="Gemini (nano-banana)" />
                          }
                          if (slug.includes('imagen')) {
                            return <img src="/logos/Grok-Logo-PNG.png" alt="Grok" className="w-5 h-5 rounded-md object-contain" title="Grok (imagen)" />
                          }
                          // Fallback par provider
                          if (model.provider === 'openai') {
                            return <img src="/gpt 1.png" alt="OpenAI" className="w-5 h-5 rounded-md object-contain" title="OpenAI" />
                          }
                          if (model.provider === 'google') {
                            return <img src="/gemini.png" alt="Google" className="w-5 h-5 rounded-md object-contain" title="Google" />
                          }
                          if (model.provider === 'anthropic') {
                            return <img src="/claude 2.jpg" alt="Anthropic" className="w-5 h-5 rounded-md object-cover" title="Anthropic" />
                          }
                          if (model.provider === 'xai') {
                            return <img src="/logos/Grok-Logo-PNG.png" alt="xAI" className="w-5 h-5 rounded-md object-contain" title="xAI Grok" />
                          }
                          // Badge lettre si pas de logo
                          return (
                            <div
                              className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[8px] font-black"
                              style={{ backgroundColor: cfg.bar }}
                              title={cfg.label}
                            >
                              {model.provider === 'replicate' ? 'R' :
                                model.provider === 'mistral' ? 'M' : '?'}
                            </div>
                          )
                        })()}
                        <p className="text-[9px] font-bold text-[#5C4B40]/70 truncate w-full text-center leading-tight" title={model.label}>
                          {sLabel}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-[#5C4B40]/20 text-xs">
                Aucun modèle avec des données pour ce mode d'affichage
              </div>
            )}
          </div>

          {/* ==================== DETAIL OVERLAY ==================== */}
          <AnimatePresence>
            {selectedBar && (() => {
              const model = activeModels.find(m => m.model === selectedBar)
              if (!model) return null
              const cfg = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.unknown
              const totalTokens = data.thisMonth.totalTokens || 1
              const totalCost = data.thisMonth.totalCost || 1
              const tokensPct = ((model.tokens / totalTokens) * 100).toFixed(1)
              const costPct = ((model.cost / totalCost) * 100).toFixed(1)
              return (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedBar(null)}
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                  />
                  {/* Panel */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-3xl shadow-2xl border border-[#5C4B40]/10 w-[420px] max-w-[90vw] max-h-[85vh] overflow-y-auto"
                  >
                    {/* Header with provider color */}
                    <div className="p-6 pb-4" style={{ background: `linear-gradient(135deg, ${cfg.bar}15, ${cfg.bar}05)` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg"
                            style={{ backgroundColor: cfg.bar }}
                          >
                            {model.provider === 'google' ? 'G' :
                              model.provider === 'openai' ? 'Ai' :
                                model.provider === 'anthropic' ? 'A' :
                                  model.provider === 'xai' ? 'X' :
                                    model.provider === 'replicate' ? 'R' :
                                      model.provider === 'mistral' ? 'M' : '?'}
                          </div>
                          <div>
                            <h3 className="text-base font-black text-[#5C4B40]">{model.label}</h3>
                            <p className="text-[10px] font-bold text-[#5C4B40]/40 uppercase tracking-widest">{cfg.label}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedBar(null)}
                          className="w-8 h-8 rounded-lg bg-[#5C4B40]/5 hover:bg-[#5C4B40]/10 flex items-center justify-center text-[#5C4B40]/40 hover:text-[#5C4B40] transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="px-6 pb-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#F8F6F2] rounded-xl p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#5C4B40]/30 mb-1">Tokens</p>
                          <p className="text-lg font-black text-[#5C4B40]">{formatTokens(model.tokens)}</p>
                          <p className="text-[9px] font-bold text-[#5C4B40]/30">{tokensPct}% du total</p>
                        </div>
                        <div className="bg-[#F8F6F2] rounded-xl p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#5C4B40]/30 mb-1">Coût</p>
                          <p className="text-lg font-black text-[#5C4B40]">{formatCost(model.cost)}</p>
                          <p className="text-[9px] font-bold text-[#5C4B40]/30">{costPct}% du total</p>
                        </div>
                        <div className="bg-[#F8F6F2] rounded-xl p-3 text-center">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-[#5C4B40]/30 mb-1">Requêtes</p>
                          <p className="text-lg font-black text-[#5C4B40]">{model.requests}</p>
                          <p className="text-[9px] font-bold text-[#5C4B40]/30">ce mois</p>
                        </div>
                      </div>
                    </div>

                    {/* Sources */}
                    {Object.keys(model.sources).length > 0 && (
                      <div className="px-6 pb-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#5C4B40]/30 mb-2">Provenance</p>
                        <div className="space-y-2">
                          {Object.entries(model.sources).map(([src, count]) => {
                            const srcPct = ((count as number) / model.requests * 100).toFixed(0)
                            return (
                              <div key={src} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-[10px] font-bold text-[#5C4B40]/60">{SOURCE_LABELS[src] || src}</span>
                                    <span className="text-[10px] font-black text-[#5C4B40]">{count as number} req ({srcPct}%)</span>
                                  </div>
                                  <div className="h-1.5 bg-[#5C4B40]/5 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${srcPct}%`, backgroundColor: cfg.bar }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Trend vs last month */}
                    <div className="px-6 pb-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#5C4B40]/30 mb-2">Évolution</p>
                      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${model.change !== null && model.change > 0 ? 'bg-red-50 text-red-600' : model.change !== null && model.change < 0 ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'
                        }`}>
                        <span className="text-lg">{model.change !== null && model.change > 0 ? '📈' : model.change !== null && model.change < 0 ? '📉' : '➡️'}</span>
                        {model.change !== null ? `${model.change > 0 ? '+' : ''}${model.change}% vs mois précédent` : 'Données insuffisantes'}
                      </div>
                    </div>

                    {/* Last month comparison */}
                    {model.lastMonth && model.lastMonth.tokens > 0 && (
                      <div className="px-6 pb-6">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#5C4B40]/30 mb-2">Mois précédent</p>
                        <div className="flex gap-3 text-[10px]">
                          <span className="px-2 py-1 bg-[#F8F6F2] rounded-lg font-bold text-[#5C4B40]/50">{formatTokens(model.lastMonth.tokens)} tokens</span>
                          <span className="px-2 py-1 bg-[#F8F6F2] rounded-lg font-bold text-[#5C4B40]/50">{formatCost(model.lastMonth.cost)} coût</span>
                          <span className="px-2 py-1 bg-[#F8F6F2] rounded-lg font-bold text-[#5C4B40]/50">{model.lastMonth.requests} req</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </>
              )
            })()}
          </AnimatePresence>

          {/* Provider Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/30 mb-3">Par fournisseur</p>
              <div className="space-y-2.5">
                {Object.entries(data.thisMonth.byProvider)
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .map(([provider, stats]) => {
                    const cfg = PROVIDER_COLORS[provider] || PROVIDER_COLORS.unknown
                    const pct = data.thisMonth.totalTokens > 0 ? (stats.tokens / data.thisMonth.totalTokens) * 100 : 0
                    return (
                      <div key={provider}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.label}</span>
                          <span className="text-[9px] text-[#5C4B40]/40 font-bold">{formatTokens(stats.tokens)} • {formatCost(stats.cost)}</span>
                        </div>
                        <div className="h-1.5 bg-[#F8F6F2] rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full" style={{ backgroundColor: cfg.bar }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/30 mb-3">Par provenance</p>
              <div className="space-y-2.5">
                {Object.entries(data.thisMonth.bySource)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => {
                    const pct = data.thisMonth.totalRequests > 0 ? (count / data.thisMonth.totalRequests) * 100 : 0
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-[#5C4B40]">{SOURCE_LABELS[source] || source}</span>
                          <span className="text-[9px] text-[#5C4B40]/40 font-bold">{count} requêtes • {Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#F8F6F2] rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-[#5C4B40]/30" />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* AI Synthesis Section */}
          <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#5C4B40]/50" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/40">Synthèse IA</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowSynthesisSelector(!showSynthesisSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#F8F6F2] border border-[#5C4B40]/15 rounded-xl text-[10px] font-bold text-[#5C4B40]/70 hover:bg-[#5C4B40]/10 hover:text-[#5C4B40] transition-all"
                  >
                    {/* Capsule colorée par provider pour visibilité du logo */}
                    {(() => {
                      const m = SYNTHESIS_MODELS.find(x => x.slug === synthesisModel)
                      const providerColors: Record<string, string> = {
                        openai: '#10B981', anthropic: '#F59E0B', google: '#3B82F6', xai: '#6366F1'
                      }
                      const bg = providerColors[m?.provider || ''] || '#94A3B8'
                      return (
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: bg + '20', border: `1px solid ${bg}30` }}
                        >
                          <SynthesisModelIcon src={m?.logo || ''} fallback={m?.fallback || '?'} />
                        </span>
                      )
                    })()}
                    <span>{SYNTHESIS_MODELS.find(m => m.slug === synthesisModel)?.label}</span>
                    <ChevronDown size={10} className="text-[#5C4B40]/40" />
                  </button>
                  <AnimatePresence>
                    {showSynthesisSelector && (
                      <motion.div
                        initial={{ opacity: 0, y: -5, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.97 }}
                        className="absolute right-0 top-full mt-1.5 z-[100] bg-white border border-[#5C4B40]/10 rounded-2xl shadow-xl overflow-hidden min-w-[200px]"
                      >
                        <div className="p-1.5 space-y-0.5">
                          {SYNTHESIS_MODELS.map(m => {
                            const providerColors: Record<string, string> = {
                              openai: '#10B981', anthropic: '#F59E0B', google: '#3B82F6', xai: '#6366F1'
                            }
                            const bg = providerColors[m.provider] || '#94A3B8'
                            return (
                              <button
                                key={m.slug}
                                onClick={() => { setSynthesisModel(m.slug); setShowSynthesisSelector(false) }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[11px] transition-all ${synthesisModel === m.slug
                                  ? 'bg-[#5C4B40] text-white font-bold'
                                  : 'text-[#5C4B40]/70 hover:bg-[#5C4B40]/10 hover:text-[#5C4B40]'
                                  }`}
                              >
                                <span
                                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                                  style={{ backgroundColor: synthesisModel === m.slug ? 'rgba(255,255,255,0.2)' : bg + '20' }}
                                >
                                  <SynthesisModelIcon src={m.logo} fallback={m.fallback} />
                                </span>
                                <span>{m.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleSynthesize}
                  disabled={isSynthesizing}
                  className="px-4 py-2 bg-[#5C4B40] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-[#4A3C33] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isSynthesizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-amber-300" />}
                  {isSynthesizing ? 'Analyse...' : 'Synthèse'}
                </button>
              </div>
            </div>

            {hasRealOpenAI && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-green-700">Données OpenAI temps réel via votre clé API</span>
              </div>
            )}

            <AnimatePresence>
              {synthesis && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-[#F8F6F2] rounded-xl p-4 prose prose-sm max-w-none">
                    <div className="text-xs text-[#5C4B40] leading-relaxed whitespace-pre-wrap">{synthesis}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )
      }
    </div>
  )
}
