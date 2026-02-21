'use client'

import React from 'react'

interface FusionOrbProps {
    isProcessing: boolean
    isHovered?: boolean
    liveUrl?: string | null
}

export default function FusionOrb({ isProcessing, isHovered = false, liveUrl = null }: FusionOrbProps) {
    const showOrb = isProcessing || isHovered || !!liveUrl
    return (
        <div className={`fixed top-6 right-6 z-[100] flex items-center justify-center transition-all duration-700 fusion-orb-container ${showOrb ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}>
            {/* Animated Glow Backdrop */}
            <div className={`absolute w-[100px] h-[100px] rounded-full bg-orange-200/20 blur-[40px] transition-all duration-1000 ${showOrb ? 'scale-150 opacity-60' : 'scale-100 opacity-0'}`} />

            {liveUrl ? (
                <div className="relative group">
                    <img
                        src="/fusion.png"
                        alt="Fusion Agent"
                        className="relative w-[100px] h-[100px] object-contain transition-all duration-1000 fusion-orb-active mix-blend-screen animate-spin-slow"
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping mb-1" />
                        <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest whitespace-nowrap bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                            Actif
                        </span>
                    </div>
                </div>
            ) : (
                <img
                    src="/fusion.png"
                    alt="Fusion Orb"
                    className={`relative w-[100px] h-[100px] object-contain transition-all duration-1000 pointer-events-none mix-blend-screen animate-spin-slow ${isProcessing ? 'fusion-orb-active' : 'fusion-orb-idle grayscale opacity-40'}`}
                />
            )}
        </div>
    )
}
