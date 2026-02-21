'use client'

import React, { useState } from 'react'
import { X, Palette, Sparkles, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface StyleModalProps {
  onClose: () => void
  onSave: (style: { name: string; description: string }) => void
}

export default function StyleModal({ onClose, onSave }: StyleModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)

  const handleSave = () => {
    if (!name || !description) return
    onSave({ name, description })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden border border-[#5C4B40]/10 flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-[#5C4B40]/5 flex items-center justify-between bg-[#FDFCFB]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#800000]/10 text-[#800000] rounded-2xl">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#5C4B40] uppercase tracking-widest">Créer un style</h2>
              <p className="text-[10px] text-[#5C4B40]/40 font-bold uppercase tracking-widest">Personnalise ton esthétique</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#5C4B40]/5 rounded-xl text-[#5C4B40]/40 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 ml-1">Nom du style</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mon style cyberpunk"
              className="w-full bg-[#5C4B40]/5 border-2 border-transparent focus:border-[#800000]/20 focus:bg-white rounded-2xl px-5 py-4 text-sm font-medium text-[#5C4B40] outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 ml-1">Description (ajout au prompt)</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décris l'esthétique... (ex: lumières néon, pluie, atmosphère sombre, 8k, réaliste)"
              className="w-full bg-[#5C4B40]/5 border-2 border-transparent focus:border-[#800000]/20 focus:bg-white rounded-2xl px-5 py-4 text-sm font-medium text-[#5C4B40] outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 ml-1">Aperçu</label>
            <div className="relative aspect-video rounded-3xl bg-[#5C4B40]/5 border-2 border-dashed border-[#5C4B40]/10 flex flex-col items-center justify-center p-4 text-center group">
              {isGeneratingPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-[#800000]" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#800000]">Génération en cours...</p>
                </div>
              ) : (
                <>
                  <Sparkles size={24} className="text-[#5C4B40]/20 mb-2" />
                  <button
                    onClick={() => setIsGeneratingPreview(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/40 hover:text-[#800000] transition-colors"
                  >
                    Générer un aperçu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name || !description}
            className="flex-1 px-6 py-4 bg-[#800000] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#600000] transition-all shadow-lg shadow-[#800000]/20 disabled:opacity-30 disabled:shadow-none"
          >
            Sauvegarder
          </button>
        </div>
      </motion.div>
    </div>
  )
}
