import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface ManusResultProps {
  data: {
    content: string;
    structured?: {
      final_answer: string;
      execution_summary: {
        plan: string;
        thought_process_log: string[];
        tool_calls_log: {
          tool: string;
          query: string;
          result_summary: string;
        }[];
      };
    } | null;
  }
}

const ManusResult = ({ data }: ManusResultProps) => {
  const [showLog, setShowLog] = useState(false)

  const structured = data.structured
  const finalAnswer = structured?.final_answer || data.content

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Réponse finale */}
      <div className="prose prose-sm max-w-none font-[Avenir] text-[#1a1a1a] prose-headings:font-[Avenir] prose-headings:text-[#1a1a1a] prose-strong:text-[#1a1a1a] prose-li:text-[#1a1a1a] prose-p:text-[#1a1a1a]">
        <ReactMarkdown>{finalAnswer}</ReactMarkdown>
      </div>

      {/* Bouton Journal de bord */}
      {structured?.execution_summary && (
        <div className="mt-2">
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#d4a574] hover:text-[#e5b685] transition-colors bg-[#d4a574]/10 px-3 py-1.5 rounded-lg border border-[#d4a574]/20"
          >
            {showLog ? '▼ Masquer' : '▶ Voir'} le journal de bord Manus
          </button>

          {showLog && (
            <div className="mt-3 bg-black/40 backdrop-blur-md rounded-xl p-5 border border-white/5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Plan */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#d4a574]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4a574]" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">📋 Plan d'action</h4>
                </div>
                <div className="pl-3.5 prose prose-invert prose-xs">
                  <ReactMarkdown>{structured.execution_summary.plan}</ReactMarkdown>
                </div>
              </div>

              {/* Pensées */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#d4a574]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4a574]" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">💭 Réflexions</h4>
                </div>
                <div className="pl-3.5 space-y-1.5">
                  {structured.execution_summary.thought_process_log?.map((t: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs text-gray-300">
                      <span className="text-[#d4a574]">→</span>
                      <p>{t}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outils */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#d4a574]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#d4a574]" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">🔧 Outils utilisés</h4>
                </div>
                <div className="pl-3.5 space-y-2">
                  {structured.execution_summary.tool_calls_log?.map((t: any, i: number) => (
                    <div key={i} className="bg-white/5 rounded-lg p-2.5 border border-white/5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#d4a574]/20 text-[#d4a574] uppercase tracking-tighter">
                          {t.tool}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono truncate">{t.query}</span>
                      </div>
                      <p className="text-xs text-gray-300 pl-1 border-l border-white/10 mt-1 italic">
                        {t.result_summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ManusResult
