'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  X,
  ExternalLink,
  Download,
  FileText,
  Trash2,
  Presentation,
  CheckCircle2,
  Calendar,
  Layers,
  Globe,
  Monitor,
  MessagesSquare
} from 'lucide-react'
import { PresentationData } from './PresentationsLayout'

interface PresentationDetailPanelProps {
  presentation: PresentationData
  onClose: () => void
  onDelete: () => void
  onOpenConversation: () => void
}

export default function PresentationDetailPanel({ presentation, onClose, onDelete, onOpenConversation }: PresentationDetailPanelProps) {
  const isGamma = presentation.provider === 'gamma'

  const getGammaEmbedUrl = (gammaUrl: string): string => {
    if (!gammaUrl) return ''
    return gammaUrl.replace('/docs/', '/embed/')
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 w-full max-w-[550px] h-full bg-[#faf6f0] shadow-[-50px_0_100px_rgba(0,0,0,0.1)] z-[100] flex flex-col"
    >
      {/* Header */}
      <div className="p-8 border-b border-[#5C4B40]/10 flex items-center justify-between shrink-0">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40">Détails Projet</span>
          <h2 className="text-xl font-black text-[#5C4B40] uppercase tracking-tighter truncate max-w-[350px]">
            {presentation.title || 'Sans titre'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-3 hover:bg-[#5C4B40]/5 rounded-2xl text-[#5C4B40]/40 hover:text-[#5C4B40] transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
        {/* Gamma Embed Preview */}
        {isGamma && presentation.gamma_url ? (
          <div className="aspect-[16/9] bg-white rounded-[32px] overflow-hidden border border-[#5C4B40]/10 shadow-2xl relative shadow-[#5C4B40]/5 group">
            <iframe
              src={getGammaEmbedUrl(presentation.gamma_url)}
              className="w-full h-full border-none"
              allowFullScreen
              title={presentation.title}
            />
          </div>
        ) : (
          <div className="aspect-[16/10] bg-white rounded-[32px] overflow-hidden border border-[#5C4B40]/10 shadow-2xl relative shadow-[#5C4B40]/5">
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#EAE1D3]/30 to-[#F8F6F2]/30 p-12 text-center">
              <Presentation size={64} className="text-[#5C4B40]/20 mb-6" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] max-w-[200px] leading-relaxed opacity-40">
                Aperçu Gemini généré avec succès
              </p>
            </div>
          </div>
        )}

        {/* Prompt */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a574]" /> Instruction IA
          </h4>
          <div className="p-6 bg-white border border-[#5C4B40]/5 rounded-[28px] italic font-serif text-sm leading-relaxed text-[#5C4B40]/90">
            "{presentation.prompt}"
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
            <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Moteur</p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isGamma ? 'bg-purple-500' : 'bg-blue-500'}`} />
              <p className="text-[10px] font-bold text-[#5C4B40] uppercase">{presentation.provider}</p>
            </div>
          </div>
          <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
            <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Date</p>
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-[#5C4B40]/40" />
              <p className="text-[10px] font-bold text-[#5C4B40]">{new Date(presentation.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
            <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Format</p>
            <div className="flex items-center gap-2">
              <Globe size={12} className="text-[#5C4B40]/40" />
              <p className="text-[10px] font-bold text-[#5C4B40] uppercase">{presentation.format || 'Présentation'}</p>
            </div>
          </div>
          <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
            <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Slides</p>
            <div className="flex items-center gap-2">
              <Layers size={12} className="text-[#5C4B40]/40" />
              <p className="text-[10px] font-bold text-[#5C4B40]">{presentation.num_slides || 10} PAGES</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-8 border-t border-[#5C4B40]/10 bg-white/50 backdrop-blur-xl shrink-0">
        <div className="grid grid-cols-2 gap-4">
          {isGamma && presentation.gamma_url ? (
            <button
              onClick={() => window.open(presentation.gamma_url, '_blank')}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-[#5C4B40] text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#4A3C33] transition-all shadow-xl shadow-[#5C4B40]/20"
            >
              <ExternalLink size={14} /> Ouvrir Gamma
            </button>
          ) : (
            <div />
          )}
          {presentation.conversation_id && (
            <button
              onClick={() => onOpenConversation()}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all shadow-sm"
            >
              <MessagesSquare size={14} /> Voir Chat
            </button>
          )}
          <button
            onClick={() => presentation.pptx_url && window.open(presentation.pptx_url, '_blank')}
            disabled={!presentation.pptx_url}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download size={14} /> PPTX
          </button>
          <button
            onClick={() => presentation.pdf_url && window.open(presentation.pdf_url, '_blank')}
            disabled={!presentation.pdf_url}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FileText size={14} /> PDF
          </button>
          <button
            onClick={() => { if (confirm('Supprimer définitivement ?')) onDelete(); }}
            className={`flex items-center justify-center gap-2 px-6 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all col-span-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/50`}
          >
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>
    </motion.div>
  )
}
