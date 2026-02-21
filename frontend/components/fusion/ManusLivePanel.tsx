'use client'

import React from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ManusStep {
  id: string
  task_id: string
  progress_type: string
  message: string
  received_at: string
}

interface ManusLivePanelProps {
  taskUrl: string
  statusText: string
  steps?: ManusStep[]
}

export default function ManusLivePanel({ taskUrl, statusText, steps = [] }: ManusLivePanelProps) {
  const handleOpenLive = () => {
    window.open(taskUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-4 w-full bg-white/40 backdrop-blur-xl rounded-2xl p-5 border border-[#5C4B40]/10 shadow-2xl shadow-[#5C4B40]/5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EAE1D3] to-[#EAE1D3]/50 flex items-center justify-center border border-[#5C4B40]/10 shadow-inner">
              <img
                src="/Manus1.png"
                alt="Manus"
                className="w-8 h-8 object-contain drop-shadow-md"
              />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 p-1 bg-white rounded-full shadow-sm border border-[#5C4B40]/10">
              <Loader2 className="text-[#5C4B40] animate-spin" size={14} />
            </div>
          </div>
          <div className="flex flex-col">
            <h4 className="text-[10px] font-black text-[#5C4B40] uppercase tracking-[0.2em] mb-1">Mission Agent Manus</h4>
            <p className="text-sm text-[#5C4B40]/60 font-medium leading-relaxed italic">
              {statusText || 'Initialisation de la mission...'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!taskUrl}
          onClick={handleOpenLive}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group ${!taskUrl
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
            : 'bg-[#5C4B40] hover:bg-[#4A392F] text-white shadow-[#5C4B40]/20 border border-[#4A392F]'
            }`}
        >
          {taskUrl ? <ExternalLink size={14} className="group-hover:scale-110 transition-transform" /> : <Loader2 size={14} className="animate-spin" />}
          <span>{taskUrl ? 'Vue Live' : 'Recherche URL...'}</span>
        </button>
      </div>

      {steps.length > 0 && (
        <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-[#5C4B40]/5 max-h-[160px] overflow-y-auto custom-scrollbar">
          <AnimatePresence initial={false}>
            {steps.map((step, idx) => {
              const isLast = idx === steps.length - 1
              return (
                <motion.div
                  key={step.id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2.5 group"
                >
                  <span className={`text-[10px] mt-0.5 ${isLast ? 'animate-pulse' : ''}`}>
                    {isLast ? '⏳' : '✅'}
                  </span>
                  <p className={`text-[11px] font-medium leading-relaxed ${isLast ? 'text-[#5C4B40]' : 'text-[#5C4B40]/50'}`}>
                    {step.message}
                  </p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
