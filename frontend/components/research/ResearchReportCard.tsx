'use client'

import React, { useState, useEffect } from 'react'
import { Search, FileText, ChevronDown, ChevronUp, Download, Copy, FileCode, Check, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { SupabaseClient } from '@supabase/supabase-js'
import { ResearchProgressPanel } from './ResearchProgressPanel'

interface ResearchReportCardProps {
  metadata: any
  supabase: SupabaseClient
  onOpenPanel?: (id: string) => void
}

export function ResearchReportCard({ metadata, supabase, onOpenPanel }: ResearchReportCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCopied, setIsCopied] = useState(false)

  const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata

  useEffect(() => {
    async function fetchData() {
      if (!meta?.research_run_id) return

      try {
        const { data: runData } = await supabase
          .from('research_runs')
          .select('report_markdown, query, report_title, created_at, progress_stage, status')
          .eq('id', meta.research_run_id)
          .single()

        if (runData) setReport(runData)

        const { data: sourcesData } = await supabase
          .from('research_sources')
          .select('title, url')
          .eq('run_id', meta.research_run_id)

        if (sourcesData) setSources(sourcesData)
      } catch (err) {
        console.error('Error fetching research data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Subscribe to real-time updates for status changes
    const channel = supabase
      .channel(`research_run_${meta.research_run_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'research_runs',
          filter: `id=eq.${meta.research_run_id}`
        },
        (payload) => {
          console.log('📡 Research run updated:', payload.new)
          setReport(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [meta?.research_run_id, supabase])

  const handleCopy = () => {
    if (!report?.report_markdown) return
    navigator.clipboard.writeText(report.report_markdown)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const downloadPDF = () => {
    if (!report?.report_markdown) return;

    // Create a new window for printing to ensure a clean state
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Veuillez autoriser les fenêtres surgissantes pour exporter le PDF.");
      return;
    }

    // Prepare Content
    const title = report.report_title || report.query || 'Rapport de Recherche';
    const dateStr = new Date().toLocaleDateString('fr-FR');

    // Simple MD to HTML conversion for print
    const markdownContent = report.report_markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    const sourcesHtml = `
      <div style="margin-top: 40pt; border-top: 1px solid #5C4B40; padding-top: 20pt;">
        <h2 style="font-size: 16pt; color: #800000; font-family: sans-serif; text-transform: uppercase; letter-spacing: 1px;">Sources consultées</h2>
        <ul style="list-style: none; padding: 0;">
          ${sources.map((s, i) => `
            <li style="margin-bottom: 8pt; font-size: 10pt; color: #5C4B40;">
              <strong style="color: #800000;">${i + 1}.</strong> ${s.title} 
              <br/><span style="font-size: 9pt; color: #888;">${s.url}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { 
              font-family: 'Times New Roman', serif; 
              line-height: 1.6; 
              color: #333; 
              max-width: 800px; 
              margin: 40px auto; 
              padding: 20px;
              background-color: white;
            }
            h1 { color: #800000; font-family: sans-serif; border-bottom: 2px solid #800000; padding-bottom: 10px; margin-top: 0; }
            h2 { color: #800000; font-family: sans-serif; margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            h3 { color: #5C4B40; font-family: sans-serif; margin-top: 20px; }
            p { margin-bottom: 15px; text-align: justify; }
            blockquote { 
              border-left: 4px solid #e8ddd0; 
              padding: 10px 20px; 
              background: #faf6f0; 
              font-style: italic; 
              margin: 20px 0;
            }
            li { margin-bottom: 8px; }
            .date { color: #888; font-size: 0.9em; margin-bottom: 30px; }
            @media print {
              body { margin: 0; padding: 0; max-width: 100%; }
              @page { margin: 2cm; }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="date">Généré le ${dateStr} par Jungle Studio</div>
          <div><p>${markdownContent}</p></div>
          ${sourcesHtml}
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const downloadWord = () => {
    if (!report?.report_markdown) return
    const blob = new Blob([report.report_markdown], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Rapport-${report.report_title || 'recherche'}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="animate-pulse bg-[#faf6f0] border border-[#e8ddd0] rounded-3xl p-6 w-full max-w-2xl">
        <div className="h-4 bg-[#800000]/10 rounded w-1/4 mb-4"></div>
        <div className="h-6 bg-[#800000]/10 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-[#800000]/10 rounded w-1/2"></div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl bg-[#faf6f0] border border-[#e8ddd0] rounded-3xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md">
      {/* Header — Always Visible */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#800000]/10 flex items-center justify-center text-[#800000]">
              <Search size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#5C4B40]/60">Recherche Approfondie</h3>
              <p className="text-base font-bold text-[#5C4B40] mt-0.5 line-clamp-1">
                "{report?.query || meta?.query || 'Analyse en cours...'}"
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenPanel?.(meta.research_run_id)}
            className="p-2.5 rounded-xl bg-white border border-[#e8ddd0] text-[#5C4B40]/40 hover:text-[#800000] hover:border-[#800000]/20 hover:shadow-sm transition-all group"
            title="Ouvrir en plein écran"
          >
            <ExternalLink size={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* Progress Panel - Only show while research is running */}
        {report?.status !== 'completed' && report?.status !== 'failed' && meta?.research_run_id && (
          <div className="mt-4">
            <ResearchProgressPanel runId={meta.research_run_id} supabase={supabase} />
          </div>
        )}

        {/* Stats - Only show when completed */}
        {report?.status === 'completed' && (
          <div className="mt-4 flex items-center gap-4 text-xs font-bold text-[#5C4B40]/40 uppercase tracking-tight">
            <span className="flex items-center gap-1.5">
              <FileText size={14} /> Rapport complet
            </span>
            <span className="flex items-center gap-1.5 text-[#800000]">
              <FileCode size={14} /> {sources.length} Sources
            </span>
          </div>
        )}

        {/* Action Buttons - Only show when completed */}
        {report?.status === 'completed' && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 px-6 py-3 bg-[#5C4B40] text-white rounded-full text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#3d322b] transition-all hover:shadow-lg hover:shadow-[#5C4B40]/20 active:scale-95"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Réduire le rapport' : 'Voir le rapport'}
          </button>

          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-[#800000]/10 text-[#5C4B40] rounded-full text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#800000]/5 hover:border-[#800000]/30 transition-all active:scale-95"
          >
            <Download size={14} className="text-[#800000]" /> PDF
          </button>

          <button
            onClick={downloadWord}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-[#800000]/10 text-[#5C4B40] rounded-full text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#800000]/5 hover:border-[#800000]/30 transition-all active:scale-95"
          >
            <FileText size={14} className="text-[#800000]" /> Word
          </button>

          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-5 py-3 bg-white border ${isCopied ? 'border-green-500/40 bg-green-50/30' : 'border-[#800000]/10'} text-[#5C4B40] rounded-full text-[10px] font-black uppercase tracking-[0.15em] hover:bg-[#800000]/5 hover:border-[#800000]/30 transition-all active:scale-95`}
          >
            {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-[#800000]" />}
            {isCopied ? 'Copié !' : 'Copier'}
          </button>
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {
        expanded && report?.report_markdown && (
          <div className="px-6 pb-8 border-t border-[#e8ddd0] animate-in slide-in-from-top-4 duration-500">
            <div className="prose prose-sm max-w-none pt-6 text-[#5C4B40]/80">
              <ReactMarkdown>
                {report.report_markdown}
              </ReactMarkdown>
            </div>

            {/* Sources Section */}
            <div className="mt-8 pt-6 border-t border-[#e8ddd0]">
              <h4 className="text-sm font-black uppercase tracking-widest text-[#800000] mb-4">Sources consultées</h4>
              <div className="grid gap-2">
                {sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-medium text-[#5C4B40]/70 hover:text-[#800000] transition-colors group"
                  >
                    <span className="w-5 h-5 flex-shrink-0 rounded-md bg-white border border-[#e8ddd0] flex items-center justify-center text-[10px] group-hover:border-[#800000]/20">
                      {idx + 1}
                    </span>
                    <span className="truncate underline underline-offset-2">{source.title}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}
