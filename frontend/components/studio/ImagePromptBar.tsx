import StyleModal from './StyleModal'
import { useFusionEngine } from '@/hooks/useFusionEngine'
import { createClient } from '@/utils/supabase/client'
import React, { useState, useRef, useEffect } from 'react'
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea'
import { Palette, Mic, Loader2, Send, ChevronDown, Check, Settings2, Plus, Diamond, Minus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

const MODELS = [
  { id: 'nano-banana-pro', name: 'Nano Banana Pro (Google)', icon: '🍌' },
  {
    id: 'grok-imagine-pro',
    name: 'Grok Imagine Pro (xAI)',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
  },
  { id: 'seedream-4.5', name: 'Seedream 4.5 (ByteDance)', icon: '✨' }
]

const RATIOS = [
  { id: '1:1', name: '1:1 (Carré)', icon: '⬛' },
  { id: '16:9', name: '16:9 (Paysage)', icon: '📺' },
  { id: '9:16', name: '9:16 (Portrait)', icon: '📱' },
  { id: '4:3', name: '4:3 (Standard)', icon: '🖼️' },
  { id: '3:2', name: '3:2 (Photo)', icon: '📷' }
]

const DiamondIcon = ({ size = 14, className = "" }: { size?: number, className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 3h12l4 8-10 10L2 11l4-8z" />
    <path d="M2 11h20" />
    <path d="M10 3l-2 8 4 10 4-10-2-8" />
  </svg>
)

const QUALITIES = [
  { id: 'standard', name: '1K', icon: <DiamondIcon /> },
  { id: 'hd', name: '2K', icon: <DiamondIcon className="fill-white/10" /> },
  { id: '4k', name: '4K', icon: <DiamondIcon className="fill-white/30" /> }
]

const COUNTS = [1, 2, 4, 8]

const PRESET_STYLES = [
  { id: 'none', name: 'Aucun (naturel)', description: '' },
  { id: 'cinematic', name: 'Cinématique', description: 'Cinematic lighting, high resolution, movie still, deep shadows, 8k, detailed textures' },
  { id: 'photorealistic', name: 'Photoréaliste', description: 'Photorealistic, ultra-detailed, sharp focus, 8k raw photo, DSLR, realistic textures, natural lighting' },
  { id: 'digital-illustration', name: 'Illustration digitale', description: 'Digital illustration, clean lines, vibrant colors, polished, professional digital art, trending on ArtStation' },
  { id: 'anime', name: 'Anime / Manga', description: 'Anime style, Japanese manga aesthetics, bold lines, cel shading, high quality anime art' },
  { id: '3d-render', name: '3D Render', description: '3D render, Octane render, Unreal Engine 5, Raytracing, masterpiece, intricate detail, metallic surfaces' },
  { id: 'watercolor', name: 'Aquarelle', description: 'Watercolor painting, soft edges, paper texture, artistic ink washes, traditional medium' },
  { id: 'pixel-art', name: 'Pixel Art', description: 'Pixel art, 8-bit, 16-bit, retro gaming aesthetic, sharp pixels' },
  { id: 'cyberpunk', name: 'Néon / Cyberpunk', description: 'Cyberpunk, neon lights, rainy streets, futuristic city, glow effects, hyperrealistic' },
  { id: 'retro', name: 'Rétro / Vintage', description: 'Retro vintage style, 70s film grain, faded colors, nostalgic atmosphere' }
]

export interface ImagePromptBarProps {
  onGenerated?: () => void
  initialPrompt?: string
  variationKey?: number
  onVariationConsumed?: () => void
}

export default function ImagePromptBar({ onGenerated, initialPrompt = '', variationKey, onVariationConsumed }: ImagePromptBarProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState(RATIOS[0])
  const [selectedQuality, setSelectedQuality] = useState(QUALITIES[0])
  const [selectedCount, setSelectedCount] = useState(1)
  const [selectedStyle, setSelectedStyle] = useState(PRESET_STYLES[0])
  const [customStyles, setCustomStyles] = useState<{ id: string; name: string; description: string }[]>([])
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [styleTab, setStyleTab] = useState<'explorer' | 'create'>('explorer')
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false)
  const [newStyleName, setNewStyleName] = useState('')
  const [newStyleDesc, setNewStyleDesc] = useState('')

  const controlsRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { status } = useFusionEngine()

  useEffect(() => {
    const fetchStyles = async () => {
      const { data } = await createClient().from('studio_styles').select('*').order('created_at', { ascending: false })
      if (data) setCustomStyles(data)
    }
    fetchStyles()
  }, [])

  // Consommer les variations de prompt injectées depuis le panneau de détail
  useEffect(() => {
    if (variationKey && initialPrompt) {
      setPrompt(initialPrompt)
      onVariationConsumed?.()
    }
  }, [variationKey])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (controlsRef.current && !controlsRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt)
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }
  }, [initialPrompt])

  useAutoResizeTextarea(textareaRef, prompt)

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
  }

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name)
  }

  const handleSaveCustomStyle = async (style: { name: string; description: string }) => {
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return

      const { data, error } = await createClient()
        .from('studio_styles')
        .insert({
          user_id: user.id,
          name: style.name,
          description: style.description
        })
        .select()
        .single()

      if (error) {
        console.error("Supabase Error:", error)
        return
      }

      if (data) {
        setCustomStyles([...customStyles, data])
        setSelectedStyle(data)
      }
    } catch (err) {
      console.error("Failed to save style to DB:", err)
    }
  }

  const handleDeleteCustomStyle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const { error } = await createClient()
        .from('studio_styles')
        .delete()
        .eq('id', id)

      if (error) {
        console.error("Supabase Error deleting style:", error)
        return
      }

      setCustomStyles(customStyles.filter(s => s.id !== id))
      if (selectedStyle.id === id) {
        setSelectedStyle(PRESET_STYLES[0])
      }
    } catch (err) {
      console.error("Failed to delete style:", err)
    }
  }

  const handleSend = async () => {
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Rechercher la description du style
      const customStyle = customStyles.find(s => s.id === selectedStyle.id)
      const presetStyle = PRESET_STYLES.find(s => s.id === selectedStyle.id)
      const styleDesc = customStyle?.description || presetStyle?.description || ''

      const { data: { session } } = await supabase.auth.getSession()
      console.log('[StudioImages] Token algo:', session?.access_token ?
        JSON.parse(atob(session.access_token.split('.')[0])).alg : 'NO TOKEN')
      console.log('[StudioImages] User ID:', session?.user?.id)

      const { data, error } = await supabase.functions.invoke('studio-generate', {
        body: {
          prompt: prompt.trim(),
          model: selectedModel.id,
          count: selectedCount,
          ratio: selectedRatio.id,
          quality: selectedQuality.id,
          style: selectedStyle.name,
          style_description: styleDesc,
          user_id: user.id
        }
      })

      if (error) throw error

      setPrompt('')
      if (textareaRef.current) textareaRef.current.style.height = '40px'

      // Petit délai pour laisser le temps à la base de données de se mettre à jour
      setTimeout(() => {
        if (onGenerated) onGenerated()
      }, 1000)
    } catch (err) {
      console.error("Studio generation failed:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto z-40 px-4 pb-6">

      <div className="p-3 bg-white/60 border border-white/40 backdrop-blur-2xl shadow-2xl rounded-2xl flex flex-col gap-2 relative">

        {/* Top Row: Controls (Model, Ratio, Quality, Count, Style) */}
        <div ref={controlsRef} className="flex items-center gap-2 px-1 flex-wrap min-h-[32px] relative z-20">

          {/* Modèle Select - Logo Only */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('model')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white/80 hover:bg-white rounded-full transition-all border border-white/40 shadow-sm cursor-pointer min-w-[32px]"
              title={`Modèle : ${selectedModel.name}`}
            >
              <span className="text-sm">{selectedModel.icon}</span>
              <ChevronDown size={10} className={`text-secondary/60 transition-transform ${activeDropdown === 'model' ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {activeDropdown === 'model' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 min-w-[200px] bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-[100] p-1.5"
                >
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m); setActiveDropdown(null) }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg transition-colors ${selectedModel.id === m.id ? 'bg-secondary/15 font-bold' : 'hover:bg-secondary/10'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span>{m.icon}</span>
                        <span>{m.name}</span>
                      </div>
                      {selectedModel.id === m.id && <div className="w-1.5 h-1.5 rounded-full bg-[#800000] ml-auto" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Ratio Select - Logo Only */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('ratio')}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#F5F5F0] hover:bg-[#EAEAE5] rounded-xl transition-all border border-[#5C4B40]/10 shadow-sm cursor-pointer min-w-[70px]"
              title={`Ratio : ${selectedRatio.name}`}
            >
              <div className="text-[#5C4B40]/70">
                {selectedRatio.icon}
              </div>
              <span className="text-[11px] font-black text-[#5C4B40] tracking-tighter">{selectedRatio.id}</span>
            </button>

            <AnimatePresence>
              {activeDropdown === 'ratio' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 min-w-[180px] bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-[100] p-1.5"
                >
                  {RATIOS.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedRatio(r); setActiveDropdown(null) }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg transition-colors ${selectedRatio.id === r.id ? 'bg-secondary/15 font-bold' : 'hover:bg-secondary/10'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span>{r.icon}</span>
                        <span>{r.name}</span>
                      </div>
                      {selectedRatio.id === r.id && <div className="w-1.5 h-1.5 rounded-full bg-[#800000] ml-auto" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Qualité Select - Logo Only */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown('quality')}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#F5F5F0] hover:bg-[#EAEAE5] rounded-xl transition-all border border-[#5C4B40]/10 shadow-sm cursor-pointer min-w-[60px]"
              title={`Qualité : ${selectedQuality.name}`}
            >
              <div className="text-[#800000]">
                {selectedQuality.icon}
              </div>
              <span className="text-[11px] font-black text-[#5C4B40] tracking-tighter">{selectedQuality.name}</span>
            </button>

            <AnimatePresence>
              {activeDropdown === 'quality' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 min-w-[180px] bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-[100] p-1.5"
                >
                  {QUALITIES.map(q => (
                    <button
                      key={q.id}
                      onClick={() => { setSelectedQuality(q); setActiveDropdown(null) }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg transition-colors ${selectedQuality.id === q.id ? 'bg-secondary/15 font-bold' : 'hover:bg-secondary/10'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span>{q.icon}</span>
                        <span>{q.name}</span>
                      </div>
                      {selectedQuality.id === q.id && <div className="w-1.5 h-1.5 rounded-full bg-[#800000] ml-auto" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Count Select - Logo Only */}
          <div className="relative">
            <div className="flex items-center bg-[#F5F5F0] rounded-xl border border-[#5C4B40]/10 shadow-sm overflow-hidden">
              <button
                disabled={selectedCount <= 1}
                onClick={() => {
                  const idx = COUNTS.indexOf(selectedCount);
                  if (idx > 0) setSelectedCount(COUNTS[idx - 1]);
                }}
                className={`p-2 text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors ${selectedCount <= 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Minus size={14} />
              </button>

              <div className="px-2 min-w-[35px] text-center select-none">
                <span className="text-[11px] font-black text-[#5C4B40] tracking-tighter">{selectedCount}/8</span>
              </div>

              <button
                disabled={selectedCount >= 8}
                onClick={() => {
                  const idx = COUNTS.indexOf(selectedCount);
                  if (idx < COUNTS.length - 1) setSelectedCount(COUNTS[idx + 1]);
                }}
                className={`p-2 text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors ${selectedCount >= 8 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Plus size={14} />
              </button>
            </div>

            <AnimatePresence>
              {activeDropdown === 'count' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 min-w-[120px] bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-[100] p-1.5"
                >
                  {COUNTS.map(c => (
                    <button
                      key={c}
                      onClick={() => { setSelectedCount(c); setActiveDropdown(null) }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg transition-colors ${selectedCount === c ? 'bg-secondary/15 font-bold' : 'hover:bg-secondary/10'}`}
                    >
                      <span>{c} IMAGE{c > 1 ? 'S' : ''}</span>
                      {selectedCount === c && <div className="w-1.5 h-1.5 rounded-full bg-[#800000] ml-auto" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Style Select - Logo Only */}
          <div className="relative ml-auto">
            <button
              onClick={() => toggleDropdown('style')}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white/80 hover:bg-white rounded-full transition-all border border-white/40 shadow-sm cursor-pointer min-w-[32px]"
              title={`Style : ${selectedStyle.name}`}
            >
              <div className="text-[#5C4B40]">
                <Palette size={14} />
              </div>
              <ChevronDown size={10} className={`text-secondary/60 transition-transform ${activeDropdown === 'style' ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {activeDropdown === 'style' && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full right-0 mb-2 min-w-[240px] max-h-[300px] overflow-y-auto no-scrollbar bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-[100] p-1.5"
                >
                  {/* Onglets */}
                  <div className="flex border-b border-[#5C4B40]/5 mb-2">
                    <button
                      onClick={() => setStyleTab('explorer')}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${styleTab === 'explorer' ? 'text-[#800000] border-b border-[#800000]' : 'text-[#5C4B40]/40'}`}
                    >
                      Explorer
                    </button>
                    <button
                      onClick={() => setStyleTab('create')}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${styleTab === 'create' ? 'text-[#800000] border-b border-[#800000]' : 'text-[#5C4B40]/40'}`}
                    >
                      Créer
                    </button>
                  </div>

                  {styleTab === 'explorer' ? (
                    <div className="max-h-[250px] overflow-y-auto no-scrollbar">
                      {/* Style Sélectionné */}
                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#800000]">Sélection Actuelle</div>
                      <button
                        onClick={() => setActiveDropdown(null)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg bg-[#800000]/5 border border-[#800000]/10 font-bold mb-2 shadow-sm"
                      >
                        <span className="truncate">{selectedStyle.name}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#800000]" />
                      </button>

                      <div className="h-px bg-[#5C4B40]/5 my-2 mx-2" />

                      <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/40">Styles Prédéfinis</div>
                      {PRESET_STYLES.filter(s => s.id !== selectedStyle.id).map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStyle(s); setActiveDropdown(null) }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg transition-colors hover:bg-secondary/10"
                        >
                          <span>{s.name}</span>
                        </button>
                      ))}

                      {customStyles.filter(s => s.id !== selectedStyle.id).length > 0 && (
                        <>
                          <div className="h-px bg-[#5C4B40]/5 my-2 mx-2" />
                          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/40">Mes Styles</div>
                          {customStyles.filter(s => s.id !== selectedStyle.id).map(s => (
                            <div key={s.id} className="group/style relative">
                              <button
                                onClick={() => { setSelectedStyle(s); setActiveDropdown(null) }}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-xs text-left rounded-lg transition-colors hover:bg-secondary/10"
                              >
                                <span className="truncate pr-6">{s.name}</span>
                              </button>
                              <button
                                onClick={(e) => handleDeleteCustomStyle(s.id, e)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#5C4B40]/20 hover:text-red-500 opacity-0 group-hover/style:opacity-100 transition-all"
                                title="Supprimer ce style"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[#5C4B40]/40 uppercase tracking-widest">Nom du Style</label>
                        <input
                          type="text"
                          value={newStyleName}
                          onChange={(e) => setNewStyleName(e.target.value)}
                          placeholder="Ex: Futuriste"
                          className="w-full bg-[#5C4B40]/5 border-none rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#800000]/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[#5C4B40]/40 uppercase tracking-widest">Description / Prompt</label>
                        <textarea
                          value={newStyleDesc}
                          onChange={(e) => setNewStyleDesc(e.target.value)}
                          placeholder="Ajoutez des détails (ex: néon, 8k...)"
                          rows={3}
                          className="w-full bg-[#5C4B40]/5 border-none rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#800000]/20 resize-none"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (newStyleName.trim() && newStyleDesc.trim()) {
                            await handleSaveCustomStyle({ name: newStyleName, description: newStyleDesc })
                            setNewStyleName('')
                            setNewStyleDesc('')
                            setStyleTab('explorer')
                            setActiveDropdown(null)
                          }
                        }}
                        className="w-full py-2.5 bg-[#800000] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#800000]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Enregistrer
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Input Row */}
        <div className="flex items-end gap-2 bg-white rounded-2xl border border-white/40 focus-within:border-[#5C4B40]/30 transition-all p-2 mx-1 mb-1 shadow-inner">

          {/* Main Input */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Décris ton prochain chef-d'œuvre..."
            rows={1}
            className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-1 text-sm font-medium text-[#5C4B40] placeholder-[#5C4B40]/40 resize-none min-h-[40px] max-h-[200px] overflow-y-auto no-scrollbar"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {/* Actions Right */}
          <div className="flex items-center gap-2 mb-1">
            {/* Send Button */}
            {/* Send Button */}
            <button
              onClick={handleSend}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${!prompt.trim() || isGenerating
                ? 'bg-[#5C4B40]/50 text-white/80'
                : 'bg-[#5C4B40] text-white shadow-lg shadow-[#5C4B40]/20 hover:scale-105 active:scale-95'
                }`}
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {isStyleModalOpen && (
          <StyleModal
            onClose={() => setIsStyleModalOpen(false)}
            onSave={handleSaveCustomStyle}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
