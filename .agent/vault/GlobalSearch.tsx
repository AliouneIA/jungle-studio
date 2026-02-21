// cspell:ignore ilike
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MessageSquare, Calendar, ChevronRight, X, Trash2, Filter, ArrowRight, Brain, Sparkles } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface SearchPageProps {
  onClose: () => void
  onSelectConversation: (id: string) => void
  activeProjectId?: string | null
}

interface Conversation {
  id: string
  title: string
  created_at: string
  project_id?: string
  mode?: string
  projects?: {
    title: string
  }
}

// Fix Bug 3: Échapper les wildcards LIKE de PostgreSQL
const escapeLikeQuery = (str: string): string => {
  return str.replace(/[%_\\]/g, '\\$&')
}

export default function GlobalSearch({ onClose, onSelectConversation, activeProjectId }: SearchPageProps) {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [filterMode, setFilterMode] = useState<string>('all')
  
  // Fix Bug 5: Ref pour le channel realtime (éviter zombie)
  const channelRef = useRef<any>(null)

  // Fix Bug 1: fetchRecent stable avec useCallback
  const fetchRecent = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No user found')
        return
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*, projects(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching recent conversations:', error)
        return
      }

      console.log('Recent conversations loaded:', data?.length || 0, 'conversations')
      setRecentConversations(data || [])
    } catch (error) {
      console.error('Failed to fetch recent conversations:', error)
    }
  }, [supabase])

  // Setup realtime subscription
  useEffect(() => {
    fetchRecent()

    const setupRealtimeSubscription = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) return

        // Fix Bug 5: Assigner au ref immédiatement pour garantir le cleanup
        const channel = supabase
          .channel('conversations-search-realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              filter: `user_id=eq.${data.user.id}`
            },
            () => {
              fetchRecent()
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.warn('Realtime subscription error, will retry...')
            }
          })
        
        channelRef.current = channel
      } catch (error) {
        console.warn('Could not setup realtime subscription:', error)
      }
    }

    setupRealtimeSubscription()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {})
        channelRef.current = null
      }
    }
  }, [fetchRecent])

  // Recherche en temps réel
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch()
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const performSearch = async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('No user found for search')
        setIsLoading(false)
        return
      }

      // Fix Bug 3: Échapper les wildcards LIKE
      const safeQuery = escapeLikeQuery(query.trim())

      // Fix Bug 8: Ajouter un limit à la recherche
      const { data, error } = await supabase
        .from('conversations')
        .select('*, projects(title)')
        .eq('user_id', user.id)
        .ilike('title', `%${safeQuery}%`)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error searching conversations:', error)
        setIsLoading(false)
        return
      }

      console.log('Search results:', data?.length || 0, 'results for query:', query)
      setResults(data || [])
      setIsLoading(false)
    } catch (error) {
      console.error('Failed to search conversations:', error)
      setIsLoading(false)
    }
  }

  // Fix Bug 4: Ajouter user_id au delete
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Effacer cette discussion ?')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Fix Bug 4: Sécurité supplémentaire
    
    if (!error) {
      setResults(prev => prev.filter(c => c.id !== id))
      setRecentConversations(prev => prev.filter(c => c.id !== id))
    }
  }

  // Fix Bug 7: Filtrer les conversations système de manière plus robuste
  const isSystemConversation = (title: string | undefined): boolean => {
    if (!title) return false
    const systemPrefixes = ['Analyse ce message']
    return systemPrefixes.some(prefix => title.startsWith(prefix))
  }

  // Fix Bug 6: Le filtre "canvas" ne retourne rien car les canvas sont dans une autre table
  // On garde le filtre mais on le documente — les canvas presentations ne sont pas des conversations
  const filteredConversations = (query.trim() ? results : recentConversations).filter(conv => {
    if (isSystemConversation(conv.title)) return false
    if (filterMode === 'all') return true
    const convMode = conv.mode || 'solo'
    return convMode === filterMode
  })

  const displayConversations = filteredConversations

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F6F2] overflow-hidden">
      {/* Search Header */}
      <div className="px-8 py-10 border-b border-[#5C4B40]/10 bg-white/50 backdrop-blur-3xl shrink-0">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between font-avenir">
            <div>
              <h1 className="text-3xl font-light tracking-[0.3em] text-[#5C4B40] uppercase">Archives</h1>
              <p className="text-[10px] text-[#5C4B40]/40 font-bold uppercase tracking-[0.2em] mt-1">Recherche Globale Studio</p>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-white border border-[#5C4B40]/10 rounded-2xl text-[#5C4B40]/40 hover:text-[#5C4B40] transition-all shadow-sm hover:shadow-md"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#5C4B40]/30 group-focus-within:text-[#5C4B40] transition-colors" size={20} />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par titre..."
              className="w-full h-16 pl-14 pr-6 bg-white border border-[#5C4B40]/10 rounded-[24px] text-lg text-[#5C4B40] placeholder-[#5C4B40]/20 focus:outline-none focus:ring-4 focus:ring-[#5C4B40]/5 focus:border-[#5C4B40]/30 transition-all font-light"
            />
            {isLoading && (
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-[#5C4B40]/10 border-t-[#5C4B40] rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#5C4B40]/40 flex items-center gap-2">
              <Filter size={12} />
              {query.trim() ? `Résultats (${filteredConversations.length})` : 'Conversations Récentes'}
            </h3>
          </div>

          {/* Filtres d'historique */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
            {[
              { id: 'all', label: 'Tout', icon: <Brain size={14} className={filterMode === 'all' ? 'text-white' : 'text-[#5C4B40]'} /> },
              {
                id: 'fusion',
                label: 'Fusion',
                icon: <img src="/fusion.png" alt="" className={`w-3.5 h-3.5 object-contain brightness-[10] contrast-[10] ${filterMode === 'fusion' ? '' : 'opacity-70'}`} />
              },
              {
                id: 'supernova',
                label: 'Supernova',
                icon: <img src="/fusion.png" alt="" className={`w-3.5 h-3.5 object-contain sepia saturate-[5] brightness-125 hue-rotate-[10deg] drop-shadow-[0_2px_10px_rgba(255,215,0,0.4)] ${filterMode === 'supernova' ? '' : 'opacity-70'}`} />
              },
              { id: 'manus', label: 'Manus', icon: <img src="/Manus1.png" alt="" className="w-3 h-3 object-contain" /> },
              { id: 'solo', label: 'Solo', icon: <Sparkles size={14} className={filterMode === 'solo' ? 'text-white' : 'text-[#5C4B40]'} /> },
              { id: 'research', label: 'Recherche', icon: <Search size={14} className={filterMode === 'research' ? 'text-white' : 'text-[#5C4B40]/60'} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${filterMode === tab.id
                  ? 'bg-[#5C4B40] text-white border-[#5C4B40] shadow-md scale-105'
                  : 'bg-white/50 text-[#5C4B40]/60 border-[#5C4B40]/10 hover:bg-white hover:text-[#5C4B40] hover:border-[#5C4B40]/30'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {displayConversations.map((conv, idx) => {
                const mode = conv.mode || 'solo'
                const isSupernova = mode === 'supernova'
                const isManus = mode === 'manus'
                const isResearch = mode === 'research'
                const isFusion = mode === 'fusion'

                return (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => onSelectConversation(conv.id)}
                    className="group bg-white/60 hover:bg-white border border-[#5C4B40]/5 p-6 rounded-3xl cursor-pointer transition-all flex items-center gap-6 shadow-sm hover:shadow-xl hover:shadow-[#5C4B40]/5 hover:border-[#5C4B40]/20"
                  >
                    {/* Icône dynamique selon le mode */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${isSupernova ? 'bg-[#4a0505]/10 text-[#4a0505] group-hover:bg-[#4a0505] group-hover:text-white' :
                      isManus ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' :
                        isResearch ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' :
                          isFusion ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white' :
                            'bg-[#EAE1D3]/30 text-[#5C4B40]/40 group-hover:bg-[#5C4B40] group-hover:text-white'
                      }`}>
                      {isSupernova ? (
                        <img src="/fusion.png" alt="" className="w-6 h-6 object-contain sepia saturate-[5] brightness-125 hue-rotate-[10deg]" />
                      ) : isManus ? (
                        <img src="/Manus1.png" alt="" className="w-6 h-6 object-contain" />
                      ) : isResearch ? (
                        <Search size={24} />
                      ) : isFusion ? (
                        <img src="/fusion.png" alt="" className="w-6 h-6 object-contain brightness-[10] contrast-[10]" />
                      ) : (
                        <MessageSquare size={24} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-[#5C4B40] truncate leading-tight group-hover:text-black transition-colors">
                          {conv.title || 'Discussion sans titre'}
                        </h3>
                        {conv.mode && conv.mode !== 'solo' && (
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md border ${conv.mode === 'fusion' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                            conv.mode === 'supernova' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                              conv.mode === 'manus' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                conv.mode === 'research' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                  'bg-[#5C4B40]/5 text-[#5C4B40]/60 border-[#5C4B40]/10'
                            }`}>
                            {conv.mode}
                          </span>
                        )}
                        {conv.projects && (
                          <span className="px-2 py-0.5 bg-[#5C4B40]/5 text-[#5C4B40]/60 text-[9px] font-black uppercase tracking-widest rounded-md border border-[#5C4B40]/10">
                            {conv.projects.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[#5C4B40]/40 text-xs font-medium uppercase tracking-[0.1em]">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          {new Date(conv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="p-3 hover:bg-red-50 text-[#5C4B40]/20 hover:text-red-500 rounded-2xl transition-all"
                        title="Supprimer l'archive"
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="w-10 h-10 rounded-full bg-[#5C4B40]/5 flex items-center justify-center text-[#5C4B40]/40">
                        <ArrowRight size={18} />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {displayConversations.length === 0 && !isLoading && (
              <div className="py-32 text-center space-y-6 bg-white/30 rounded-[40px] border-2 border-dashed border-[#5C4B40]/10">
                <div className="w-20 h-20 rounded-full bg-[#EAE1D3]/50 flex items-center justify-center mx-auto text-[#5C4B40]/20 shadow-inner">
                  <Search size={32} />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-light text-[#5C4B40]/60 uppercase tracking-widest">Aucun résultat trouvé</p>
                  <p className="text-xs text-[#5C4B40]/40 font-medium">Réessayez avec d'autres mots-clés ou vérifiez vos archives.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
