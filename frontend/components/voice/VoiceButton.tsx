'use client'

import React from 'react'
import { Mic, MicOff } from 'lucide-react'
import { motion } from 'framer-motion'

interface VoiceButtonProps {
    onClick: () => void
    isActive: boolean
}

export default function VoiceButton({ onClick, isActive }: VoiceButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClick}
            className={`fixed bottom-8 right-8 z-50 p-4 rounded-full shadow-2xl transition-all duration-500 ${isActive
                ? 'bg-red-500 text-white shadow-red-500/50 animate-pulse'
                : 'bg-white/80 backdrop-blur-md text-foreground border border-white/50 hover:bg-white'
                }`}
            title="Mode Vocal"
        >
            {isActive ? <MicOff size={24} /> : <Mic size={24} />}

            {/* Ripple Effect for Idle state hint */}
            {!isActive && (
                <span className="absolute inset-0 rounded-full bg-secondary/20 animate-ping opacity-75" />
            )}
        </motion.button>
    )
}
