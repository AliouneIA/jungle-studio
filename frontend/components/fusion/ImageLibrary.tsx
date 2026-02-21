
// cspell:disable
'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Trash2, X, Download, MonitorPlay } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface GeneratedImage {
  id: string
  image_url: string
  prompt: string
  model_slug: string
  created_at: string
}

export default function ImageLibrary({ onClose }: { onClose?: () => void }) {
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchImages()
  }, [])

  const fetchImages = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setImages(data)
    setIsLoading(false)
  }

  const handleDelete = async (id: string, url: string) => {
    if (!confirm("Supprimer cette image définitivement ?")) return

    // Extract path key from URL
    // Example: https://.../storage/v1/object/public/generated_images/USER_ID/FILE.png
    // We need: USER_ID/FILE.png
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/generated_images/');
      if (pathParts.length > 1) {
        const pathKey = pathParts[1];
        const { error: storageError } = await supabase.storage
          .from('generated_images')
          .remove([pathKey])

        if (storageError) console.error("Storage delete error:", storageError)
      }
    } catch (e) {
      console.error("URL parse error:", e)
    }

    const { error } = await supabase.from('generated_images').delete().eq('id', id)

    if (!error) {
      setImages(prev => prev.filter(img => img.id !== id))
      if (selectedImage?.id === id) setSelectedImage(null)
    }
  }

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Download error:", error)
      window.open(url, '_blank')
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-background/95 backdrop-blur-md">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            🎨 Bibliothèque
            <span className="text-sm font-normal opacity-50 bg-secondary/20 px-2 py-0.5 rounded-full">{images.length}</span>
          </h2>
          <p className="text-sm text-secondary mt-1">Vos créations générées par IA</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-secondary/20 rounded-full transition-colors">
            <X size={24} />
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth no-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 opacity-50 animate-pulse">Chargement de la galerie...</div>
        ) : images.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <MonitorPlay size={48} className="mx-auto mb-4 opacity-50" />
            <p>Aucune image générée pour le moment.</p>
            <p className="text-sm">Utilisez le mode "Image Gen" pour créer !</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {images.map(img => (
              <motion.div
                key={img.id}
                layoutId={`image-${img.id}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group aspect-square rounded-xl overflow-hidden bg-secondary/10 border border-white/5 cursor-pointer shadow-sm hover:shadow-xl transition-all hover:scale-[1.02]"
                onClick={() => setSelectedImage(img)}
              >
                {/* We use standard img tag for simplicity with external URLs unless configured in next.config */}
                <img
                  src={img.image_url}
                  alt={img.prompt.substring(0, 50)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                {/* Quick Delete Button on Hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(img.id, img.image_url) }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Supprimer"
                >
                  <Trash2 size={12} />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white/90 font-mono truncate">{img.model_slug}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              layoutId={`image-${selectedImage.id}`}
              className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button abs top right */}
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-0 right-0 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
              >
                <X size={24} />
              </button>

              {/* Main Image */}
              <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
                <img
                  src={selectedImage.image_url}
                  alt={selectedImage.prompt}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                />
              </div>

              {/* Info Bar */}
              <div className="w-full mt-6 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-white shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">
                        {selectedImage.model_slug}
                      </span>
                      <span className="text-white/40 text-xs">
                        {new Date(selectedImage.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-lg font-medium leading-normal text-white/90 max-h-24 overflow-y-auto no-scrollbar">
                      {selectedImage.prompt}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleDownload(selectedImage.image_url, `create-${selectedImage.id}.png`)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/10 text-white"
                    >
                      <Download size={18} /> HD
                    </button>
                    <button
                      onClick={() => handleDelete(selectedImage.id, selectedImage.image_url)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-xl text-sm font-bold transition-all border border-red-500/20"
                    >
                      <Trash2 size={18} /> Supprimer
                    </button>
                  </div>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
