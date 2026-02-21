'use client'

import React from 'react'
import { Image as ImageIcon, Video, Home, ChevronLeft } from 'lucide-react'
interface StudioHeaderProps {
  activeTab: 'image' | 'video'
  onTabChange: (tab: 'image' | 'video') => void
  onClose?: () => void
}

export default function StudioHeader({ activeTab, onTabChange, onClose }: StudioHeaderProps) {
  return (
    <header className="h-20 bg-white border-b border-[#5C4B40]/10 px-8 flex items-center justify-between z-50">
      <div className="flex items-center gap-8">

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-[#800000] flex items-center justify-center text-white shadow-lg shadow-[#800000]/20">
            <ImageIcon size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#5C4B40] leading-tight uppercase tracking-widest">STUDIO CREA</h1>
            <p className="text-[10px] text-[#5C4B40]/40 font-bold uppercase tracking-widest">Espace de Génération Image</p>
          </div>
        </div>
      </div>

      <div className="bg-[#5C4B40]/5 p-1.5 rounded-2xl flex items-center gap-1">
        <button
          onClick={() => onTabChange('image')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'image'
            ? 'bg-white text-[#800000] shadow-sm'
            : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'
            }`}
        >
          <ImageIcon size={16} />
          Images
        </button>
        <button
          onClick={() => onTabChange('video')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'video'
            ? 'bg-white text-[#800000] shadow-sm'
            : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'
            }`}
        >
          <Video size={16} />
          Vidéos
        </button>
      </div>

      <div className="w-24 flex justify-end">
        {/* Placeholder for future user profile or quick settings */}
      </div>
    </header>
  )
}
