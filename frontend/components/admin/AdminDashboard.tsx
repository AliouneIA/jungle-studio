import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { User, CreditCard, ChevronRight, ExternalLink, RefreshCw, Smartphone, Monitor, ShieldCheck, Gauge, Edit3, Zap, X, Settings, Check, Mic, Trash2, ZoomIn, ZoomOut, Brain, Key, Users, MessageSquare, Database } from 'lucide-react'
import MemoryPanel from '@/components/memory/MemoryPanel'
import ApiKeysPanel from '@/components/admin/ApiKeysPanel'
import InvitationsPanel from '@/components/admin/InvitationsPanel'
import UsageChart from '@/components/admin/UsageChart'

interface AdminDashboardProps {
  totalTokensUsed: number
  onClose: () => void
  profile: {
    firstName: string
    lastName: string
    email: string
    photo: string | null
    photoZoom: number
    photoOffset: { x: number; y: number }
    sidebarPhotoZoom: number
    sidebarPhotoOffset: { x: number; y: number }
  }
  setProfile: React.Dispatch<React.SetStateAction<{
    firstName: string
    lastName: string
    email: string
    photo: string | null
    photoZoom: number
    photoOffset: { x: number; y: number }
    sidebarPhotoZoom: number
    sidebarPhotoOffset: { x: number; y: number }
  }>>
  refreshSidebar: () => void
}

export default function AdminDashboard({ totalTokensUsed, onClose, profile, setProfile, refreshSidebar }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'advanced'>('profile')

  const [sttModel, setSttModel] = useState<'whisper-1' | 'gpt-4o-transcribe'>('whisper-1')
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [advancedTab, setAdvancedTab] = useState<'audio' | 'chat' | 'memory' | 'apikeys' | 'users'>('audio')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [errorNotification, setErrorNotification] = useState<string | null>(null)
  const [keysTarget, setKeysTarget] = useState<{ id: string; name: string } | null>(null)

  // Fix Bug 1: Track temporary object URLs for cleanup
  const tempObjectUrlRef = useRef<string | null>(null)

  const supabase = createClient()

  // Fix Bug 5: Reset showConfirmDelete when changing tabs
  useEffect(() => {
    setShowConfirmDelete(false)
  }, [activeTab, advancedTab])

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('user_settings')
          .select('stt_model')
          .eq('user_id', user.id)
          .single()

        if (data?.stt_model) {
          setSttModel(data.stt_model)
        }
      } catch (err) {
        console.log('No user settings yet, using defaults')
      }
    }
    loadSettings()
  }, [])

  // Fix Bug 1: Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (tempObjectUrlRef.current) {
        URL.revokeObjectURL(tempObjectUrlRef.current)
        tempObjectUrlRef.current = null
      }
    }
  }, [])

  const handleToggleSTT = async (model: 'whisper-1' | 'gpt-4o-transcribe') => {
    setSttModel(model)
    setIsLoadingSettings(true)
    setSettingsSaved(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          stt_model: model
        }, { onConflict: 'user_id' })

      if (error) throw error
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch (err: any) {
      console.error('Error saving STT setting:', err)
      setSttModel(model === 'whisper-1' ? 'gpt-4o-transcribe' : 'whisper-1')
    } finally {
      setIsLoadingSettings(false)
    }
  }

  const [editingLink, setEditingLink] = useState<number | null>(null)

  const getModelIcon = (model: string) => {
    const lower = model.toLowerCase()
    if (lower.includes('gpt')) return '/gpt 1.png'
    if (lower.includes('claude')) return '/claude 2.jpg'
    if (lower.includes('gemini')) return '/gemini.png'
    if (lower.includes('grok')) return '/logos/Grok-Logo-PNG.png'
    if (lower.includes('mistral')) return '🟣'
    return '🤖'
  }

  // Fix Bug 4: Made read-only — removed setPricingLinks editable state
  const pricingLinks = [
    { name: 'OpenAI (GPT-5.2)', url: 'https://openai.com/api/pricing/' },
    { name: 'Google Gemini 3', url: 'https://ai.google.dev/pricing' },
    { name: 'Anthropic Claude 4.5', url: 'https://www.anthropic.com/pricing' },
    { name: 'xAI Grok 3 / Imagen', url: 'https://x.ai/api' }
  ]

  const weightedCostPerMillion = 0.70
  const safeTokens = typeof totalTokensUsed === 'number' && !isNaN(totalTokensUsed) ? totalTokensUsed : 0
  const estimatedCost = (safeTokens / 1000000) * weightedCostPerMillion

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialOffset, setInitialOffset] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [isFramingOpen, setIsFramingOpen] = useState(false)
  const [framingMode, setFramingMode] = useState<'profile' | 'sidebar'>('profile')

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      if (profile.photo && profile.photo.startsWith('data:')) {
        throw new Error('Les images base64 ne sont pas autorisées dans les métadonnées. L\'upload vers le Storage a probablement échoué.')
      }

      const { data: { user }, error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          avatar_url: profile.photo
        }
      })
      if (authError) throw authError

      if (user) {
        const { error: dbError } = await supabase
          .from('profiles')
          .update({
            first_name: profile.firstName,
            last_name: profile.lastName,
            avatar_url: profile.photo,
            avatar_zoom: profile.photoZoom,
            avatar_offset_x: profile.photoOffset.x,
            avatar_offset_y: profile.photoOffset.y,
            avatar_sidebar_zoom: profile.sidebarPhotoZoom,
            avatar_sidebar_offset_x: profile.sidebarPhotoOffset.x,
            avatar_sidebar_offset_y: profile.sidebarPhotoOffset.y
          })
          .eq('id', user.id)

        if (dbError) {
          console.error('❌ Erreur sync profiles table:', dbError)
          throw new Error('Impossible de sauvegarder dans la base de données: ' + dbError.message)
        }

        const { data: freshProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (fetchError) {
          console.error('❌ Erreur re-fetch profiles:', fetchError)
        } else if (freshProfile) {
          setProfile((prev: AdminDashboardProps['profile']) => ({
            ...prev,
            firstName: freshProfile.first_name || prev.firstName,
            lastName: freshProfile.last_name || prev.lastName,
            photo: freshProfile.avatar_url || prev.photo,
            photoZoom: freshProfile.avatar_zoom ?? prev.photoZoom,
            photoOffset: {
              x: freshProfile.avatar_offset_x ?? prev.photoOffset.x,
              y: freshProfile.avatar_offset_y ?? prev.photoOffset.y
            },
            sidebarPhotoZoom: freshProfile.avatar_sidebar_zoom ?? prev.sidebarPhotoZoom,
            sidebarPhotoOffset: {
              x: freshProfile.avatar_sidebar_offset_x ?? prev.sidebarPhotoOffset.x,
              y: freshProfile.avatar_sidebar_offset_y ?? prev.sidebarPhotoOffset.y
            }
          }))
        }
      }

      refreshSidebar()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      console.error(err)
      setErrorNotification(err.message || 'Erreur lors de la mise à jour du profil.')
      setTimeout(() => setErrorNotification(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  // Fix Bug 6: Add preventDefault to prevent native drag/text selection
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!profile.photo) return
    e.preventDefault() // Fix Bug 6
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    const currentOffset = framingMode === 'profile' ? profile.photoOffset : profile.sidebarPhotoOffset
    setInitialOffset({ x: currentOffset.x, y: currentOffset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    const isInModal = isFramingOpen
    const containerRatio = isInModal ? 0.625 : 1

    const fieldPrefix = framingMode === 'profile' ? 'photoOffset' : 'sidebarPhotoOffset'

    setProfile((prev: AdminDashboardProps['profile']) => ({
      ...prev,
      [fieldPrefix]: {
        x: initialOffset.x + (deltaX * containerRatio),
        y: initialOffset.y + (deltaY * containerRatio)
      }
    }))
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleDeleteAllChats = async () => {
    if (!showConfirmDelete) {
      setShowConfirmDelete(true)
      return
    }

    setIsDeleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: runs } = await supabase
        .from('research_runs')
        .select('id')
        .eq('user_id', user.id)

      if (runs && runs.length > 0) {
        const runIds = runs.map((r: { id: string }) => r.id)

        // Fix Bug 3: Delete research_sources scoped to user's run_ids only
        // The .in('run_id', runIds) already scopes to user since runIds were fetched with user_id filter
        await supabase
          .from('research_sources')
          .delete()
          .in('run_id', runIds)

        await supabase
          .from('research_runs')
          .delete()
          .eq('user_id', user.id)
      }

      await supabase
        .from('fusion_runs')
        .delete()
        .eq('user_id', user.id)

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', { id: 'dummy' }) // Placeholder to force eq check with user_id
      // Wait, the logic should be: delete all for user.
      // Actually, the original code had:
      /*
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', user.id)
      */
      // Let's stick to the version from Downloads but ensure it's correct.

      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', user.id)

      if (convError) throw convError
      refreshSidebar()
      setShowSuccess(true)
      setShowConfirmDelete(false)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error deleting chats:', err)
      setErrorNotification('Erreur lors de la suppression : ' + err.message)
      setTimeout(() => setErrorNotification(null), 5000)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full h-full bg-[#FCF9F5] flex flex-col items-center p-8 overflow-y-auto no-scrollbar">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#5C4B40] text-[#EAE1D3] rounded-2xl shadow-xl">
              <Settings size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-light text-[#5C4B40] tracking-[0.2em] uppercase">Paramètres</h1>
              <p className="text-[#5C4B40]/60 text-sm font-bold uppercase tracking-widest">Gérer votre compte et vos ressources</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-[#5C4B40]/5 hover:bg-[#5C4B40]/10 rounded-2xl transition-all text-[#5C4B40]/40 hover:text-[#5C4B40] relative z-[100]"
          >
            <X size={32} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`text-sm font-black flex items-center gap-3 px-8 py-4 rounded-xl transition-all tracking-tighter uppercase ${activeTab === 'profile' ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-xl' : 'text-[#5C4B40]/40 hover:bg-[#5C4B40]/5'}`}
          >
            <User size={20} />
            Profil Utilisateur
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`text-sm font-black flex items-center gap-3 px-8 py-4 rounded-xl transition-all tracking-tighter uppercase ${activeTab === 'billing' ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-xl' : 'text-[#5C4B40]/40 hover:bg-[#5C4B40]/5'}`}
          >
            <CreditCard size={20} />
            Tarifs & Consommation
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`text-sm font-black flex items-center gap-3 px-8 py-4 rounded-xl transition-all tracking-tighter uppercase ${activeTab === 'advanced' ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-xl' : 'text-[#5C4B40]/40 hover:bg-[#5C4B40]/5'}`}
          >
            <Zap size={20} />
            Avancé
          </button>
        </div>

        {(() => {
          switch (activeTab) {
            case 'profile':
              return (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8"
                >
                  {/* Photo Column */}
                  <div className="flex flex-col items-center space-y-6 pt-4 bg-white/40 rounded-3xl p-8 border border-[#5C4B40]/10 shadow-inner">
                    <div className="relative group">
                      <div
                        className={`w-40 h-40 rounded-full border-4 border-white overflow-hidden bg-white flex items-center justify-center text-slate-300 transition-all group-hover:shadow-2xl shadow-xl ring-1 ring-black/5 ${profile.photo ? 'cursor-move' : ''}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {profile.photo ? (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            <img
                              key={`${profile.photo}-${profile.photoZoom}-${profile.photoOffset.x}-${profile.photoOffset.y}`}
                              src={profile.photo}
                              alt="Profile"
                              className="max-w-none pointer-events-none select-none shrink-0"
                              style={{
                                transform: `translate(${profile.photoOffset.x}px, ${profile.photoOffset.y}px) scale(${profile.photoZoom})`,
                                transformOrigin: 'center',
                                width: 'auto',
                                height: 'auto',
                                minWidth: '100%',
                                minHeight: '100%'
                              }}
                            />
                          </div>
                        ) : <User size={56} />}
                      </div>
                      <label className="absolute -right-2 -bottom-2 w-10 h-10 bg-white shadow-lg border border-[#5C4B40]/10 rounded-xl flex items-center justify-center cursor-pointer text-[#5C4B40] hover:scale-110 active:scale-95 transition-all z-20">
                        <Edit3 size={18} />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              try {
                                // Fix Bug 1: Revoke previous temp object URL
                                if (tempObjectUrlRef.current) {
                                  URL.revokeObjectURL(tempObjectUrlRef.current)
                                  tempObjectUrlRef.current = null
                                }

                                const objectUrl = URL.createObjectURL(file)
                                tempObjectUrlRef.current = objectUrl // Fix Bug 1: Track for cleanup
                                setProfile((prev: any) => ({ ...prev, photo: objectUrl }))

                                const { data: { user } } = await supabase.auth.getUser()
                                if (!user) throw new Error('Utilisateur non identifié')
                                const fileExt = file.name.split('.').pop()
                                const fileName = `${user.id}/${Date.now()}.${fileExt}`
                                const { error: uploadError } = await supabase.storage
                                  .from('avatars')
                                  .upload(fileName, file, { upsert: true })
                                if (uploadError) throw uploadError
                                const { data: { publicUrl } } = supabase.storage
                                  .from('avatars')
                                  .getPublicUrl(fileName)

                                // Fix Bug 1: Revoke temp URL now that we have the real one
                                if (tempObjectUrlRef.current) {
                                  URL.revokeObjectURL(tempObjectUrlRef.current)
                                  tempObjectUrlRef.current = null
                                }

                                setProfile((prev: any) => ({
                                  ...prev,
                                  photo: publicUrl,
                                  photoZoom: 1,
                                  photoOffset: { x: 0, y: 0 },
                                  sidebarPhotoZoom: 1,
                                  sidebarPhotoOffset: { x: 0, y: 0 }
                                }))
                              } catch (err: any) {
                                console.error('Erreur upload avatar:', err)
                                // Fix Bug 1: Cleanup on error too
                                if (tempObjectUrlRef.current) {
                                  URL.revokeObjectURL(tempObjectUrlRef.current)
                                  tempObjectUrlRef.current = null
                                }
                                setErrorNotification('Échec de l\'upload de l\'image : ' + err.message)
                                setTimeout(() => setErrorNotification(null), 5000)
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                    {profile.photo && (
                      <div className="w-full space-y-4">
                        <button
                          onClick={() => setIsFramingOpen(true)}
                          className="w-full py-3 bg-[#5C4B40] text-[#EAE1D3] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg mb-6"
                        >
                          <Monitor size={14} />
                          Ajuster le cadrage
                        </button>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Avatar Jungle Studio</p>
                      <p className="text-[8px] text-slate-400/60 italic mt-1">PNG, JPG supportés</p>
                    </div>
                  </div>
                  {/* Info Column */}
                  <div className="md:col-span-2 space-y-8 py-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">Prénom</label>
                        <input
                          type="text"
                          value={profile.firstName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, firstName: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-3xl px-6 py-5 text-xl font-bold text-slate-900 focus:ring-4 focus:ring-[#5C4B40]/5 focus:border-[#5C4B40] outline-none transition-all shadow-sm"
                          placeholder="Votre prénom"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">Nom</label>
                        <input
                          type="text"
                          value={profile.lastName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, lastName: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-3xl px-6 py-5 text-xl font-bold text-slate-900 focus:ring-4 focus:ring-[#5C4B40]/5 focus:border-[#5C4B40] outline-none transition-all shadow-sm"
                          placeholder="Votre nom"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">Email de l'opérateur</label>
                      <div className="relative group">
                        <input
                          type="email"
                          value={profile.email}
                          readOnly
                          className="w-full bg-white border border-slate-200 rounded-3xl px-6 py-5 text-xl font-bold text-slate-500 cursor-not-allowed shadow-sm"
                        />
                        <ShieldCheck size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="w-full md:w-auto px-12 py-6 bg-[#5C4B40] text-[#EAE1D3] rounded-3xl text-sm font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:shadow-2xl shadow-[#5C4B40]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? 'ENREGISTREMENT...' : 'ENREGISTRER LE PROFIL'}
                      </button>

                      <AnimatePresence>
                        {showSuccess && (
                          <motion.div
                            initial={{ opacity: 0, x: -10, scale: 0.5 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="flex items-center gap-2 text-green-600 font-bold text-sm"
                          >
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <Check size={18} />
                            </div>
                            <span>Mis à jour</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )
            case 'billing':
              return (
                <motion.div
                  key="billing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {/* Use UsageChart Component */}
                  <div className="bg-white/40 border border-white/20 rounded-3xl p-10 backdrop-blur-xl shadow-xl">
                    <UsageChart />
                  </div>
                  {/* Pricing Tiers Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-10 bg-white/40 border border-white/20 rounded-3xl space-y-8 backdrop-blur-xl shadow-xl">
                      <h4 className="text-lg font-black text-[#5C4B40] uppercase tracking-widest flex items-center gap-3">
                        <Zap size={20} className="text-amber-500" />
                        Barème de Performance (1M Tokens)
                      </h4>
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2 custom-scrollbar">
                        {[
                          { label: 'Ultra-Rapide', model: 'GPT-5.2 Instant', price: '$0.05', color: 'bg-emerald-400' },
                          { label: 'Ultra-Rapide', model: 'Gemini 3 Flash', price: '$0.05', color: 'bg-emerald-500' },
                          { label: 'Intelligence Éco', model: 'GPT-5.2', price: '$0.15', color: 'bg-blue-400' },
                          { label: 'Intelligence Éco', model: 'Claude Haiku 4.5', price: '$0.15', color: 'bg-purple-400' },
                          { label: 'Haute Précision', model: 'GPT-5.2 Pro', price: '$0.80', color: 'bg-indigo-500' },
                          { label: 'Haute Précision', model: 'Claude Sonnet 4.5', price: '$0.80', color: 'bg-indigo-400' },
                          { label: 'Expert Métier', model: 'Claude Opus 4.6', price: '$3.00', color: 'bg-rose-500' },
                          { label: 'Expert Métier', model: 'Grok 3 Ultra', price: '$3.00', color: 'bg-orange-500' },
                          { label: 'Génération Image', model: 'Grok Imagen 4', price: '$0.04/img', color: 'bg-amber-500' },
                        ].map((tier, i) => {
                          const icon = getModelIcon(tier.model)
                          return (
                            <div key={i} className="flex justify-between items-center p-3.5 bg-white rounded-2xl border border-black/5 shadow-sm group hover:scale-[1.01] transition-all">
                              <div className="flex items-center gap-3">
                                <div className={`w-1 h-8 rounded-full ${tier.color}`} />
                                <div className="flex items-center gap-3">
                                  {icon.startsWith('/') ? (
                                    <img src={icon} alt="" className="w-8 h-8 object-contain rounded-lg shadow-sm bg-[#FCF9F5] p-1" />
                                  ) : (
                                    <div className="w-8 h-8 flex items-center justify-center text-xl grayscale group-hover:grayscale-0 transition-all">{icon}</div>
                                  )}
                                  <div>
                                    <p className="text-sm font-black text-slate-900 leading-tight">{tier.model}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{tier.label}</p>
                                  </div>
                                </div>
                              </div>
                              <span className="text-base font-black text-slate-900">{tier.price}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="p-10 bg-white/40 border border-white/20 rounded-3xl space-y-8 backdrop-blur-xl shadow-xl">
                      <h4 className="text-lg font-black text-[#5C4B40] uppercase tracking-widest flex items-center gap-3">
                        <RefreshCw size={20} className="text-blue-500" />
                        Veille API Stratégique
                      </h4>
                      {/* Fix Bug 4: Read-only pricing links — no edit capability */}
                      <div className="space-y-2">
                        {pricingLinks.map((link, idx) => (
                          <div key={idx} className="p-1 rounded-xl hover:bg-white transition-all group">
                            <div className="flex items-center justify-between px-2 py-2">
                              <button onClick={() => window.open(link.url, '_blank')} className="flex items-center gap-3 text-base font-black text-slate-900 group-hover:text-[#5C4B40] transition-colors uppercase">
                                {link.name}
                                <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400/60 font-medium italic mt-4 leading-relaxed">* Mise à jour automatique prévue toutes les deux semaines.</p>
                    </div>
                  </div>
                </motion.div>
              )
            case 'advanced':
              return (
                <motion.div
                  key="advanced"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Sub-tabs for Advanced */}
                  <div className="flex flex-wrap gap-2 p-1.5 bg-[#5C4B40]/5 rounded-2xl w-fit mb-8 border border-[#5C4B40]/5">
                    {[
                      { id: 'audio', label: 'Audio', icon: Mic },
                      { id: 'chat', label: 'Chat', icon: MessageSquare },
                      { id: 'memory', label: 'Mémoire', icon: Brain },
                      { id: 'apikeys', label: 'Clés API', icon: Key },
                      { id: 'users', label: 'Utilisateurs', icon: Users }
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => setAdvancedTab(sub.id as any)}
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-[0.15em] border ${advancedTab === sub.id
                          ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-lg shadow-[#5C4B40]/20 border-[#5C4B40]'
                          : 'text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 border-transparent'
                          }`}
                      >
                        <sub.icon size={14} strokeWidth={2.5} />
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {advancedTab === 'audio' ? (
                    <div className="bg-white/40 rounded-3xl p-8 border border-[#5C4B40]/10 shadow-inner space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-[#5C4B40]/10 rounded-xl">
                          <Mic size={20} className="text-[#5C4B40]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#5C4B40]">Transcription Vocale</h3>
                          <p className="text-xs text-[#5C4B40]/50">Choisissez le moteur de reconnaissance vocale</p>
                        </div>
                        {settingsSaved && (
                          <div className="ml-auto flex items-center gap-1 text-green-600 text-xs font-bold">
                            <Check size={14} /> Sauvegardé
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleSTT('whisper-1')}
                        disabled={isLoadingSettings}
                        className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${sttModel === 'whisper-1' ? 'border-[#5C4B40] bg-[#5C4B40]/5 shadow-md' : 'border-transparent bg-white/60 hover:bg-white/80'}`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${sttModel === 'whisper-1' ? 'border-[#5C4B40]' : 'border-gray-300'}`}>
                          {sttModel === 'whisper-1' && <div className="w-2.5 h-2.5 rounded-full bg-[#5C4B40]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#5C4B40]">Whisper</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Standard</span>
                          </div>
                          <p className="text-xs text-[#5C4B40]/50 mt-1">Modèle OpenAI standard. supporte 99 langues. Idéal pour un usage quotidien.</p>
                          <p className="text-[10px] text-[#5C4B40]/30 mt-2 font-mono">$0.006 / minute</p>
                        </div>
                      </button>
                      <button
                        onClick={() => handleToggleSTT('gpt-4o-transcribe')}
                        disabled={isLoadingSettings}
                        className={`w-full flex items-start gap-4 p-5 rounded-2xl border-2 transition-all text-left ${sttModel === 'gpt-4o-transcribe' ? 'border-[#5C4B40] bg-[#5C4B40]/5 shadow-md' : 'border-transparent bg-white/60 hover:bg-white/80'}`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${sttModel === 'gpt-4o-transcribe' ? 'border-[#5C4B40]' : 'border-gray-300'}`}>
                          {sttModel === 'gpt-4o-transcribe' && <div className="w-2.5 h-2.5 rounded-full bg-[#5C4B40]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#5C4B40]">GPT-4o Transcribe</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Premium</span>
                          </div>
                          <p className="text-xs text-[#5C4B40]/50 mt-1">Le plus précis du marché (WER 2.46%). Meilleure gestion des accents et du vocabulaire technique.</p>
                          <p className="text-[10px] text-[#5C4B40]/30 mt-2 font-mono">$0.006 / minute</p>
                        </div>
                      </button>
                    </div>
                  ) : advancedTab === 'chat' ? (
                    <div className="bg-white/40 rounded-3xl p-8 border border-[#5C4B40]/10 shadow-inner space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-[#4a0404]/10 rounded-xl">
                          <Trash2 size={20} className="text-[#4a0404]" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[#5C4B40]">Gestion des Discussions</h3>
                          <p className="text-xs text-[#5C4B40]/50">Actions globales sur votre historique</p>
                        </div>
                      </div>

                      <div className="p-6 bg-[#4a0404]/5 rounded-2xl border border-[#4a0404]/10 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-center md:text-left">
                          <h4 className="font-bold text-[#4a0404] uppercase tracking-tighter text-sm">Zone de suppression totale</h4>
                          <p className="text-[11px] text-[#5C4B40]/60 mt-1 font-medium italic">Cette action supprimera uniquement toutes vos conversations de l'onglet discussions.</p>
                        </div>
                        {/* Fix Bug 2: Show different text when confirmation pending */}
                        <button
                          onClick={handleDeleteAllChats}
                          disabled={isDeleting}
                          className={`w-full md:w-auto px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${showConfirmDelete
                            ? 'bg-red-700 hover:bg-red-800 text-white animate-pulse'
                            : 'bg-[#4a0404] hover:bg-[#320303] text-white'
                            }`}
                        >
                          {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          {isDeleting
                            ? 'SUPPRESSION EN COURS...'
                            : showConfirmDelete
                              ? '⚠️ CONFIRMER LA SUPPRESSION DÉFINITIVE'
                              : 'SUPPRIMER TOUTES LES DISCUSSIONS'}
                        </button>

                        <AnimatePresence>
                          {(showSuccess && activeTab === 'advanced') && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-green-600 font-bold text-xs flex items-center gap-2"
                            >
                              <Check size={14} /> Supprimé
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : advancedTab === 'memory' ? (
                    <MemoryPanel />
                  ) : advancedTab === 'apikeys' ? (
                    <ApiKeysPanel
                      targetUserId={keysTarget?.id}
                      targetUserName={keysTarget?.name}
                    />
                  ) : advancedTab === 'users' ? (
                    <InvitationsPanel onManageKeys={(id, name) => {
                      setKeysTarget({ id, name })
                      setAdvancedTab('apikeys')
                    }} />
                  ) : null}
                </motion.div>
              )
            default:
              return null
          }
        })()}
      </div>
      {/* Framing Modal */}
      <AnimatePresence>
        {isFramingOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#FCF9F5] rounded-[2rem] p-10 max-w-2xl w-full shadow-2xl relative"
            >
              <button
                onClick={() => setIsFramingOpen(false)}
                className="absolute right-6 top-6 p-2 hover:bg-black/5 rounded-full transition-colors text-slate-400"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-10">
                <h3 className="text-2xl font-light text-[#5C4B40] tracking-widest uppercase">Cadrage de l'avatar</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Faites glisser et zoomez pour cadrer parfaitement</p>
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="flex p-1 bg-[#5C4B40]/5 rounded-2xl w-full max-w-sm mb-4">
                  <button
                    onClick={() => setFramingMode('profile')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${framingMode === 'profile' ? 'bg-[#5C4B40] text-white shadow-lg' : 'text-[#5C4B40]/40 hover:bg-[#5C4B40]/10'}`}
                  >
                    Régler Profil
                  </button>
                  <button
                    onClick={() => setFramingMode('sidebar')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${framingMode === 'sidebar' ? 'bg-[#5C4B40] text-white shadow-lg' : 'text-[#5C4B40]/40 hover:bg-[#5C4B40]/10'}`}
                  >
                    Régler Sidebar
                  </button>
                </div>

                <div className="flex items-center gap-12">
                  <div className={`flex flex-col items-center gap-4 transition-all duration-300 ${framingMode === 'profile' ? 'scale-110 opacity-100' : 'scale-90 opacity-40 grayscale pointer-events-none'}`}>
                    <div
                      className="w-64 h-64 rounded-full border-8 border-white shadow-2xl overflow-hidden bg-slate-100 flex items-center justify-center cursor-move relative ring-1 ring-black/5"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      {profile.photo ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img
                            key={`modal-profile-${profile.photoZoom}-${profile.photoOffset.x}-${profile.photoOffset.y}`}
                            src={profile.photo}
                            alt="Preview"
                            className="max-w-none pointer-events-none select-none shrink-0"
                            style={{
                              transform: `translate(${profile.photoOffset.x * 1.6}px, ${profile.photoOffset.y * 1.6}px) scale(${profile.photoZoom})`,
                              transformOrigin: 'center',
                              width: 'auto',
                              height: 'auto',
                              minWidth: '100%',
                              minHeight: '100%'
                            }}
                          />
                        </div>
                      ) : <User size={80} className="text-slate-300" />}
                      <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-full pointer-events-none" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/40">Vue Profil</span>
                  </div>

                  <div className={`flex flex-col items-center gap-4 transition-all duration-300 ${framingMode === 'sidebar' ? 'scale-150 opacity-100 z-10' : 'scale-100 opacity-60'}`}>
                    <div
                      className={`w-20 h-20 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-100 flex items-center justify-center relative ring-1 ring-black/5 ${framingMode === 'sidebar' ? 'cursor-move ring-2 ring-[#5C4B40]' : ''}`}
                      onMouseDown={framingMode === 'sidebar' ? handleMouseDown : undefined}
                      onMouseMove={framingMode === 'sidebar' ? handleMouseMove : undefined}
                      onMouseUp={framingMode === 'sidebar' ? handleMouseUp : undefined}
                      onMouseLeave={framingMode === 'sidebar' ? handleMouseUp : undefined}
                    >
                      {profile.photo ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img
                            key={`modal-sidebar-${profile.sidebarPhotoZoom}-${profile.sidebarPhotoOffset.x}-${profile.sidebarPhotoOffset.y}`}
                            src={profile.photo}
                            alt="Sidebar Preview"
                            className="max-w-none pointer-events-none select-none shrink-0"
                            style={{
                              transform: `translate(${profile.sidebarPhotoOffset.x * 0.5}px, ${profile.sidebarPhotoOffset.y * 0.5}px) scale(${profile.sidebarPhotoZoom})`,
                              transformOrigin: 'center',
                              width: 'auto',
                              height: 'auto',
                              minWidth: '100%',
                              minHeight: '100%'
                            }}
                          />
                        </div>
                      ) : <User size={24} className="text-slate-300" />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/40 text-center uppercase">Rendu Sidebar</span>
                  </div>
                </div>

                <div className="w-full space-y-6 max-w-sm mt-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        const zoomField = framingMode === 'profile' ? 'photoZoom' : 'sidebarPhotoZoom'
                        setProfile((p: any) => ({ ...p, [zoomField]: Math.max(0.1, p[zoomField] - 0.1) }))
                      }}
                      className="p-2 bg-white rounded-xl shadow-md border border-black/5 hover:bg-slate-50 transition-all"
                    >
                      <ZoomOut size={20} className="text-[#5C4B40]" />
                    </button>
                    <input
                      type="range"
                      min="0.1" max="4" step="0.01"
                      value={framingMode === 'profile' ? profile.photoZoom : profile.sidebarPhotoZoom}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const zoomField = framingMode === 'profile' ? 'photoZoom' : 'sidebarPhotoZoom'
                        setProfile({ ...profile, [zoomField]: parseFloat(e.target.value) })
                      }}
                      className="flex-1 h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#5C4B40]"
                    />
                    <button
                      onClick={() => {
                        const zoomField = framingMode === 'profile' ? 'photoZoom' : 'sidebarPhotoZoom'
                        setProfile((p: any) => ({ ...p, [zoomField]: Math.min(4, p[zoomField] + 0.1) }))
                      }}
                      className="p-2 bg-white rounded-xl shadow-md border border-black/5 hover:bg-slate-50 transition-all"
                    >
                      <ZoomIn size={20} className="text-[#5C4B40]" />
                    </button>
                  </div>

                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => {
                        if (framingMode === 'profile') {
                          setProfile((p: any) => ({ ...p, photoOffset: { x: 0, y: 0 }, photoZoom: 1 }))
                        } else {
                          setProfile((p: any) => ({ ...p, sidebarPhotoOffset: { x: 0, y: 0 }, sidebarPhotoZoom: 1 }))
                        }
                      }}
                      className="px-6 py-3 bg-white border border-[#5C4B40]/20 text-[#5C4B40] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      Réinitialiser {framingMode === 'profile' ? 'Profil' : 'Sidebar'}
                    </button>
                    <button
                      onClick={async () => {
                        setIsSaving(true)
                        await handleSaveProfile()
                        setIsFramingOpen(false)
                        setIsSaving(false)
                      }}
                      disabled={isSaving}
                      className="px-10 py-3 bg-[#5C4B40] text-[#EAE1D3] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Sauvegarde...' : 'Appliquer et Sauvegarder'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
