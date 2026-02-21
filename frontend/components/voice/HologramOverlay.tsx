'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mic, Activity, AlertCircle } from 'lucide-react'
import { useRealtimeVoice } from '@/hooks/useRealtimeVoice'

interface HologramOverlayProps {
    isOpen: boolean
    onClose: () => void
    onTranscriptSave?: (transcript: string) => void // ✅ New prop
    avatarUrl?: string
}

export default function HologramOverlay({ isOpen, onClose, onTranscriptSave, avatarUrl = '/fusion.png' }: HologramOverlayProps) {
    const { connect, disconnect, state } = useRealtimeVoice()

    // Handle saving transcript on close
    const handleClose = () => {
        // Note: transcript n'est plus exposé par le hook realtime voice
        onClose()
    }

    useEffect(() => {
        if (isOpen) {
            connect()
        } else {
            disconnect()
        }
        return () => disconnect()
    }, [isOpen, connect, disconnect])

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center pointer-events-auto"
                >
                    {/* Close Button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-8 right-8 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white transition-colors z-50"
                    >
                        <X size={24} />
                    </button>

                    {/* Holographic Projector Effect */}
                    <div className="relative">
                        {/* Audio Reactive Rings (User Volume) */}
                        {[1, 2, 3].map(i => (
                            <motion.div
                                key={i}
                                animate={{
                                    scale: [1, 1 + (state.volume * 1.5 * i)], // Reactive to user volume
                                    opacity: [0.3 * state.volume, 0],
                                    borderColor: state.status === 'speaking' ? '#10b981' : '#06b6d4' // Green when speaking, Blue listening
                                }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 1,
                                    ease: "easeOut"
                                }}
                                className="absolute inset-0 border-2 rounded-full"
                                style={{ borderColor: state.status === 'speaking' ? '#10b981' : '#06b6d4' }}
                            />
                        ))}

                        {/* Main Rotating Fusion Core */}
                        <motion.div
                            animate={{
                                scale: 1 + (state.assistantVolume * 0.1),
                                rotate: 360,
                            }}
                            transition={{
                                rotate: { duration: 15, repeat: Infinity, ease: "linear" },
                                scale: { duration: 0.2 }
                            }}
                            className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center"
                        >
                            {/* Inner Glow */}
                            <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl" />

                            <img
                                src="/fusion.png"
                                alt="Fusion"
                                className="w-full h-full object-contain mix-blend-screen opacity-90 drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                            />
                        </motion.div>
                    </div>

                    {/* Status Text */}
                    <div className={`mt-12 font-mono tracking-widest text-sm flex items-center gap-3 select-none`}>
                        {state.status === 'error' ? (
                            <span className="text-red-500 flex items-center gap-2">
                                <AlertCircle size={16} />
                                {state.error?.toUpperCase() || 'CONNECTION ERROR'}
                            </span>
                        ) : (
                            <span className={`flex items-center gap-2 ${state.status === 'speaking' ? 'text-green-400' : 'text-cyan-400'} animate-pulse`}>
                                {state.status === 'speaking' ? <Activity size={16} /> : <Mic size={16} />}
                                {state.status === 'connecting' && 'INITIALIZING UPLINK...'}
                                {state.status === 'listening' && 'LISTENING...'}
                                {state.status === 'speaking' && 'TRANSMITTING...'}
                                {state.status === 'processing' && 'ANALYZING...'}
                            </span>
                        )}
                    </div>

                </motion.div>
            )}
        </AnimatePresence>
    )
}
