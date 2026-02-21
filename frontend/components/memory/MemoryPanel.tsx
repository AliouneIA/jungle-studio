'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Plus, Trash2, Edit3, Check, X, Loader2, Sparkles, RefreshCw, User, Settings, FolderOpen, GraduationCap, Pin, FileText, Search } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Memory {
  id: string
  category: string
  key: string
  value: string
  source: 'auto' | 'manual'
  confidence: number
  created_at: string
  updated_at: string
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  identity: { label: 'Identité', icon: User, color: 'text-[#5C4B40]', bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10' },
  preferences: { label: 'Préférences', icon: Settings, color: 'text-[#5C4B40]', bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10' },
  projects: { label: 'Projets', icon: FolderOpen, color: 'text-[#5C4B40]', bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10' },
  expertise: { label: 'Expertise', icon: GraduationCap, color: 'text-[#5C4B40]', bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10' },
  context: { label: 'Contexte', icon: Pin, color: 'text-[#5C4B40]', bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10' },
  general: { label: 'Divers', icon: FileText, color: 'text-[#5C4B40]', bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10' },
}

export default function MemoryPanel() {
  const supabase = createClient()
  const [memories, setMemories] = useState<Memory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('general')
  const [newValue, setNewValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const fetchMemories = useCallback(async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsLoading(false); return }

    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', user.id)
      .order('category')
      .order('updated_at', { ascending: false })

    if (data) setMemories(data)
    if (error) console.error('[MemoryPanel] Fetch error:', error)
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const handleDelete = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setMemories((prev: Memory[]) => prev.filter((m: Memory) => m.id !== id))
    }
  }

  const handleEdit = (memory: Memory) => {
    setEditingId(memory.id)
    setEditValue(memory.value)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_memories')
      .update({ value: editValue.trim(), source: 'manual' })
      .eq('id', id)
      .eq('user_id', user.id)

    if (!error) {
      setMemories((prev: Memory[]) => prev.map((m: Memory) => m.id === id ? { ...m, value: editValue.trim(), source: 'manual' as const } : m))
      setEditingId(null)
      setEditValue('')
    }
  }

  const handleAdd = async () => {
    if (!newValue.trim()) return
    setIsSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setIsSaving(false); return }

    const key = newValue.trim()
      .toLowerCase()
      .replace(/[^a-z0-9àâäéèêëïîôùûüÿçæœ\s]/gi, '')
      .replace(/\s+/g, '_')
      .substring(0, 100)

    const { data, error } = await supabase
      .from('user_memories')
      .upsert({
        user_id: user.id,
        category: newCategory,
        key: `manual_${key}_${Date.now()}`,
        value: newValue.trim(),
        source: 'manual',
        confidence: 1.0,
      }, { onConflict: 'user_id,key' })
      .select()
      .single()

    if (!error && data) {
      setMemories((prev: Memory[]) => [data, ...prev])
      setNewValue('')
      setIsAdding(false)
    }
    setIsSaving(false)
  }

  const handleDeleteAll = async () => {
    if (!confirm('Supprimer TOUTE la mémoire ? Cette action est irréversible.')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('user_id', user.id)

    if (!error) setMemories([])
  }

  // Filtre et groupement
  const filtered = memories.filter((m: Memory) => {
    if (filterCategory && m.category !== filterCategory) return false
    if (searchQuery && !m.value.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const grouped = filtered.reduce((acc: Record<string, Memory[]>, m: Memory) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {} as Record<string, Memory[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#5C4B40]/10 rounded-xl">
            <Brain size={20} className="text-[#5C4B40]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#5C4B40]">Mémoire IA</h3>
            <p className="text-xs text-[#5C4B40]/50">
              {memories.length} souvenir{memories.length !== 1 ? 's' : ''} • L'IA se souvient de vous entre les conversations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMemories}
            className="p-2 text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw size={16} />
          </button>
          {memories.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="text-[10px] font-bold text-red-500/60 hover:text-red-600 uppercase tracking-widest px-3 py-1.5 hover:bg-red-50 rounded-lg transition-all"
            >
              Tout effacer
            </button>
          )}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C4B40]/20" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans la mémoire..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#5C4B40]/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#5C4B40]/10 focus:border-[#5C4B40]/20 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2 p-1.5 bg-[#5C4B40]/5 rounded-2xl w-fit border border-[#5C4B40]/5">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 border ${!filterCategory
              ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-lg shadow-[#5C4B40]/20 border-[#5C4B40]'
              : 'text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 border-transparent'
              }`}
          >
            Tout
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const count = memories.filter((m: Memory) => m.category === key).length
            if (count === 0) return null
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(filterCategory === key ? null : key)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 border flex items-center gap-2 ${filterCategory === key
                  ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-lg shadow-[#5C4B40]/20 border-[#5C4B40]'
                  : 'text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 border-transparent'
                  }`}
                title={cfg.label}
              >
                <cfg.icon size={13} strokeWidth={2.5} />
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${filterCategory === key ? 'bg-white/20 text-white' : 'bg-[#5C4B40]/10 text-[#5C4B40]'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Add Memory */}
      <AnimatePresence>
        {isAdding ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[#5C4B40]/60 uppercase tracking-widest">
                <Sparkles size={12} />
                Ajouter un souvenir
              </div>
              <div className="flex gap-2">
                <select
                  value={newCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewCategory(e.target.value)}
                  className="bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl px-3 py-2.5 text-xs font-bold text-[#5C4B40] focus:outline-none"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewValue(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAdd()}
                  placeholder="Ex: Je préfère les réponses concises et techniques"
                  className="flex-1 bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#5C4B40]/10"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setIsAdding(false); setNewValue('') }}
                  className="px-4 py-2 text-xs font-bold text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newValue.trim() || isSaving}
                  className="px-5 py-2 bg-[#5C4B40] text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : 'Sauvegarder'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 border-2 border-dashed border-[#5C4B40]/10 rounded-2xl text-xs font-bold text-[#5C4B40]/30 hover:text-[#5C4B40] hover:border-[#5C4B40]/30 hover:bg-white/40 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Ajouter un souvenir manuellement
          </button>
        )}
      </AnimatePresence>

      {/* Memory List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#5C4B40]/20">
          <Loader2 size={24} className="animate-spin mb-3" />
          <p className="text-xs font-bold uppercase tracking-widest">Chargement de la mémoire...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#5C4B40]/20">
          <Brain size={40} className="mb-4 opacity-30" />
          <p className="text-sm font-bold text-[#5C4B40]/30">
            {searchQuery ? 'Aucun résultat' : 'Aucune mémoire pour le moment'}
          </p>
          <p className="text-xs text-[#5C4B40]/20 mt-1">
            {searchQuery ? 'Essayez un autre terme' : "L'IA apprendra automatiquement au fil de vos conversations"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => {
            const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general
            const Icon = cfg.icon

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className={cfg.color} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/40">{cfg.label}</span>
                  <span className="text-[10px] text-[#5C4B40]/20 font-bold">{(items as Memory[]).length}</span>
                </div>
                <div className="space-y-2">
                  {(items as Memory[]).map((memory: Memory) => (
                    <motion.div
                      key={memory.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all ${cfg.bg} hover:shadow-sm`}
                    >
                      {editingId === memory.id ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') handleSaveEdit(memory.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="flex-1 bg-white border border-[#5C4B40]/20 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#5C4B40]/10"
                            autoFocus
                          />
                          <button onClick={() => handleSaveEdit(memory.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-all">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-2 text-red-400 hover:bg-red-100 rounded-lg transition-all">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#5C4B40] font-medium leading-relaxed">{memory.value}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${memory.source === 'auto' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                {memory.source === 'auto' ? '⚡ Auto' : '✍️ Manuel'}
                              </span>
                              <span className="text-[9px] text-[#5C4B40]/20 font-medium">
                                {new Date(memory.updated_at).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => handleEdit(memory)}
                              className="p-1.5 text-[#5C4B40]/30 hover:text-[#5C4B40] hover:bg-white rounded-lg transition-all"
                              title="Modifier"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(memory.id)}
                              className="p-1.5 text-red-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
