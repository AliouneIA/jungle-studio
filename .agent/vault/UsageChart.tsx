'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus,
  Zap, DollarSign, Hash, ArrowUpRight, ArrowDownRight, Layers
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

export default function UsageChart() {
  const supabase = createClient()
  const [data, setData] = useState<UsageData | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'tokens' | 'cost' | 'requests'>('tokens')
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)

  const analyze = useCallback(async () => {
    setIsAnalyzing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Step 1: Analyze (scan all tables, build usage_logs)
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      // Step 2: Get stats
      setIsLoading(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/usage-stats?action=stats`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const result = await res.json()
      if (result.thisMonth) setData(result)
    } catch (err) {
      console.error('[UsageChart] Error:', err)
    } finally {
      setIsAnalyzing(false)
      setIsLoading(false)
    }
  }, [supabase])

  const maxValue = data ? Math.max(
    ...data.thisMonth.byModel.map(m =>
      viewMode === 'tokens' ? m.tokens :
      viewMode === 'cost' ? m.cost :
      m.requests
    ), 1
  ) : 1

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
          {isAnalyzing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {isAnalyzing ? 'Analyse en cours...' : 'Analyser'}
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

      {/* Dashboard */}
      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              {
                label: 'Tokens ce mois',
                value: formatTokens(data.thisMonth.totalTokens),
                icon: Zap,
                change: data.change.tokens,
                color: 'text-violet-600',
                bg: 'bg-violet-50'
              },
              {
                label: 'Coût estimé',
                value: formatCost(data.thisMonth.totalCost),
                icon: DollarSign,
                change: data.change.cost,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50'
              },
              {
                label: 'Requêtes',
                value: data.thisMonth.totalRequests.toString(),
                icon: Hash,
                change: null,
                color: 'text-blue-600',
                bg: 'bg-blue-50'
              },
              {
                label: 'Modèles utilisés',
                value: data.thisMonth.byModel.length.toString(),
                icon: Layers,
                change: null,
                color: 'text-amber-600',
                bg: 'bg-amber-50'
              }
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

          {/* View Mode Tabs */}
          <div className="flex items-center justify-between">
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
            <div className="flex gap-2">
              {Object.entries(data.thisMonth.byProvider).map(([provider, stats]) => {
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

          {/* Bar Chart */}
          <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-6">
            <div className="flex items-end gap-3" style={{ height: '280px' }}>
              {data.thisMonth.byModel.map((model, i) => {
                const value = viewMode === 'tokens' ? model.tokens : viewMode === 'cost' ? model.cost : model.requests
                const barHeight = Math.max((value / maxValue) * 240, 4)
                const cfg = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.unknown
                const isHovered = hoveredBar === model.model

                return (
                  <div
                    key={model.model}
                    className="flex-1 flex flex-col items-center justify-end relative"
                    onMouseEnter={() => setHoveredBar(model.model)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute bottom-full mb-2 z-20 bg-[#5C4B40] text-white rounded-xl p-3 shadow-xl min-w-[180px]"
                          style={{ left: '50%', transform: 'translateX(-50%)' }}
                        >
                          <p className="font-bold text-xs mb-2">{model.label}</p>
                          <div className="space-y-1.5 text-[10px]">
                            <div className="flex justify-between">
                              <span className="opacity-60">Tokens</span>
                              <span className="font-bold">{formatTokens(model.tokens)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-60">Coût</span>
                              <span className="font-bold">{formatCost(model.cost)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-60">Requêtes</span>
                              <span className="font-bold">{model.requests}</span>
                            </div>
                            {model.change !== null && (
                              <div className="flex justify-between">
                                <span className="opacity-60">vs mois dernier</span>
                                <span className={`font-bold ${model.change > 0 ? 'text-red-300' : model.change < 0 ? 'text-green-300' : ''}`}>
                                  {model.change > 0 ? '+' : ''}{model.change}%
                                </span>
                              </div>
                            )}
                            {Object.keys(model.sources).length > 0 && (
                              <>
                                <div className="border-t border-white/10 pt-1.5 mt-1.5">
                                  <span className="opacity-40 text-[9px] uppercase tracking-widest">Provenance</span>
                                </div>
                                {Object.entries(model.sources).map(([src, count]) => (
                                  <div key={src} className="flex justify-between">
                                    <span className="opacity-60">{SOURCE_LABELS[src] || src}</span>
                                    <span className="font-bold">{count}</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                          {/* Arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-[#5C4B40]" />
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                      style={{
                        backgroundColor: cfg.bar,
                        opacity: isHovered ? 1 : 0.8,
                        maxWidth: '52px',
                        minWidth: '20px',
                        filter: isHovered ? 'brightness(1.1)' : 'none'
                      }}
                    />

                    {/* Model Name */}
                    <div className="mt-2 w-full text-center">
                      <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/50 truncate px-0.5" title={model.label}>
                        {model.label.replace('Claude ', '').replace('Gemini ', 'Gem ').replace('GPT-', '')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Provider Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {/* By Provider */}
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
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: cfg.bar }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* By Source */}
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
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }}
                            className="h-full rounded-full bg-[#5C4B40]/30"
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
