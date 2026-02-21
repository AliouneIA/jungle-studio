'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, Plus, Settings2, Trash2, MessageSquare, Search, Box, ChevronRight, Briefcase, Star, Heart, Cloud, Code } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Project {
  id: string
  title: string
  icon?: string
  image_url?: string
  instructions?: string
  created_at: string
}

interface ProjectsViewProps {
  onClose: () => void
  onSelectProject: (id: string) => void
  onOpenSettings: (project: Project) => void
  onOpenNewProject: () => void
}

export default function ProjectsView({ onClose, onSelectProject, onOpenSettings, onOpenNewProject }: ProjectsViewProps) {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setProjects(data)
    setIsLoading(false)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Voulez-vous vraiment supprimer ce projet et toutes ses conversations ?')) return

    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== id))
    }
  }

  const getIcon = (iconId: string) => {
    switch (iconId) {
      case 'briefcase': return <Briefcase size={24} />
      case 'star': return <Star size={24} />
      case 'heart': return <Heart size={24} />
      case 'cloud': return <Cloud size={24} />
      case 'code': return <Code size={24} />
      default: return <Folder size={24} />
    }
  }

  const filteredProjects = projects.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F6F2] overflow-hidden">
      {/* Header Section */}
      <div className="px-8 py-12 border-b border-[#5C4B40]/10 bg-white/40 backdrop-blur-3xl shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center px-3 py-1 bg-[#5C4B40]/5 rounded-full border border-[#5C4B40]/10 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/60">Gestionnaire Studio</span>
            </div>
            <h1 className="text-4xl font-light tracking-[0.3em] text-[#5C4B40] uppercase" style={{ fontFamily: "'Avenir', sans-serif" }}>
              Mes Projets
            </h1>
            <p className="text-[#5C4B40]/40 text-sm font-medium tracking-wide">Organisez vos espaces de travail et personnalisez les instructions de l'IA.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/30" size={18} />
              <input
                type="text"
                placeholder="Filtrer mes projets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-3 bg-white/60 border border-[#5C4B40]/10 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#5C4B40]/5 focus:border-[#5C4B40]/20 transition-all w-64"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4 text-[#5C4B40]/20">
              <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold uppercase tracking-widest">Chargement du Studio...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* New Project Card */}
              <motion.div
                whileHover={{ y: -5 }}
                onClick={onOpenNewProject}
                className="group border-2 border-dashed border-[#5C4B40]/10 rounded-[32px] p-8 flex flex-col items-center justify-center text-center space-y-4 cursor-pointer hover:bg-white/40 hover:border-[#5C4B40]/30 transition-all h-[280px]"
              >
                <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-[#5C4B40]/20 group-hover:bg-[#5C4B40] group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-xl">
                  <Plus size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#5C4B40]/40 group-hover:text-[#5C4B40] transition-colors">Nouveau Projet</h3>
                  <p className="text-xs text-[#5C4B40]/30">Créer un nouvel espace dédié</p>
                </div>
              </motion.div>

              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project, idx) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -5, boxShadow: '0 20px 40px -20px rgba(92,75,64,0.1)' }}
                    className="bg-white rounded-[32px] border border-[#5C4B40]/5 p-8 flex flex-col h-[280px] shadow-sm hover:shadow-2xl transition-all relative overflow-hidden group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-[#EAE1D3]/30 flex items-center justify-center text-[#5C4B40]/60 group-hover:bg-[#5C4B40] group-hover:text-white transition-all duration-500 overflow-hidden shadow-inner">
                        {project.image_url ? (
                          <img src={project.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getIcon(project.icon || '')
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenSettings(project)
                          }}
                          className="p-2.5 bg-[#F8F6F2] hover:bg-[#5C4B40] text-[#5C4B40]/40 hover:text-white rounded-xl transition-all duration-300"
                          title="Paramétrer les instructions"
                        >
                          <Settings2 size={18} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="p-2.5 bg-[#F8F6F2] hover:bg-red-500 text-[#5C4B40]/40 hover:text-white rounded-xl transition-all duration-300"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 cursor-pointer" onClick={() => onSelectProject(project.id)}>
                      <h3 className="text-xl font-bold text-[#5C4B40] mb-2 group-hover:text-black transition-colors">{project.title}</h3>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#5C4B40]/40 uppercase tracking-widest">
                          <MessageSquare size={12} />
                          Démarrez une nouvelle conversation
                        </div>
                        {project.instructions && (
                          <p className="text-[10px] text-[#5C4B40]/30 italic line-clamp-2 mt-1">
                            "{project.instructions}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      onClick={() => onSelectProject(project.id)}
                      className="mt-4 flex items-center justify-between py-3 px-6 bg-[#F8F6F2] group-hover:bg-[#5C4B40] rounded-2xl cursor-pointer transition-all duration-500"
                    >
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/60 group-hover:text-white">Ouvrir l'espace</span>
                      <ChevronRight size={14} className="text-[#5C4B40]/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {projects.length === 0 && !isLoading && (
            <div className="py-40 text-center space-y-8">
              <div className="w-24 h-24 rounded-[40px] bg-[#EAE1D3]/50 flex items-center justify-center mx-auto text-[#5C4B40]/20 shadow-inner rotate-3">
                <Box size={40} />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-light text-[#5C4B40] uppercase tracking-[0.2em]">Votre Studio est vide</h2>
                <p className="text-xs text-[#5C4B40]/40 font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed">Commencez par créer un projet pour organiser vos idées et personnaliser vos sessions IA.</p>
              </div>
              <button
                onClick={onOpenNewProject}
                className="px-8 py-4 bg-[#5C4B40] text-white rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl hover:shadow-[#5C4B40]/20 hover:scale-105 transition-all"
              >
                Créer mon premier projet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
