'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Globe, Code, Search, Loader2, ExternalLink, CheckCircle2, Circle } from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'

interface ResearchProgressPanelProps {
  runId: string
  supabase: SupabaseClient
}

export function ResearchProgressPanel({ runId, supabase }: ResearchProgressPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [run, setRun] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])

  useEffect(() => {
    // Initial fetch
    fetchProgress()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`research_run_${runId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'research_runs',
          filter: `id=eq.${runId}`
        },
        (payload) => {
          console.log('📡 Research run updated:', payload.new)
          setRun(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'research_sources',
          filter: `run_id=eq.${runId}`
        },
        (payload) => {
          console.log('📡 New source added:', payload.new)
          setSources((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [runId, supabase])

  const fetchProgress = async () => {
    try {
      const { data: runData } = await supabase
        .from('research_runs')
        .select('*')
        .eq('id', runId)
        .single()

      if (runData) setRun(runData)

      const { data: sourcesData } = await supabase
        .from('research_sources')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true })

      if (sourcesData) setSources(sourcesData)
    } catch (err) {
      console.error('Error fetching progress:', err)
    }
  }

  const getStageIcon = (stage: string) => {
    const icons: Record<string, any> = {
      framing: Circle,
      planning: Circle,
      collecting: Globe,
      synthesizing: Code,
      completed: CheckCircle2,
      failed: Circle
    }
    return icons[stage] || Circle
  }

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      framing: 'Cadrage',
      planning: 'Planification',
      collecting: 'Collecte',
      synthesizing: 'Synthèse',
      completed: 'Terminé',
      failed: 'Échec'
    }
    return labels[stage] || stage
  }

  const isStageActive = (stageName: string) => {
    return run?.progress_stage === stageName
  }

  const isStageCompleted = (stageName: string) => {
    const stageOrder = ['framing', 'planning', 'collecting', 'synthesizing', 'completed']
    const currentIndex = stageOrder.indexOf(run?.progress_stage || '')
    const thisIndex = stageOrder.indexOf(stageName)
    return currentIndex > thisIndex
  }

  if (!run) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#5C4B40]/60">
        <Loader2 size={16} className="animate-spin" />
        <span>Chargement...</span>
      </div>
    )
  }

  return (
    <div className="w-full bg-white/50 backdrop-blur-sm border border-[#5C4B40]/10 rounded-2xl overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#5C4B40]/10 flex items-center justify-center">
            {run.status === 'running' ? (
              <Loader2 size={16} className="animate-spin text-[#5C4B40]" />
            ) : run.status === 'completed' ? (
              <CheckCircle2 size={16} className="text-green-600" />
            ) : (
              <Search size={16} className="text-[#5C4B40]" />
            )}
          </div>
          <div className="text-left">
            <div className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60">
              Analyse de la recherche
            </div>
            <div className="text-xs font-bold text-[#5C4B40] mt-0.5">
              {run.progress_message || 'Recherche en cours...'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-black text-[#5C4B40]">{run.progress_percent || 0}%</div>
            <div className="text-[9px] font-bold text-[#5C4B40]/40 uppercase tracking-wider">
              {sources.length} sources
            </div>
          </div>
          {expanded ? <ChevronUp size={18} className="text-[#5C4B40]/40" /> : <ChevronDown size={18} className="text-[#5C4B40]/40" />}
        </div>
      </button>

      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-[#5C4B40]/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#5C4B40] to-[#d4a574]"
            initial={{ width: 0 }}
            animate={{ width: `${run.progress_percent || 0}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-[#5C4B40]/10 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Stages Timeline */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 mb-3">
                  Progression
                </h4>
                <div className="space-y-2">
                  {['framing', 'planning', 'collecting', 'synthesizing'].map((stageName) => {
                    const StageIcon = getStageIcon(stageName)
                    const isActive = isStageActive(stageName)
                    const isCompleted = isStageCompleted(stageName)

                    return (
                      <div
                        key={stageName}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          isActive
                            ? 'bg-[#5C4B40]/10 border border-[#5C4B40]/20'
                            : isCompleted
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-white/50 border border-[#5C4B40]/5'
                        }`}
                      >
                        <StageIcon
                          size={16}
                          className={
                            isActive
                              ? 'text-[#5C4B40] animate-pulse'
                              : isCompleted
                              ? 'text-green-600'
                              : 'text-[#5C4B40]/30'
                          }
                        />
                        <span
                          className={`text-xs font-bold ${
                            isActive ? 'text-[#5C4B40]' : isCompleted ? 'text-green-700' : 'text-[#5C4B40]/40'
                          }`}
                        >
                          {getStageLabel(stageName)}
                        </span>
                        {isActive && (
                          <Loader2 size={14} className="ml-auto animate-spin text-[#5C4B40]" />
                        )}
                        {isCompleted && (
                          <CheckCircle2 size={14} className="ml-auto text-green-600" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Sources Collected */}
              {sources.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 mb-3">
                    Sites visités ({sources.length})
                  </h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                    {sources.map((source, idx) => (
                      <motion.a
                        key={source.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/70 hover:bg-white border border-[#5C4B40]/5 hover:border-[#5C4B40]/20 transition-all group"
                      >
                        <Globe size={14} className="text-[#5C4B40]/40 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-[#5C4B40] truncate group-hover:text-[#d4a574] transition-colors">
                            {source.title}
                          </div>
                          <div className="text-[10px] text-[#5C4B40]/40 truncate">{source.url}</div>
                          {source.snippet && (
                            <div className="text-[10px] text-[#5C4B40]/60 mt-1 line-clamp-2">
                              {source.snippet}
                            </div>
                          )}
                        </div>
                        <ExternalLink size={12} className="text-[#5C4B40]/30 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
