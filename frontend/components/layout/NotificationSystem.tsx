'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, CheckCircle2, AlertCircle, X, ExternalLink, Play } from 'lucide-react'

export interface VideoNotificationData {
  id: string
  title: string
  status: 'done' | 'failed'
  video_url?: string
  thumbnail_url?: string
  model: string
}

interface NotificationSystemProps {
  notifications: VideoNotificationData[]
  onClose: (id: string) => void
  onView: (id: string) => void
}

export default function NotificationSystem({ notifications, onClose, onView }: NotificationSystemProps) {
  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-4 pointer-events-none w-full max-w-sm">
      <AnimatePresence mode="popLayout">
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-[#5C4B40]/10 rounded-2xl shadow-2xl p-4 flex gap-4 relative overflow-hidden group"
          >
            {/* Ambient Background Glow */}
            <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-10 transition-colors ${notif.status === 'done' ? 'bg-green-500' : 'bg-red-500'}`} />

            {/* Video Thumbnail or Icon */}
            <div className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-[#EAE1D3]/50 border border-[#5C4B40]/5 flex items-center justify-center">
              {notif.thumbnail_url ? (
                <img src={notif.thumbnail_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <Video size={24} className="text-[#5C4B40]/20" />
              )}
              {notif.status === 'done' && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={20} className="text-white fill-white" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 mb-1">
                {notif.status === 'done' ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Production Terminée</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-red-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-600/70">Échec Production</span>
                  </div>
                )}
              </div>
              <h4 className="text-xs font-bold text-[#5C4B40] leading-tight line-clamp-2 mb-1">
                {notif.title || "Vidéo AI sans titre"}
              </h4>
              <p className="text-[9px] font-black uppercase tracking-wider text-[#5C4B40]/30">
                {notif.model === 'grok-video' ? 'Grok Video' : 'Veo 3.1'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onClose(notif.id)}
                className="p-1 px-1.5 hover:bg-[#EAE1D3]/50 rounded-lg text-[#5C4B40]/30 hover:text-[#5C4B40] transition-all"
              >
                <X size={14} />
              </button>
              {notif.status === 'done' && (
                <button
                  onClick={() => onView(notif.id)}
                  className="p-1 px-1.5 bg-[#5C4B40]/10 hover:bg-[#5C4B40]/20 rounded-lg text-[#5C4B40] transition-all"
                  title="Voir la vidéo"
                >
                  <ExternalLink size={14} />
                </button>
              )}
            </div>

            {/* Progress line (Success/Fail) */}
            <div className={`absolute bottom-0 left-0 h-0.5 w-full ${notif.status === 'done' ? 'bg-emerald-500/30' : 'bg-red-500/30'}`} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
