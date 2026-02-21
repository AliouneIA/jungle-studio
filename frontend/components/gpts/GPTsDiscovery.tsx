'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Bot, MoreVertical, Globe, Lock, Clock, Sparkles, History, MessageSquare, ChevronRight, LayoutGrid, List, Pencil, Share2, Trash2, Shield, Eye } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface GPTsDiscoveryProps {
  onCreateClick: () => void
  onEditClick: (botId: string) => void
  // Fix Bug 5: Ajout prop pour ouvrir une conversation depuis l'historique
  onSelectConversation?: (convId: string) => void
  refreshKey?: number
  activeProjectId?: string | null
}

export default function GPTsDiscovery({ onCreateClick, onEditClick, onSelectConversation, refreshKey, activeProjectId }: GPTsDiscoveryProps) {
  const supabase = createClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [myBots, setMyBots] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch My Bots
        const { data: bots } = await supabase
          .from('gpts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (bots) setMyBots(bots)

        // Fetch Conversation History (Only conversations linked to a project/GPT)
        let query = supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .not('project_id', 'is', null)

        if (activeProjectId) {
          query = query.eq('project_id', activeProjectId)
        }

        const { data: conversations } = await query
          .order('updated_at', { ascending: false })
          .limit(10)

        if (conversations) setHistory(conversations)
      } catch (err) {
        console.error('Error fetching Discovery data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [refreshKey, activeProjectId])

  // Fix Bug 3: Fermer le menu contextuel au scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (openMenuId) setOpenMenuId(null)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [openMenuId])

  const filteredBots = myBots.filter(bot =>
    bot.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bot.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Fix Bug 1: Ajouter user_id au delete + Fix Bug 7: Reset openMenuId avant suppression
  const handleDeleteBot = async (e: React.MouseEvent, botId: string) => {
    e.stopPropagation()
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bot ?')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fix Bug 7: Fermer le menu avant de supprimer
      setOpenMenuId(null)

      const { error } = await supabase
        .from('gpts')
        .delete()
        .eq('id', botId)
        .eq('user_id', user.id) // Fix Bug 1: Filtre user_id

      if (error) throw error
      setMyBots(prev => prev.filter(b => b.id !== botId))
    } catch (err) {
      console.error('Error deleting bot:', err)
      alert('Erreur lors de la suppression')
    }
  }

  const handleShareBot = async (e: React.MouseEvent, bot: any) => {
    e.stopPropagation()
    const url = `${window.location.origin}/gpts/${bot.id}`
    try {
      await navigator.clipboard.writeText(url)
      // Fix Bug 4: Message plus honnête
      alert('Lien copié dans le presse-papier !')
    } catch (err) {
      console.error('Error sharing:', err)
    }
    setOpenMenuId(null)
  }

  return (
    <div className="w-full h-full bg-[#EAE1D3] flex flex-col overflow-hidden">
      {/* 🧭 Top Navigation & Search Bar */}
      <div className="bg-white/60 backdrop-blur-xl border-b border-[#5C4B40]/10 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <div className="relative group max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/30 group-focus-within:text-[#5C4B40] transition-colors" size={16} />
              <input
                type="text"
                placeholder="Rechercher mes créations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-11 pr-4 rounded-xl border border-[#5C4B40]/10 bg-white/50 focus:bg-white focus:border-[#5C4B40]/30 outline-none transition-all text-sm text-[#5C4B40] placeholder-[#5C4B40]/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-[#EAE1D3]/30 p-1 rounded-xl border border-[#5C4B40]/5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#5C4B40]' : 'text-[#5C4B40]/30 hover:text-[#5C4B40]'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#5C4B40]' : 'text-[#5C4B40]/30 hover:text-[#5C4B40]'}`}
              >
                <List size={16} />
              </button>
            </div>
            <button
              onClick={onCreateClick}
              className="flex items-center gap-2 bg-[#5C4B40] text-[#EAE1D3] px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#5C4B40]/10"
            >
              <Plus size={16} />
              <span>Créer un Bot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fix Bug 3: ref sur le conteneur scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar py-12 px-8">
        <div className="max-w-[1600px] mx-auto space-y-16">

          {/* 🏹 Section Bots */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40 flex items-center gap-2">
                <Bot size={14} />
                Atelier de Création
              </h2>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-3xl bg-[#EAE1D3]/20 animate-pulse" />)}
              </div>
            ) : filteredBots.length > 0 ? (
              <div className={viewMode === 'grid'
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 px-4"
                : "flex flex-col gap-3"
              }>
                {filteredBots.map((bot, idx) => (
                  <motion.div
                    key={bot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    // Fix Bug 2: Ajout onClick pour éditer au clic sur la card
                    onClick={() => onEditClick(bot.id)}
                    className={`group relative bg-white/90 backdrop-blur-md border border-[#5C4B40]/10 rounded-[28px] p-5 cursor-pointer hover:bg-white hover:border-[#5C4B40]/20 hover:shadow-2xl hover:shadow-[#5C4B40]/10 transition-all flex ${viewMode === 'list' ? 'items-center gap-6 py-4 w-full' : 'flex-col gap-3 max-w-[320px]'}`}
                  >
                    <div className={`shrink-0 rounded-2xl bg-[#EAE1D3]/50 flex items-center justify-center border border-[#5C4B40]/10 shadow-inner group-hover:scale-110 transition-transform ${viewMode === 'list' ? 'w-14 h-14' : 'w-16 h-16'}`}>
                      {bot.photo_url ? (
                        <img src={bot.photo_url} alt={bot.name} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <Bot size={32} className="text-[#5C4B40]/40" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-black text-[#5C4B40] uppercase tracking-tight text-sm truncate">{bot.name}</h3>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-[#5C4B40]/5 text-[#5C4B40]/40 uppercase tracking-tighter border border-[#5C4B40]/5">
                          {bot.llm_model}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C4B40]/60 line-clamp-2 leading-relaxed">
                        {bot.description || bot.objective || "Aucune description... 🦁"}
                      </p>
                    </div>

                    <div className="absolute top-4 right-4 z-20">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === bot.id ? null : bot.id)
                        }}
                        className={`p-2 transition-all hover:bg-[#5C4B40]/10 rounded-xl ${openMenuId === bot.id ? 'bg-[#5C4B40] text-white opacity-100' : 'text-[#5C4B40]/40 opacity-0 group-hover:opacity-100'}`}
                      >
                        <MoreVertical size={16} />
                      </button>

                      <AnimatePresence>
                        {openMenuId === bot.id && (
                          <>
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="fixed inset-0 z-30"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(null)
                              }}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: -10 }}
                              className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl border border-[#5C4B40]/10 rounded-2xl shadow-2xl shadow-[#5C4B40]/20 z-40 overflow-hidden"
                            >
                              <div className="p-1.5 flex flex-col gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEditClick(bot.id)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-xl transition-colors"
                                >
                                  <Pencil size={14} /> Modifier
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleShareBot(e, bot)
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-xl transition-colors"
                                >
                                  <Share2 size={14} /> Partager
                                </button>
                                <div className="h-px bg-[#5C4B40]/5 my-0.5 mx-2" />
                                <button
                                  onClick={(e) => handleDeleteBot(e, bot.id)}
                                  className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                  <Trash2 size={14} /> Supprimer
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>

                    {viewMode === 'grid' && (
                      <div className="mt-4 pt-4 border-t border-[#5C4B40]/5 flex items-center justify-between text-[10px] font-bold text-[#5C4B40]/30 uppercase tracking-widest">
                        <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(bot.created_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1.5 text-secondary group-hover:text-[#5C4B40] transition-colors">Éditer <ChevronRight size={12} /></span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center space-y-4 bg-white/20 rounded-[48px] border-2 border-dashed border-[#5C4B40]/5">
                <div className="w-20 h-20 bg-[#EAE1D3]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  {/* Fix Bug 6: Utiliser Sparkles directement au lieu du wrapper trompeur "Rocket" */}
                  <Sparkles size={32} className="text-[#5C4B40]/20" />
                </div>
                <p className="text-xl font-light tracking-widest text-[#5C4B40]/40 uppercase">Aucun GPT trouvé</p>
                <p className="text-xs text-[#5C4B40]/30 uppercase tracking-widest font-bold">Commencez par créer votre premier assistant intelligent</p>
                <button
                  onClick={onCreateClick}
                  className="mt-8 px-10 py-4 bg-[#5C4B40] text-white rounded-full text-xs font-black uppercase tracking-widest transition-all hover:scale-105"
                >
                  Démarrer Studio
                </button>
              </div>
            )}
          </div>

          {/* 🏛️ Section Historique */}
          <div className="space-y-6">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40 flex items-center gap-2">
              <History size={14} />
              Historique Récent
            </h2>

            <div className="bg-white/40 backdrop-blur-sm rounded-[32px] border border-[#5C4B40]/10 overflow-hidden outline outline-4 outline-white/20">
              {history.length > 0 ? (
                <div className="divide-y divide-[#5C4B40]/5">
                  {history.map((conv) => (
                    <div
                      key={conv.id}
                      // Fix Bug 5: Ajout onClick pour ouvrir la conversation
                      onClick={() => onSelectConversation?.(conv.id)}
                      className={`p-5 flex items-center gap-4 hover:bg-white/60 transition-colors group ${onSelectConversation ? 'cursor-pointer' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#5C4B40]/5 flex items-center justify-center text-[#5C4B40]/40 group-hover:bg-[#5C4B40] group-hover:text-white transition-all">
                        <MessageSquare size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-[#5C4B40] truncate uppercase tracking-tight">{conv.title || "Nouvelle discussion"}</h4>
                        <p className="text-[10px] text-[#5C4B40]/40 font-black uppercase tracking-widest mt-0.5">
                          {new Date(conv.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-[#5C4B40]/10 group-hover:text-[#5C4B40]/40 transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/20 italic">
                  L'historique des discussions s'affichera ici...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
