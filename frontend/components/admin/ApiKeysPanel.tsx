'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Plus, Trash2, Eye, EyeOff, Check, X, Loader2, Shield, AlertCircle, RefreshCw, ToggleLeft, ToggleRight, Users, ChevronDown, UserCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface ApiKey {
  id: string
  provider: string
  label: string
  key_hint: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Collaborator {
  user_id: string
  email: string
  nickname: string
}

const PROVIDERS: Record<string, { label: string; icon: string; placeholder: string; color: string; bg: string; docsUrl: string }> = {
  openai: {
    label: 'OpenAI',
    icon: '🤖',
    placeholder: 'sk-proj-...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    icon: '🧠',
    placeholder: 'sk-ant-...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  },
  google: {
    label: 'Google AI (Gemini)',
    icon: '💎',
    placeholder: 'AIza...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://aistudio.google.com/apikey'
  },
  xai: {
    label: 'xAI (Grok)',
    icon: '⚡',
    placeholder: 'xai-...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://console.x.ai/'
  },
  mistral: {
    label: 'Mistral AI',
    icon: '🌊',
    placeholder: 'sk-...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://console.mistral.ai/api-keys/'
  },
  perplexity: {
    label: 'Perplexity',
    icon: '🔍',
    placeholder: 'pplx-...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://www.perplexity.ai/settings/api'
  },
  elevenlabs: {
    label: 'ElevenLabs (TTS)',
    icon: '🎙️',
    placeholder: 'sk_...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys'
  },
  replicate: {
    label: 'Replicate',
    icon: '🔄',
    placeholder: 'r8_...',
    color: 'text-[#5C4B40]',
    bg: 'bg-[#5C4B40]/5 border-[#5C4B40]/10',
    docsUrl: 'https://replicate.com/account/api-tokens'
  },
}

interface ApiKeysPanelProps {
  targetUserId?: string | null
  targetUserName?: string | null
}

export default function ApiKeysPanel({ targetUserId: externalTargetUserId = null, targetUserName: externalTargetName = null }: ApiKeysPanelProps) {
  const supabase = createClient()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Collaborator management
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [selectedCollaborator, setSelectedCollaborator] = useState<string | null>(externalTargetUserId || null)
  const [showCollabDropdown, setShowCollabDropdown] = useState(false)
  const [isLoadingCollabs, setIsLoadingCollabs] = useState(false)

  // Sync external target
  useEffect(() => {
    setSelectedCollaborator(externalTargetUserId || null)
  }, [externalTargetUserId])

  const getApiUrl = (action: string, extraParams = '') => {
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-keys?action=${action}`
    const forUser = selectedCollaborator ? `&for_user_id=${selectedCollaborator}` : ''
    return `${base}${forUser}${extraParams}`
  }

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non authentifié')
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      'Content-Type': 'application/json'
    }
  }

  const fetchCollaborators = useCallback(async () => {
    setIsLoadingCollabs(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api-keys?action=collaborators`, { headers })
      const result = await res.json()
      if (result.collaborators) setCollaborators(result.collaborators)
    } catch (err) {
      console.error('[ApiKeysPanel] Collabs fetch error:', err)
    } finally {
      setIsLoadingCollabs(false)
    }
  }, [supabase])

  const fetchKeys = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await getHeaders()
      const res = await fetch(getApiUrl('list'), { headers })
      const result = await res.json()
      if (result.keys) setKeys(result.keys)
    } catch (err) {
      console.error('[ApiKeysPanel] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [supabase, selectedCollaborator])

  useEffect(() => {
    fetchKeys()
    fetchCollaborators()
  }, [fetchKeys])

  // Re-fetch keys when collaborator changes
  useEffect(() => {
    fetchKeys()
  }, [selectedCollaborator])

  const handleSaveKey = async () => {
    if (!newKeyValue.trim()) return
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const headers = await getHeaders()

      const res = await fetch(getApiUrl('save'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProvider,
          api_key: newKeyValue.trim(),
          label: PROVIDERS[selectedProvider]?.label || selectedProvider
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erreur sauvegarde')

      if (result.key) {
        setKeys(prev => {
          const existing = prev.findIndex(k => k.provider === selectedProvider)
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = result.key
            return updated
          }
          return [...prev, result.key]
        })
        const target = selectedCollaborator
          ? collaborators.find(c => c.user_id === selectedCollaborator)?.nickname || 'collaborateur'
          : 'vous'
        setSuccess(`Clé ${PROVIDERS[selectedProvider]?.label} sauvegardée pour ${target} ✓`)
        setNewKeyValue('')
        setIsAdding(false)
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (provider: string) => {
    const providerLabel = PROVIDERS[provider]?.label || provider
    if (!confirm(`Supprimer la clé ${providerLabel} ? Cette action est irréversible.`)) return

    try {
      const headers = await getHeaders()
      const res = await fetch(getApiUrl('delete', `&provider=${provider}`), {
        method: 'DELETE',
        headers
      })
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.provider !== provider))
      }
    } catch (err) {
      console.error('[ApiKeysPanel] Delete error:', err)
    }
  }

  const handleToggle = async (provider: string, currentState: boolean) => {
    try {
      const headers = await getHeaders()
      const res = await fetch(getApiUrl('toggle'), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ provider, is_active: !currentState })
      })
      if (res.ok) {
        setKeys(prev => prev.map(k => k.provider === provider ? { ...k, is_active: !currentState } : k))
      }
    } catch (err) {
      console.error('[ApiKeysPanel] Toggle error:', err)
    }
  }

  const availableProviders = Object.keys(PROVIDERS).filter(p => !keys.some(k => k.provider === p))
  const currentTarget = selectedCollaborator
    ? collaborators.find(c => c.user_id === selectedCollaborator) || (externalTargetName ? { user_id: selectedCollaborator, email: '', nickname: externalTargetName } : null)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#5C4B40]/10 rounded-xl">
            <Key size={20} className="text-[#5C4B40]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#5C4B40]">Clés API</h3>
            <p className="text-xs text-[#5C4B40]/50">
              {keys.length} clé{keys.length !== 1 ? 's' : ''} configurée{keys.length !== 1 ? 's' : ''} • Chiffrement AES-256
              {currentTarget && (
                <span className="ml-1 text-amber-600 font-bold">
                  • pour {currentTarget.nickname}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchKeys}
            className="p-2 text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Collaborator Selector */}
      {collaborators.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowCollabDropdown(!showCollabDropdown)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedCollaborator
                ? 'border-amber-300 bg-amber-50'
                : 'border-[#5C4B40]/10 bg-white hover:border-[#5C4B40]/20'
              }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCollaborator ? 'bg-amber-200' : 'bg-[#5C4B40]/5'
              }`}>
              {selectedCollaborator ? (
                <Users size={14} className="text-amber-700" />
              ) : (
                <UserCircle size={14} className="text-[#5C4B40]/40" />
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-[#5C4B40]">
                {selectedCollaborator
                  ? `Clés de ${currentTarget?.nickname || 'collaborateur'}`
                  : 'Mes clés personnelles'}
              </p>
              <p className="text-[9px] text-[#5C4B40]/40">
                {selectedCollaborator
                  ? currentTarget?.email
                  : 'Gérer mes propres clés API'}
              </p>
            </div>
            <ChevronDown size={14} className={`text-[#5C4B40]/30 transition-transform ${showCollabDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showCollabDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-[#5C4B40]/10 rounded-xl shadow-lg overflow-hidden"
              >
                {/* Self */}
                <button
                  onClick={() => { setSelectedCollaborator(null); setShowCollabDropdown(false) }}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-[#F8F6F2] transition-colors ${!selectedCollaborator ? 'bg-[#F8F6F2] font-bold' : ''
                    }`}
                >
                  <UserCircle size={14} className="text-[#5C4B40]/40" />
                  <div>
                    <p className="text-xs font-bold text-[#5C4B40]">Mes clés personnelles</p>
                  </div>
                </button>

                {/* Separator */}
                <div className="border-t border-[#5C4B40]/5 mx-3" />
                <p className="px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/20">Collaborateurs</p>

                {collaborators.map(collab => (
                  <button
                    key={collab.user_id}
                    onClick={() => { setSelectedCollaborator(collab.user_id); setShowCollabDropdown(false) }}
                    className={`w-full flex items-center gap-3 p-3 text-left hover:bg-[#F8F6F2] transition-colors ${selectedCollaborator === collab.user_id ? 'bg-amber-50 font-bold' : ''
                      }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-black text-amber-700">
                      {collab.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#5C4B40]">{collab.nickname}</p>
                      <p className="text-[9px] text-[#5C4B40]/40">{collab.email}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Context Banner when managing collaborator */}
      {selectedCollaborator && currentTarget && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Users size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            Vous gérez les clés API de <strong>{currentTarget.nickname}</strong> ({currentTarget.email}).
            Ces clés seront utilisées pour ses requêtes personnelles.
          </p>
          <button
            onClick={() => setSelectedCollaborator(null)}
            className="shrink-0 text-[9px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-widest"
          >
            Retour
          </button>
        </div>
      )}

      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 bg-[#5C4B40]/5 border border-[#5C4B40]/10 rounded-2xl">
        <Shield size={16} className="text-[#5C4B40] mt-0.5 shrink-0" />
        <div className="text-xs text-[#5C4B40]/70 leading-relaxed font-medium">
          <strong className="text-[#5C4B40]">Sécurité :</strong> Vos clés sont chiffrées avec AES-256 (pgcrypto) avant stockage.
          Elles ne sont jamais visibles en clair après enregistrement. Seul le serveur peut les déchiffrer
          pour appeler les APIs en votre nom.
        </div>
      </div>

      {/* Success / Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium"
          >
            <Check size={14} /> {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium"
          >
            <AlertCircle size={14} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing Keys */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#5C4B40]/20">
          <Loader2 size={24} className="animate-spin mb-3" />
          <p className="text-xs font-bold uppercase tracking-widest">Chargement...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(key => {
            const cfg = PROVIDERS[key.provider] || { label: key.provider, icon: '🔑', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', docsUrl: '#' }
            return (
              <motion.div
                key={key.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${cfg.bg} ${!key.is_active ? 'opacity-50' : ''}`}
              >
                <span className="text-2xl">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                    {!key.is_active && (
                      <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">
                        Désactivée
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-[11px] text-[#5C4B40]/40 font-mono bg-white/60 px-2 py-0.5 rounded">
                      {key.key_hint}
                    </code>
                    <span className="text-[9px] text-[#5C4B40]/20">
                      {new Date(key.updated_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggle(key.provider, key.is_active)}
                    className="p-2 text-[#5C4B40]/30 hover:text-[#5C4B40] rounded-lg transition-all hover:bg-white/60"
                    title={key.is_active ? 'Désactiver' : 'Activer'}
                  >
                    {key.is_active ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(key.provider)}
                    className="p-2 text-red-300 hover:text-red-500 rounded-lg transition-all hover:bg-white/60"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            )
          })}

          {keys.length === 0 && !isLoading && (
            <div className="text-center py-8 text-[#5C4B40]/20">
              <Key size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-xs font-bold text-[#5C4B40]/30">
                {selectedCollaborator
                  ? `Aucune clé configurée pour ${currentTarget?.nickname || 'ce collaborateur'}`
                  : 'Aucune clé API personnelle'}
              </p>
              <p className="text-[10px] text-[#5C4B40]/20 mt-1">
                Les clés du projet (variables d'environnement) sont utilisées par défaut
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Key Form */}
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
                <Shield size={12} />
                Ajouter une clé API
                {currentTarget && (
                  <span className="text-amber-600 normal-case tracking-normal font-bold">
                    pour {currentTarget.nickname}
                  </span>
                )}
              </div>

              {/* Provider Select */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#5C4B40]/40 block mb-2">Fournisseur</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableProviders.map(provider => {
                    const cfg = PROVIDERS[provider]
                    return (
                      <button
                        key={provider}
                        onClick={() => setSelectedProvider(provider)}
                        className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${selectedProvider === provider
                            ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-lg border-[#5C4B40] scale-105'
                            : 'bg-white border-[#5C4B40]/10 hover:border-[#5C4B40]/30 text-[#5C4B40]/60'
                          }`}
                      >
                        <span className="text-2xl filter drop-shadow-sm">{cfg.icon}</span>
                        <span className={`text-[9px] font-black uppercase tracking-[0.1em] text-center ${selectedProvider === provider ? 'text-[#EAE1D3]' : 'text-[#5C4B40]'}`}>{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Key Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#5C4B40]/40">Clé API</label>
                  <a
                    href={PROVIDERS[selectedProvider]?.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 uppercase tracking-widest"
                  >
                    Obtenir une clé →
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                    placeholder={PROVIDERS[selectedProvider]?.placeholder || 'Collez votre clé API ici...'}
                    className="w-full bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl px-4 py-3 pr-12 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#5C4B40]/10 focus:border-[#5C4B40]/20 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C4B40]/30 hover:text-[#5C4B40] transition-colors"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setIsAdding(false); setNewKeyValue(''); setError(null) }}
                  className="px-4 py-2.5 text-xs font-bold text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveKey}
                  disabled={!newKeyValue.trim() || isSaving}
                  className="px-6 py-2.5 bg-[#5C4B40] text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Shield size={12} />
                  )}
                  {isSaving ? 'Chiffrement...' : 'Chiffrer et sauvegarder'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : availableProviders.length > 0 ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3.5 border-2 border-dashed border-[#5C4B40]/10 rounded-2xl text-xs font-bold text-[#5C4B40]/30 hover:text-[#5C4B40] hover:border-[#5C4B40]/30 hover:bg-white/40 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            Ajouter une clé API
            {currentTarget && (
              <span className="text-amber-500">pour {currentTarget.nickname}</span>
            )}
          </button>
        ) : (
          <div className="text-center py-6 text-xs text-[#5C4B40]/30 font-medium">
            Toutes les clés API supportées sont configurées ✓
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
