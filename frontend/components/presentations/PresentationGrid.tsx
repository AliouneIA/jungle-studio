'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { PresentationData } from './PresentationsLayout'
import { ExternalLink, Download, Trash2, FileText, Layout } from 'lucide-react'

interface PresentationGridProps {
  presentations: PresentationData[]
  onSelect: (p: PresentationData) => void
  onDelete: (p: PresentationData) => void
  onEdit: (p: PresentationData) => void
}

export default function PresentationGrid({ presentations, onSelect, onDelete, onEdit }: PresentationGridProps) {
  if (presentations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-20">
        <Layout size={64} className="mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Aucune présentation</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {presentations.map((p, index) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelect(p)}
          className="group relative aspect-[16/11] bg-white rounded-[32px] border border-[#5C4B40]/10 shadow-sm overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
        >
          {/* Preview / Placeholder */}
          <div className="absolute inset-0 bg-[#EAE1D3]/5">
            {p.provider === 'gamma' ? (
              <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-[#5C4B40] to-[#d4a574]">
                {p.gamma_url ? (
                  <div className="w-full h-full">
                    <iframe
                      src={p.gamma_url.replace('/docs/', '/embed/')}
                      style={{
                        width: '200%',
                        height: '200%',
                        transform: 'scale(0.5)',
                        transformOrigin: 'top left',
                        border: 'none',
                        pointerEvents: 'none'
                      }}
                      tabIndex={-1}
                      title={p.title}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#5C4B40] via-[#8B735B] to-[#d4a574]">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-white blur-[80px]" />
                      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#d4a574] blur-[80px]" />
                    </div>
                    <Layout size={32} className="text-white/20 mb-4" />
                    <h4 className="text-[12px] font-black text-white uppercase tracking-tighter leading-tight line-clamp-3">
                      {p.title || 'Sans titre'}
                    </h4>
                  </div>
                )}
              </div>
            ) : p.thumbnail ? (
              <div className="w-full h-full relative">
                <img
                  src={p.thumbnail}
                  alt={p.title}
                  className="w-full h-full object-cover"
                />
                {/* Badge nombre de slides */}
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10">
                  {p.num_slides} SLIDES
                </div>
              </div>
            ) : (
              <div className="p-6 w-full h-full flex flex-col gap-2 overflow-hidden opacity-20">
                <div className="h-4 w-3/4 bg-[#5C4B40] rounded-full" />
                <div className="h-2 w-full bg-[#5C4B40]/60 rounded-full" />
                <div className="h-2 w-5/6 bg-[#5C4B40]/60 rounded-full" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="aspect-video bg-[#5C4B40]/20 rounded-xl" />
                  <div className="aspect-video bg-[#5C4B40]/20 rounded-xl" />
                </div>
              </div>
            )}
          </div>

          {/* Hover Overlay Actions */}
          <div className="absolute inset-0 bg-[#5C4B40]/90 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 z-10 backdrop-blur-sm">
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(p); }}
              className="px-6 py-2.5 bg-white text-[#5C4B40] rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-110 active:scale-95 transition-all shadow-xl"
            >
              Ouvrir
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(p); }}
              className="px-4 py-2.5 bg-white text-[#5C4B40] rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-110 active:scale-95 transition-all shadow-xl"
            >
              ✏️
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette présentation ?')) onDelete(p); }}
              className="p-2.5 bg-red-500/20 text-red-100 border border-red-500/30 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Info Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/80 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest ${p.provider === 'gamma' ? 'bg-purple-100 text-purple-600' : 'bg-[#5C4B40]/10 text-[#5C4B40]'
                  }`}>
                  {p.provider}
                </span>
                <span className="text-[7px] font-bold text-[#5C4B40]/40 uppercase tracking-widest">
                  {new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <h3 className="text-sm font-black text-[#5C4B40] truncate uppercase tracking-tighter">
              {p.title || 'Sans titre'}
            </h3>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
