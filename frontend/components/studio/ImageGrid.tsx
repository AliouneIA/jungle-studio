'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import { GeneratedImage } from './StudioLayout'
import { Loader2, MonitorPlay } from 'lucide-react'

interface ImageGridProps {
  onImageSelect: (image: GeneratedImage) => void
  selectedId?: string
  refreshTrigger?: number
}

// Fonction utilitaire pour grouper par batch_id
const groupBy = (array: GeneratedImage[], key: keyof GeneratedImage): Record<string, GeneratedImage[]> => {
  return array.reduce((result: Record<string, GeneratedImage[]>, currentValue) => {
    const keyValue = currentValue[key] as string
    (result[keyValue] = result[keyValue] || []).push(currentValue)
    return result
  }, {})
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function ImageGrid({ onImageSelect, selectedId, refreshTrigger = 0 }: ImageGridProps) {
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchImages()
  }, [refreshTrigger])

  const fetchImages = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('studio_images')
      .select('*')
      .eq('source', 'studio')
      .order('created_at', { ascending: false })

    if (data) {
      setImages(data)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
        <Loader2 size={32} className="animate-spin text-[#5C4B40]" />
        <p className="text-sm font-black uppercase tracking-widest text-[#5C4B40]">Synchronisation du Studio...</p>
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-[#5C4B40]/10 flex items-center justify-center text-[#5C4B40]">
          <MonitorPlay size={40} />
        </div>
        <div>
          <h3 className="text-xl font-black text-[#5C4B40] uppercase tracking-widest">Studio Vide</h3>
          <p className="text-sm font-medium text-[#5C4B40] max-w-sm mx-auto mt-2">Prêt à donner vie à vos idées ? Utilisez la barre de prompt ci-dessous.</p>
        </div>
      </div>
    )
  }

  const batches = groupBy(images, 'batch_id')

  return (
    <div className="p-4 pb-32">
      {Object.entries(batches).map(([batchId, batchImages]: [string, GeneratedImage[]]) => (
        <div key={batchId} className="mb-12">
          {/* Batch Header */}
          <div className="flex items-baseline gap-3 mb-4 px-1">
            <h4 className="text-xs font-black text-[#5C4B40] uppercase tracking-wider truncate max-w-[70%]">
              {batchImages[0].prompt.substring(0, 80)}{batchImages[0].prompt.length > 80 ? '...' : ''}
            </h4>
            <span className="text-[10px] font-bold text-[#5C4B40]/30 uppercase tracking-widest whitespace-nowrap">
              • {formatDate(batchImages[0].created_at)}
            </span>
          </div>

          {/* Batch Grid */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(250px, 1fr))`
            }}
          >
            {batchImages.map((img: GeneratedImage) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => onImageSelect(img)}
                className={`group relative overflow-hidden bg-[#5C4B40]/5 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl ${selectedId === img.id
                  ? 'ring-2 ring-[#d4a574] ring-offset-4 scale-[0.98]'
                  : 'hover:ring-1 hover:ring-[#5C4B40]/10'
                  }`}
                style={{
                  aspectRatio: (img.ratio || '1:1').replace(':', '/'),
                  borderRadius: '10px'
                }}
              >
                <img
                  src={img.image_url}
                  alt={img.prompt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Status Indicator (Optional) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[8px] text-white font-black uppercase tracking-widest">
                    {img.model}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
