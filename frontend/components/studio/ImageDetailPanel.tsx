'use client'

import React from 'react'
import { X, Download, RefreshCw, ZoomIn, Trash2, Loader2, Check } from 'lucide-react'
import { GeneratedImage } from './StudioLayout'
import { createClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'

interface ImageDetailPanelProps {
  image: GeneratedImage
  onClose?: () => void
  onEnlarge?: () => void
  onVary?: (prompt: string) => void
  onUpscale?: (image: GeneratedImage) => void
  onDelete?: () => void
  onDownload?: () => void
  isUpscaling?: boolean
}

export default function ImageDetailPanel({ image, onClose, onEnlarge, onVary, onUpscale, onDelete, onDownload, isUpscaling }: ImageDetailPanelProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [showSuccess, setShowSuccess] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const supabase = createClient()

  const handleDownload = async () => {
    if (onDownload) {
      onDownload()
      return
    }
    try {
      const response = await fetch(image.image_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `jungle-studio-${image.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download error:", err)
      window.open(image.image_url, '_blank')
    }
  }

  const handleDelete = async () => {
    try {
      if (!confirm('Voulez-vous vraiment supprimer cette image ?')) {
        setShowConfirm(false) // Close confirmation if user cancels
        return
      }

      setIsDeleting(true) // Start loading state for internal deletion
      setShowConfirm(false) // Close confirmation immediately

      if (onDelete) {
        // If an onDelete prop is provided, delegate the deletion logic to the parent
        onDelete()
        // Assuming parent will handle success/error states and close the panel
        return
      }

      // Fallback: If no onDelete prop, perform deletion internally
      const { error } = await supabase
        .from('studio_images')
        .delete()
        .eq('id', image.id)

      if (!error) {
        setShowSuccess(true)
        setTimeout(() => {
          setIsDeleting(false)
          setShowSuccess(false)
          onClose?.() // Close panel after internal deletion
        }, 1500)
      } else {
        throw error // Propagate error for catch block
      }
    } catch (err) {
      console.error('Delete failed:', err)
      setIsDeleting(false) // Ensure loading state is reset on error
      // Optionally show an error message to the user
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#faf6f0] border-l border-[#5C4B40]/10 shadow-[-20px_0_50px_rgba(0,0,0,0.05)] relative overflow-hidden">
      {/* Confirmation Overlay */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-[#faf6f0]/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-[#5C4B40] uppercase tracking-tighter mb-2">Supprimer l'image ?</h3>
            <p className="text-sm text-[#5C4B40]/60 mb-8 leading-relaxed">
              Cette action est irréversible. L'image sera définitivement retirée de votre Studio.
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-4 bg-red-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/10 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : null}
                {isDeleting ? 'Suppression...' : 'Oui, Supprimer'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="w-full py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all shadow-sm"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="p-8 pb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40">Studio Archive</span>
          <h2 className="text-xl font-black text-[#5C4B40] uppercase tracking-tighter">Chef-d'œuvre</h2>
        </div>
        <button
          onClick={() => onClose?.()}
          className="p-3 hover:bg-[#5C4B40]/5 rounded-2xl text-[#5C4B40]/40 hover:text-[#5C4B40] transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-4 space-y-10">
        <div
          onClick={() => onEnlarge?.()}
          className="relative aspect-square rounded-[24px] overflow-hidden bg-white border-4 border-[#d4a574] shadow-2xl cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
          title="Cliquez pour agrandir"
        >
          <img
            src={image.image_url}
            alt={image.prompt}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Prompt Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4a574]" /> Instruction IA
            </h4>
            <button className="text-[10px] font-black uppercase tracking-widest text-[#d4a574] hover:underline">Copier</button>
          </div>
          <div className="p-6 bg-white/50 border border-[#d4a574]/10 rounded-[28px]">
            <p className="text-sm text-[#5C4B40] leading-relaxed italic font-serif">
              "{image.prompt}"
            </p>
          </div>
        </div>

        {/* Technical Registry */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5C4B40]/40" /> Registre Technique
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Moteur</p>
              <p className="text-xs font-bold text-[#5C4B40]">{image.model}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Dimensions</p>
              <p className="text-xs font-bold text-[#5C4B40]">{image.ratio}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Finition</p>
              <p className="text-xs font-bold text-[#5C4B40]">{image.quality}</p>
            </div>
            <div className="p-4 bg-white/40 rounded-2xl border border-[#5C4B40]/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-[#5C4B40]/30 mb-1">Esthétique</p>
              <p className="text-xs font-bold text-[#5C4B40] truncate">{image.style_name || 'Naturel'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Royal Actions Footer */}
      <div className="p-8 border-t border-[#5C4B40]/10 bg-white/30 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-[#5C4B40] text-white rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#4A3C33] transition-all shadow-xl shadow-[#5C4B40]/10"
          >
            <Download size={14} /> Télécharger
          </button>
          <button
            onClick={() => onVary?.(image.prompt)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all shadow-sm"
          >
            <RefreshCw size={14} /> Modifier
          </button>
          <button
            onClick={() => onUpscale?.(image)}
            disabled={isUpscaling}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-white text-[#5C4B40] border border-[#5C4B40]/10 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all shadow-sm disabled:opacity-50"
          >
            {isUpscaling ? (
              <>
                <Loader2 size={14} className="animate-spin" /> UPSCALE EN COURS...
              </>
            ) : (
              <>
                <ZoomIn size={14} /> UPSCALE HD
              </>
            )}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isDeleting || showSuccess}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-red-50 text-red-600 rounded-[20px] text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100/50 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] bg-gradient-to-br from-[#064e3b]/95 to-[#022c22]/98 backdrop-blur-xl flex flex-col items-center justify-center text-white"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-24 h-24 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(6,78,59,0.3)]"
            >
              <Check size={40} strokeWidth={3} className="text-[#d4a574]" />
            </motion.div>
            <span className="text-sm font-black uppercase tracking-[0.4em] text-[#d4a574]">Archive Mise à Jour</span>
            <div className="mt-2 h-px w-12 bg-[#d4a574]/30" />
            <span className="mt-4 text-[10px] font-medium uppercase tracking-[0.2em] opacity-60">Image retirée du Studio</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
