// cspell:disable
'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Loader2, FileText, Globe, CheckCircle2, ChevronRight, ExternalLink, X, List, Quote, Hash, Layout, Copy } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface DeepResearchPanelProps {
  runId: string
  onClose: () => void
  onSendToCanvas?: (content: string, title: string) => void
}

/**
 * Utility function to convert simplified Markdown to a custom styled HTML structure
 * without using external libraries like ReactMarkdown, ensuring alignment with 
 * the site's design language.
 */
function renderMarkdownToCustomHTML(markdown: string) {
  if (!markdown) return null;

  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];

  let keyIdx = 0;
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList) {
      elements.push(
        <ul key={`list-${keyIdx++}`} className="space-y-3 my-6 pl-4 border-l-2 border-amber-500/20">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
      flushList();
      continue;
    }

    // Headlines
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={keyIdx++} className="text-xl font-black text-[#5C4B40] tracking-tight mt-10 mb-4 flex items-center gap-2">
          <div className="w-1.5 h-6 bg-amber-500/40 rounded-full" />
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={keyIdx++} className="text-3xl font-black text-[#5C4B40] tracking-tighter mt-12 mb-6 pb-2 border-b border-secondary/10">
          {line.replace('## ', '')}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={keyIdx++} className="text-4xl font-black text-[#5C4B40] tracking-tighter mt-4 mb-8">
          {line.replace('# ', '')}
        </h1>
      );
    }
    // Lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(
        <li key={`li-${keyIdx++}`} className="flex gap-3 text-sm text-[#504138] leading-relaxed">
          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
          <span>{line.substring(2)}</span>
        </li>
      );
    }
    // Blockquotes
    else if (line.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={keyIdx++} className="bg-amber-50/30 border-l-4 border-amber-500/50 p-6 my-8 rounded-r-2xl italic text-secondary text-sm leading-relaxed quote-mask">
          <Quote className="text-amber-500/20 mb-2" size={24} />
          {line.replace('> ', '')}
        </blockquote>
      );
    }
    // Bold / Strong text parsing (simple)
    else {
      flushList();
      const content = line.split(/(\*\*.*?\*\*)/g).map((part, pidx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pidx} className="font-extrabold text-[#5C4B40] uppercase tracking-tighter text-[13px]">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      elements.push(
        <p key={keyIdx++} className="text-sm text-[#504138] leading-[1.8] mb-6 font-medium font-avenir">
          {content}
        </p>
      );
    }
  }

  flushList();
  return elements;
}

// Fix Bug 3: Safe hostname extraction that never throws
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'Source'
  }
}

export default function DeepResearchPanel({ runId, onClose, onSendToCanvas }: DeepResearchPanelProps) {
  const [run, setRun] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const supabase = createClient()

  const handleCopy = () => {
    if (!run?.report_markdown) return
    navigator.clipboard.writeText(run.report_markdown)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  useEffect(() => {
    console.log('🔬 DeepResearchPanel mounted, run_id:', runId)

    const fetchInitialData = async () => {
      // Fix Bug 1: Add user_id filter
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: runData } = await supabase
        .from('research_runs')
        .select('*')
        .eq('id', runId)
        .eq('user_id', user.id) // Fix Bug 1
        .single()

      if (runData) {
        setRun(runData)
        console.log('📦 Initial run data:', runData)
      }

      // Sources scoped via run_id (which is already user-verified above)
      const { data: sourcesData } = await supabase.from('research_sources').select('*').eq('run_id', runId)
      if (sourcesData) setSources(sourcesData)

      setLoading(false)
    }

    fetchInitialData()

    // Realtime subscription for run updates
    const runSub = supabase
      .channel(`research-run-${runId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'research_runs',
        filter: `id=eq.${runId}`
      }, (payload) => {
        console.log('📡 Realtime UPDATE received:', payload.new)
        setRun(payload.new)
      })
      .subscribe()

    // Realtime subscription for new sources
    const sourcesSub = supabase
      .channel(`research-sources-${runId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'research_sources',
        filter: `run_id=eq.${runId}`
      }, (payload) => {
        console.log('📡 Realtime NEW SOURCE received:', payload.new)
        setSources(prev => {
          if (prev.some(s => s.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()

    // Fix Bug 2: Polling with user_id filter
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: runData } = await supabase
        .from('research_runs')
        .select('*')
        .eq('id', runId)
        .eq('user_id', user.id) // Fix Bug 2
        .single()

      if (runData) {
        setRun(runData)
      }

      const { data: sourcesData } = await supabase.from('research_sources')
        .select('*').eq('run_id', runId)

      if (sourcesData) {
        setSources(sourcesData)
      }

      if (runData?.status === 'completed' || runData?.status === 'failed') {
        clearInterval(interval)
      }
    }, 3000)

    return () => {
      supabase.removeChannel(runSub)
      supabase.removeChannel(sourcesSub)
      clearInterval(interval)
    }
  }, [runId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="text-green-500" size={20} />
      case 'failed': return <X className="text-red-500" size={20} />
      default: return <Loader2 className="text-amber-500 animate-spin" size={20} />
    }
  }

  if (loading && !run) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[100] bg-[#F7F3F0] flex flex-col overflow-hidden"
    >
      {/* Header Premium */}
      <div className="px-12 py-8 flex items-center justify-between border-b border-[#5C4B40]/10 bg-white/40 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[2rem] bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-xl shadow-amber-500/5 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Search size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[#5C4B40] tracking-tighter leading-none">{run?.query}</h2>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-[#5C4B40]/5 shadow-sm">
                {getStatusIcon(run?.status)}
                <span className="text-[10px] font-black text-[#5C4B40]/60 uppercase tracking-widest">{run?.progress_message || 'Initialisation...'}</span>
              </div>
              {run?.status !== 'completed' && run?.status !== 'failed' && (
                <div className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black shadow-lg shadow-amber-500/20">
                  {run?.progress_percent || 0}%
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="group w-14 h-14 bg-white hover:bg-[#5C4B40] border border-[#5C4B40]/10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm hover:shadow-xl group"
        >
          <X size={24} className="text-[#5C4B40] group-hover:text-white transition-colors" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area: Rapport Stylisé */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-premium bg-white relative">
          {run?.status === 'completed' && run?.report_markdown && (
            <div className="sticky top-0 right-0 p-8 z-20 pointer-events-none flex justify-end gap-3">
              <button
                onClick={handleCopy}
                className={`pointer-events-auto flex items-center gap-2 px-6 py-3 border border-[#5C4B40]/10 text-[11px] font-black uppercase tracking-tighter rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all shadow-[#5C4B40]/5 ${isCopied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-[#5C4B40] hover:bg-[#F7F3F0]'
                  }`}
              >
                {isCopied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                <span>{isCopied ? 'Copié !' : 'Copier'}</span>
              </button>

              <button
                onClick={() => onSendToCanvas?.(run.report_markdown, `Rapport : ${run.query}`)}
                className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-[#5C4B40] text-white text-[11px] font-black uppercase tracking-tighter rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-[#5C4B40]/20"
              >
                <Layout size={14} />
                <span>Envoyer vers Canevas</span>
              </button>
            </div>
          )}

          {run?.status === 'completed' && run?.report_markdown ? (
            <div className="max-w-4xl mx-auto pb-20 px-16 -mt-10">
              <div className="font-avenir text-[#5C4B40]">
                {renderMarkdownToCustomHTML(run.report_markdown)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-20">
              <div className="relative mb-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 border-2 border-[#5C4B40]/5 border-t-amber-500 rounded-[3rem]"
                />
                <div className="absolute inset-0 flex items-center justify-center text-amber-500">
                  <Globe size={40} className="animate-pulse" />
                </div>
              </div>
              <h3 className="text-3xl font-black text-[#5C4B40] tracking-tighter mb-4">{run?.progress_message || 'Intelligence en marche...'}</h3>
              <p className="text-sm text-[#5C4B40]/60 max-w-md font-medium leading-relaxed">
                Nos algorithmes explorent le web profond pour agréger et synthétiser les données les plus pertinentes.
              </p>

              {/* Steps Progress Mini-Map Premium */}
              <div className="flex gap-4 mt-16 p-2 bg-[#F7F3F0] rounded-3xl border border-[#5C4B40]/5">
                {['framing', 'planning', 'collecting', 'synthesizing'].map((step, i) => {
                  const active = run?.progress_stage === step
                  const stepsOrder = ['framing', 'planning', 'collecting', 'synthesizing', 'completed']
                  const currentStepIdx = stepsOrder.indexOf(run?.progress_stage || 'framing')

                  return (
                    <div key={step} className="flex flex-col items-center gap-3 w-28 py-4 px-2 rounded-2xl transition-all duration-500" style={{ background: active ? 'white' : 'transparent', boxShadow: active ? '0 10px 30px rgba(0,0,0,0.05)' : 'none' }}>
                      <div className={`h-1.5 w-12 rounded-full transition-all duration-700 ${i <= currentStepIdx ? 'bg-amber-500' : 'bg-[#5C4B40]/10'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-amber-600' : 'text-[#5C4B40]/30'}`}>{step}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Sources Premium */}
        <div className="w-[400px] bg-[#F7F3F0] border-l border-[#5C4B40]/10 flex flex-col overflow-hidden">
          <div className="px-8 py-8 border-b border-[#5C4B40]/5">
            <h3 className="text-sm font-black text-[#5C4B40] uppercase tracking-[0.2em] flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sources Identifiées ({sources.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar-premium">
            {sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-20">
                <Globe size={40} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Veille active...</p>
              </div>
            ) : (
              sources.map((source, i) => (
                <motion.a
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={source.id || i}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-5 bg-white rounded-3xl border border-transparent hover:border-amber-500/20 hover:shadow-2xl transition-all duration-500 active:scale-95"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-xl bg-[#F7F3F0] group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center text-[#5C4B40]/40 font-black text-xs transition-colors duration-500">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-black text-[#5C4B40] truncate group-hover:text-amber-600 transition-colors uppercase tracking-tight">{source.title}</h4>
                      <p className="text-[10px] font-bold text-[#5C4B40]/40 truncate flex items-center gap-2 mt-1">
                        {/* Fix Bug 3: Safe hostname extraction */}
                        {source.url ? safeHostname(source.url) : 'Source'} <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                    </div>
                  </div>
                  {source.snippet && (
                    <p className="text-[11px] text-[#5C4B40]/60 mt-4 line-clamp-2 leading-relaxed font-medium">
                      {source.snippet}
                    </p>
                  )}
                </motion.a>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
