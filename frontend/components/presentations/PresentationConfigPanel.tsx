'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Type,
  LayoutTemplate,
  Upload,
  Presentation,
  Globe,
  FileText,
  Share2,
  Check,
  Plus,
  ArrowRight,
  Loader2,
  ChevronDown,
  X,
  ChevronRight,
  Palette,
  Image as ImageIcon,
  Camera,
  Layers,
  Zap,
  Tag,
  Settings
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import ReactMarkdown from 'react-markdown'

interface PresentationConfigPanelProps {
  activeTab: 'gamma' | 'gemini'
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void
  onSuccess: () => void
  onModeSelect?: (mode: 'generate' | 'paste' | 'template' | 'import') => void
  config?: any
  setConfig?: (cfg: any) => void
  showDetails?: boolean
  onClose?: () => void
}

const THEME_PREVIEWS = {
  Iris: {
    id: 'iris',
    name: 'Iris',
    bgColor: '#1a1a2e',
    textColor: '#e0d6ff',
    accentColor: '#7c5cbf',
    fontFamily: 'serif',
    description: 'Élégant et sombre avec des tons violets'
  },
  Alien: {
    id: 'alien',
    name: 'Alien',
    bgColor: '#0a0a0a',
    textColor: '#00ff88',
    accentColor: '#00cc6a',
    fontFamily: 'monospace',
    description: 'Futuriste avec des tons néon verts'
  },
  Mercury: {
    id: 'mercury',
    name: 'Mercury',
    bgColor: '#f5f5f5',
    textColor: '#333333',
    accentColor: '#888888',
    fontFamily: 'sans-serif',
    description: 'Minimaliste et épuré en gris'
  },
  Breeze: {
    id: 'breeze',
    name: 'Breeze',
    bgColor: '#e8f4f8',
    textColor: '#2c5f6e',
    accentColor: '#4db8d3',
    fontFamily: 'sans-serif',
    description: 'Frais et aérien en bleu clair'
  },
  Stratos: {
    id: 'stratos',
    name: 'Stratos',
    bgColor: '#1b1b3a',
    textColor: '#e8e8e8',
    accentColor: '#4a69bd',
    fontFamily: 'sans-serif',
    description: 'Profond et corporate en bleu nuit'
  },
  Creme: {
    id: 'creme',
    name: 'Crème',
    bgColor: '#fdf6ec',
    textColor: '#5c4b40',
    accentColor: '#d4a76a',
    fontFamily: 'serif',
    description: 'Chaleureux et naturel en tons beige'
  }
}

export default function PresentationConfigPanel({
  activeTab,
  isGenerating,
  setIsGenerating,
  onSuccess,
  onModeSelect,
  config,
  setConfig,
  showDetails = false,
  onClose
}: PresentationConfigPanelProps) {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')

  const updateConfig = (key: string, value: any) => {
    if (setConfig && config) {
      setConfig({ ...config, [key]: value })
    }
  }

  const creationModes = [
    { id: 'generate', icon: Sparkles, title: 'Générer', desc: 'Créez en quelques secondes à partir d une simple invite' },
    { id: 'paste', icon: Type, title: 'Coller le texte', desc: 'Créez à partir de notes, d un plan ou d un contenu existant' },
    { id: 'template', icon: LayoutTemplate, title: 'Depuis un modèle', desc: 'Créer en utilisant la structure d un modèle', badge: 'NOUVEAU' },
    { id: 'import', icon: Upload, title: 'Importer', desc: 'Améliorez les présentations depuis un fichier ou une URL' },
  ]

  const formats = [
    { id: 'presentation', icon: Presentation, label: 'Présentation', defaultDim: '16:9', dims: ['16:9', '4:3', 'fluid'] },
    { id: 'webpage', icon: Globe, label: 'Web', defaultDim: 'fluid', dims: ['fluid', 'pageless'] },
    { id: 'document', icon: FileText, label: 'Doc', defaultDim: 'fluid', dims: ['fluid', 'letter', 'a4'] },
    { id: 'social', icon: Share2, label: 'Social', defaultDim: '1x1', dims: ['1x1', '4x5', '9:16'] },
  ]

  const themes = ['Iris', 'Alien', 'Mercury', 'Breeze', 'Stratos', 'Creme']
  const languages = ['Français', 'English', 'Español', 'Deutsch', 'Italiano', 'Português', 'العربية', '中文', '日本語']
  const tones = ['Professionnel', 'Créatif', 'Éducatif', 'Commercial', 'Inspirant', 'Humoristique']
  const artStyles = ['Photo', 'Illustration', 'Abstract', 'Minimaliste', 'Vectoriel']

  const handleFormatChange = (id: string) => {
    const f = formats.find(fmt => fmt.id === id)
    if (f) {
      updateConfig('format', id)
      updateConfig('dimensions', f.defaultDim)
    }
  }

  const addKeyword = () => {
    if (keywordInput.trim() && config) {
      const keywords = [...(config.visualKeywords || [])]
      if (!keywords.includes(keywordInput.trim())) {
        updateConfig('visualKeywords', [...keywords, keywordInput.trim()])
      }
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw: string) => {
    if (config) {
      updateConfig('visualKeywords', config.visualKeywords.filter((k: string) => k !== kw))
    }
  }

  const renderThemePreview = (themeName: string) => {
    const theme = (THEME_PREVIEWS as any)[themeName]
    if (!theme) return null

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 mb-4 z-50 w-[320px] bg-white rounded-3xl shadow-2xl border border-[#5C4B40]/10 overflow-hidden pointer-events-none"
      >
        <div
          className="aspect-video p-6 flex flex-col"
          style={{ backgroundColor: theme.bgColor }}
        >
          <div className="flex-1">
            <h5
              className="text-lg font-bold mb-1"
              style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
            >
              Titre de la Présentation
            </h5>
            <div
              className="h-1 w-12 mb-4"
              style={{ backgroundColor: theme.accentColor }}
            />
            <p
              className="text-[10px] opacity-80 mb-6"
              style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
            >
              Sous-titre exemple de présentation
            </p>
            <ul className="space-y-2">
              {[1, 2].map(i => (
                <li key={i} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.textColor }} />
                  <div className="h-1 w-24 rounded-full" style={{ backgroundColor: theme.textColor, opacity: 0.3 }} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-4 bg-white">
          <p className="text-[10px] font-black uppercase text-[#5C4B40]">{themeName}</p>
          <p className="text-[8px] opacity-60 font-medium">{theme.description}</p>
        </div>
      </motion.div>
    )
  }

  const renderGammaConfig = () => {
    if (!showDetails) {
      return (
        <div className="flex-1 flex flex-col p-8 gap-8">
          <section>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40 mb-4">Étape 1 : Mode de création</h4>
            <div className="grid grid-cols-2 gap-3">
              {creationModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onModeSelect?.(mode.id as any)}
                  className="p-4 rounded-2xl border border-[#5C4B40]/10 bg-white/30 text-left flex flex-col gap-2 transition-all hover:border-[#5C4B40]/20 hover:bg-white/50"
                >
                  <div className="flex justify-between items-start">
                    <mode.icon size={18} />
                    {mode.badge && <span className="text-[6px] font-black bg-[#d4a574] text-white px-1.5 py-0.5 rounded-full">{mode.badge}</span>}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-tight">{mode.title}</p>
                  <p className="text-[8px] leading-tight opacity-60 font-medium">{mode.desc}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )
    }

    const currentFormat = formats.find(f => f.id === config.format) || formats[0]

    return (
      <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto no-scrollbar">
        <section className="space-y-6">
          {/* Format & Dimensions */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40 flex items-center gap-2">
              <Layers size={12} /> Format & Dimensions
            </h4>
            <div className="flex bg-white/50 p-1 rounded-2xl border border-[#5C4B40]/10">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleFormatChange(f.id)}
                  className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${config.format === f.id ? 'bg-[#5C4B40] text-white shadow-lg' : 'hover:bg-[#5C4B40]/5 opacity-60'}`}
                >
                  <f.icon size={16} />
                  <span className="text-[8px] font-black uppercase">{f.label}</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <select
                value={config.dimensions}
                onChange={(e) => updateConfig('dimensions', e.target.value)}
                className="w-full p-4 bg-white border border-[#5C4B40]/10 rounded-2xl text-[10px] font-bold appearance-none outline-none focus:border-[#5C4B40]/20"
              >
                {currentFormat.dims.map(d => (
                  <option key={d} value={d === '16:9' ? 'fluid' : d}>{d} {d === currentFormat.defaultDim ? '(Défaut)' : ''}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" />
            </div>
          </div>

          {/* Visual Parameters - THÈMES */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40 flex items-center gap-2">
              <Palette size={12} /> Thème visuel
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {themes.map(t => (
                <div key={t} className="relative group">
                  <button
                    onMouseEnter={() => setHoveredTheme(t)}
                    onMouseLeave={() => setHoveredTheme(null)}
                    onClick={() => {
                      updateConfig('theme', t)
                      setHoveredTheme(null)
                    }}
                    className={`w-full h-12 rounded-xl flex items-center justify-center text-[8px] font-black uppercase relative overflow-hidden transition-all ${config.theme === t ? 'ring-2 ring-[#5C4B40] scale-[1.02]' : 'opacity-60 grayscale hover:grayscale-0'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#EAE1D3] to-[#F8F6F2]" />
                    <span className="relative z-10">{t}</span>
                    {config.theme === t && <div className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow-sm"><Check size={8} className="text-[#5C4B40]" /></div>}
                  </button>
                  <AnimatePresence>
                    {hoveredTheme === t && renderThemePreview(t)}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

          {/* Configuration Générale */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5C4B40]/40 flex items-center gap-2">
              <Zap size={12} /> Configuration Générale
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Langue</label>
                <div className="relative">
                  <select
                    value={config.language}
                    onChange={(e) => updateConfig('language', e.target.value)}
                    className="w-full p-3 bg-white border border-[#5C4B40]/10 rounded-xl text-[10px] font-bold appearance-none outline-none focus:border-[#5C4B40]/20"
                  >
                    {languages.map(l => <option key={l}>{l}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Ton</label>
                <div className="relative">
                  <select
                    value={config.tone}
                    onChange={(e) => updateConfig('tone', e.target.value)}
                    className="w-full p-3 bg-white border border-[#5C4B40]/10 rounded-xl text-[10px] font-bold appearance-none outline-none focus:border-[#5C4B40]/20"
                  >
                    {tones.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Nombre de slides</label>
              <div className="flex gap-1.5 flex-wrap">
                {[5, 8, 10, 15, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => updateConfig('numSlides', n)}
                    className={`flex-1 min-w-[40px] py-2 rounded-xl text-[10px] font-bold transition-all ${config.numSlides === n ? 'bg-[#5C4B40] text-white shadow-md' : 'bg-white/50 text-[#5C4B40]/40 hover:bg-white'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* PARAMÈTRES AVANCÉS */}
          <div className="border border-[#5C4B40]/5 rounded-[32px] overflow-hidden bg-white/20">
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full p-5 flex items-center justify-between hover:bg-white/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#5C4B40]/5 flex items-center justify-center">
                  <ChevronRight size={16} className={`transition-transform duration-300 ${isAdvancedOpen ? 'rotate-90' : ''}`} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Paramètres Avancés</span>
              </div>
            </button>

            <AnimatePresence>
              {isAdvancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-8 space-y-6"
                >
                  <div className="space-y-4 pt-2">
                    {/* Source Images */}
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Source images</label>
                      <div className="relative">
                        <select
                          value={config.imageSource}
                          onChange={(e) => updateConfig('imageSource', e.target.value)}
                          className="w-full p-4 bg-white border border-[#5C4B40]/10 rounded-2xl text-[10px] font-bold appearance-none outline-none focus:border-[#5C4B40]/20"
                        >
                          <option value="IA">Images IA (Génération unique)</option>
                          <option value="Web">Images Web (Stock & Recherche)</option>
                          <option value="None">Pas d'images</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" />
                      </div>
                    </div>

                    {/* Style Artistique */}
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Style artistique</label>
                      <div className="flex flex-wrap gap-2">
                        {artStyles.map(s => (
                          <button
                            key={s}
                            onClick={() => updateConfig('artStyle', s)}
                            className={`px-4 py-2 rounded-full text-[9px] font-bold transition-all ${config.artStyle === s ? 'bg-[#d4a574] text-white shadow-md' : 'bg-white/50 text-[#5C4B40]/40'}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mots-clés visuels */}
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Mots-clés visuels</label>
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                            placeholder="Ex: Futuriste, Minimaliste, Nature..."
                            className="w-full p-4 bg-white border border-[#5C4B40]/10 rounded-2xl text-[10px] font-bold outline-none focus:border-[#5C4B40]/20 pr-12"
                          />
                          <button onClick={addKeyword} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-[#5C4B40]/5 rounded-lg transition-colors">
                            <Plus size={14} />
                          </button>
                        </div>
                        {config.visualKeywords && config.visualKeywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {config.visualKeywords.map((kw: string) => (
                              <span key={kw} className="px-2 py-1 bg-[#5C4B40]/5 border border-[#5C4B40]/10 rounded-lg text-[8px] font-bold flex items-center gap-2 group">
                                <Tag size={8} className="opacity-40" />
                                {kw}
                                <button onClick={() => removeKeyword(kw)} className="p-0.5 hover:bg-red-500 hover:text-white rounded transition-colors">
                                  <X size={8} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Public Cible */}
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Public cible (Audience)</label>
                      <input
                        type="text"
                        value={config.audience || ''}
                        onChange={(e) => updateConfig('audience', e.target.value)}
                        placeholder="Ex: Investisseurs, Etudiants..."
                        className="w-full p-4 bg-white border border-[#5C4B40]/10 rounded-2xl text-[10px] font-bold outline-none focus:border-[#5C4B40]/20"
                      />
                    </div>

                    {/* Instructions Supplémentaires */}
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-widest opacity-40 block">Instructions supplémentaires</label>
                      <textarea
                        value={config.instructions || ''}
                        onChange={(e) => updateConfig('instructions', e.target.value)}
                        placeholder="Précisez des contraintes de style ou de contenu..."
                        className="w-full h-24 p-4 bg-white border border-[#5C4B40]/10 rounded-2xl text-[10px] font-medium outline-none focus:border-[#5C4B40]/20 resize-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    )
  }

  const renderGeminiConfig = () => {
    return (
      <div className="flex-1 flex flex-col p-8 gap-8">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-2">Nombre de Slides</label>
            <div className="flex gap-2">
              {[5, 8, 10, 15, 20].map(n => (
                <button
                  key={n}
                  onClick={() => updateConfig('numSlides', n)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all ${config.numSlides === n ? 'bg-[#5C4B40] text-white' : 'bg-white/50 text-[#5C4B40]/60 hover:bg-white'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-2">Ton de la présentation</label>
            <div className="flex flex-wrap gap-2">
              {tones.map(t => (
                <button
                  key={t}
                  onClick={() => updateConfig('tone', t)}
                  className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${config.tone === t ? 'bg-[#d4a574] text-white shadow-lg' : 'bg-[#5C4B40]/5 text-[#5C4B40]/60 hover:bg-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block mb-2">Langue</label>
            <div className="relative">
              <select
                value={config.language}
                onChange={(e) => updateConfig('language', e.target.value)}
                className="w-full p-4 bg-white border border-[#5C4B40]/10 rounded-2xl text-[10px] font-bold appearance-none outline-none focus:border-[#5C4B40]/20 shadow-sm"
              >
                {languages.map(l => <option key={l}>{l}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full bg-[#FDFCFB]/80 backdrop-blur-xl">
      <div className="p-8 pb-4 shrink-0 overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xl font-black text-[#5C4B40] uppercase tracking-tighter">Configuration</h3>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#5C4B40]/5 flex items-center justify-center">
              <Settings size={14} className="animate-spin-slow" />
            </div>
          </div>
        </div>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">Agent de conception IA • v2.0</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'gamma' ? renderGammaConfig() : renderGeminiConfig()}
      </div>

      <div className="p-8 bg-white/50 backdrop-blur-md border-t border-[#5C4B40]/10 relative z-10">
        {!showDetails && (
          <button
            disabled={true}
            className="w-full py-5 bg-[#5C4B40]/20 text-[#5C4B40]/40 rounded-[24px] text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 cursor-not-allowed"
          >
            <Sparkles size={18} /> CHOISISSEZ UN MODE
          </button>
        )}
        {showDetails && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="flex-1 h-[1px] bg-[#5C4B40]/5" />
              <span className="text-[8px] font-black uppercase tracking-widest opacity-30">Action finale</span>
              <div className="flex-1 h-[1px] bg-[#5C4B40]/5" />
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('send-to-gamma'))}
              disabled={isGenerating}
              className="group w-full py-5 bg-[#5C4B40] text-white rounded-[24px] text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-[#4A3C33] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_-15px_rgba(92,75,64,0.3)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : "GÉNÉRER LE PROJET"}
            </button>
            <p className="text-[7px] text-center font-bold opacity-30 uppercase tracking-widest">
              Envoi vers le moteur de rendu Gamma
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
