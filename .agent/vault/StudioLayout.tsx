'use client'

import React, { useState, useCallback } from 'react'
import ImageGrid from './ImageGrid'
import ImageDetailPanel from './ImageDetailPanel'
import ImagePromptBar from './ImagePromptBar'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export interface GeneratedImage {
  id: string
  image_url: string
  prompt: string
  model: string
  ratio: string
  quality: string
  style_name?: string
  batch_id: string
  created_at: string
  metadata?: any
}

export default function StudioLayout() {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isEnlarged, setIsEnlarged] = useState(false)
  const [isUpscaling, setIsUpscaling] = useState(false)
  const [upscaleError, setUpscaleError] = useState<string | null>(null) // Fix Bug 2: Feedback erreur
  const supabase = createClient()

  // Fix Bug 1: Compteur de variation au lieu de setTimeout hack
  const [variationPrompt, setVariationPrompt] = useState('')
  const [variationKey, setVariationKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  // Fix Bug 1: Incrémenter une key pour que ImagePromptBar détecte le changement
  // même si le même prompt est envoyé deux fois d'affilée
  const handleVary = useCallback((prompt: string) => {
    setVariationPrompt(prompt)
    setVariationKey(prev => prev + 1)
  }, [])

  // Callback pour que ImagePromptBar signale qu'il a consommé le prompt
  const handleVariationConsumed = useCallback(() => {
    setVariationPrompt('')
  }, [])

  const handleUpscale = async (image: GeneratedImage) => {
    if (!image || isUpscaling) return
    setIsUpscaling(true)
    setUpscaleError(null) // Fix Bug 2: Reset erreur

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Fix Bug 3: Feedback si user null
        setUpscaleError('Session expirée. Veuillez vous reconnecter.')
        return
      }

      // Fix Bug 4: Variable originalPrompt supprimée (était du code mort)

      const { data, error } = await supabase.functions.invoke('studio-generate', {
        body: {
          prompt: 'Faithfully restore and upscale this image with high fidelity to maximum quality. Preserve every detail exactly as is. Do not change any content, colors, composition or style. Only increase resolution and enhance sharpness and texture details. Upscale to 4K.',
          model: 'nano-banana-pro',
          count: 1,
          ratio: image.ratio || '1:1',
          quality: 'hd',
          style: '',
          style_description: '',
          user_id: user.id,
          reference_image_url: image.image_url,
          upscale: true
        }
      })

      if (error) throw error

      handleRefresh()

    } catch (err: any) {
      console.error('Upscale error:', err)
      // Fix Bug 2: Feedback utilisateur
      setUpscaleError(err?.message || "Erreur lors de l'upscale. Réessayez.")
    } finally {
      setIsUpscaling(false)
    }
  }

  return (
    <div className="w-full flex h-full flex-col relative bg-transparent">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Image Grid */}
        <div className={`flex-1 transition-all duration-500 overflow-hidden flex flex-col ${selectedImage ? 'mr-[450px]' : ''}`}>
          <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
            <ImageGrid
              key={refreshKey}
              onSelectImage={setSelectedImage}
              selectedImageId={selectedImage?.id}
            />
          </div>

          {/* Prompt Bar (Fixed at the bottom of grid area) */}
          <div className="p-6 border-none bg-transparent">
            <ImagePromptBar
              onImageGenerated={handleRefresh}
              initialPrompt={variationPrompt}
              variationKey={variationKey} // Fix Bug 1: Key pour détecter nouveau prompt
              onVariationConsumed={handleVariationConsumed} // Fix Bug 1: Callback de consommation
            />
          </div>
        </div>

        {/* Right Column: Detail Panel */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ x: 450, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 450, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="absolute top-0 right-0 w-[450px] h-full z-40"
            >
              <ImageDetailPanel
                image={selectedImage}
                onClose={() => setSelectedImage(null)}
                onEnlarge={() => setIsEnlarged(true)}
                onVary={handleVary}
                onUpscale={handleUpscale}
                onDelete={() => {
                  handleRefresh()
                  setSelectedImage(null)
                }}
                isUpscaling={isUpscaling}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fix Bug 2: Toast d'erreur upscale */}
      <AnimatePresence>
        {upscaleError && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-red-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold"
          >
            <span>⚠️ {upscaleError}</span>
            <button
              onClick={() => setUpscaleError(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fix Bug 5: Lightbox en z-[200] pour passer au-dessus de tout */}
      <AnimatePresence>
        {isEnlarged && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
            onClick={() => setIsEnlarged(false)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[210]"
              onClick={(e) => { e.stopPropagation(); setIsEnlarged(false); }}
            >
              <X size={32} />
            </motion.button>

            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage.image_url}
              alt={selectedImage.prompt}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
