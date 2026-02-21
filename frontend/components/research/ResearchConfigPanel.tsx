'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Globe, Database, Mail, Link as LinkIcon, Plus, X, Info, Zap, Search, CheckCircle2, Circle } from 'lucide-react'

interface ResearchConfig {
  sources: {
    web: boolean
    googleDrive: boolean
    gmail: boolean
    specificSites: boolean
  }
  sites: string[]
  depth: 'quick' | 'standard' | 'exhaustive'
}

interface ResearchConfigPanelProps {
  config: ResearchConfig
  onChange: (config: ResearchConfig) => void
  onClose: () => void
}

export function ResearchConfigPanel({ config, onChange, onClose }: ResearchConfigPanelProps) {
  const [newUrl, setNewUrl] = useState('')

  const toggleSource = (key: keyof ResearchConfig['sources']) => {
    if (key === 'googleDrive' || key === 'gmail') return // Disabled for now
    onChange({
      ...config,
      sources: {
        ...config.sources,
        [key]: !config.sources[key]
      }
    })
  }

  const addSite = () => {
    if (!newUrl) return
    let url = newUrl.trim()
    if (url.startsWith('https://')) url = url.replace('https://', '')
    if (url.startsWith('http://')) url = url.replace('http://', '')
    if (url.endsWith('/')) url = url.slice(0, -1)

    if (url && !config.sites.includes(url)) {
      onChange({
        ...config,
        sites: [...config.sites, url]
      })
      setNewUrl('')
    }
  }

  const removeSite = (url: string) => {
    onChange({
      ...config,
      sites: config.sites.filter(s => s !== url)
    })
  }

  const setDepth = (depth: ResearchConfig['depth']) => {
    onChange({ ...config, depth })
  }

  return (
    <div className="flex flex-col gap-5 p-5 min-w-[300px]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#5C4B40]/10 pb-3">
        <Settings size={16} className="text-[#800000]" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-[#5C4B40]">Configuration de Recherche</h3>
      </div>

      {/* Sources */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Database size={14} className="text-[#5C4B40]/40" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5C4B40]/60">Sources de recherche</span>
        </div>

        <div className="grid gap-2">
          {/* Web Source */}
          <button
            onClick={() => toggleSource('web')}
            className="flex items-center justify-between p-2.5 rounded-xl bg-[#EAE1D3]/30 border border-[#5C4B40]/10 hover:border-[#800000]/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-[#800000]" />
              <span className="text-xs font-bold text-[#5C4B40]">Web (Serper + Tavily)</span>
            </div>
            <CheckCircle2 size={16} className="text-[#800000]" />
          </button>

          {/* Google Drive - Disabled */}
          <div className="relative group/tooltip">
            <button
              disabled
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <Database size={16} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-400">Google Drive</span>
              </div>
              <Info size={14} className="text-gray-400" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a1a] text-white text-[9px] font-bold rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
              Bientôt disponible — Connexion Google requise
            </div>
          </div>

          {/* Gmail - Disabled */}
          <div className="relative group/tooltip">
            <button
              disabled
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-400">Gmail</span>
              </div>
              <Info size={14} className="text-gray-400" />
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a1a] text-white text-[9px] font-bold rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
              Bientôt disponible — Connexion Google requise
            </div>
          </div>

          {/* Specific Sites */}
          <button
            onClick={() => toggleSource('specificSites')}
            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${config.sources.specificSites ? 'bg-[#800000]/5 border-[#800000]/20' : 'bg-white border-[#5C4B40]/10 hover:border-[#5C4B40]/20'}`}
          >
            <div className="flex items-center gap-3">
              <LinkIcon size={16} className={config.sources.specificSites ? 'text-[#800000]' : 'text-[#5C4B40]/40'} />
              <span className={`text-xs font-bold ${config.sources.specificSites ? 'text-[#800000]' : 'text-[#5C4B40]'}`}>Sites spécifiques</span>
            </div>
            {config.sources.specificSites ? <CheckCircle2 size={16} className="text-[#800000]" /> : <Circle size={16} className="text-[#5C4B40]/10" />}
          </button>
        </div>

        {/* Specific Sites Input */}
        <AnimatePresence>
          {config.sources.specificSites && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-3"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#5C4B40]/40 font-bold">https://</span>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSite()}
                    placeholder="domaine.com"
                    className="w-full pl-14 pr-3 py-2 bg-white border border-[#5C4B40]/10 rounded-xl text-xs focus:outline-none focus:border-[#800000]/30 transition-all font-medium"
                  />
                </div>
                <button
                  onClick={addSite}
                  className="p-2 bg-[#800000] text-white rounded-xl hover:bg-[#660000] transition-colors shadow-sm"
                >
                  <Plus size={18} />
                </button>
              </div>

              {config.sites.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {config.sites.map(site => (
                    <div key={site} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#800000]/10 rounded-lg text-[10px] font-bold text-[#5C4B40]">
                      <span>{site}</span>
                      <button onClick={() => removeSite(site)} className="text-[#800000] hover:bg-[#800000]/5 rounded p-0.5">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Depth Selection */}
      <div className="space-y-3 pt-2 border-t border-[#5C4B40]/10">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} className="text-[#5C4B40]/40" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#5C4B40]/60">Profondeur d'analyse</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'quick', label: 'Rapide', desc: '~3 axes' },
            { id: 'standard', label: 'Standard', desc: '~5 axes' },
            { id: 'exhaustive', label: 'Exhaustive', desc: '~7 axes' }
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setDepth(d.id as any)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${config.depth === d.id ? 'bg-[#800000] border-[#800000] text-white shadow-md' : 'bg-white border-[#5C4B40]/10 text-[#5C4B40] hover:border-[#5C4B40]/20'}`}
            >
              <span className="text-[10px] font-black uppercase tracking-tighter">{d.label}</span>
              <span className={`text-[8px] font-medium opacity-60`}>{d.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="pt-2">
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#5C4B40] text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#4a3c33] transition-all shadow-md active:scale-95"
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}
