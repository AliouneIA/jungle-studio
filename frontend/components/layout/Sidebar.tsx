'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Cpu, Database, Activity, LogOut, Brain, ChevronLeft, ChevronRight, MessageSquare, Folder, Image as ImageIcon, MoreVertical, Share2, Trash2, FolderInput, Settings, ChevronDown, ChevronUp, Plus, SquarePen, Briefcase, Star, Heart, Cloud, Code, Search, Bot, Sparkles, User, FileText, Palette, Presentation } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ProjectSettingsModal from '@/components/projects/ProjectSettingsModal'
import { createClient } from '@/utils/supabase/client'

// Types
type Project = { id: string, title: string, icon?: string, image_url?: string, isShared?: boolean }
type Conversation = {
    id: string,
    title: string,
    project_id?: string,
    created_at: string,
    mode?: 'manus' | 'supernova' | 'fusion' | 'solo' | 'canvas',
    canvas_mode?: string,
    isShared?: boolean
}

export interface SidebarProps {
    status: string
    error: any
    fusionEnabled: boolean
    onShowReflection: () => void
    onLogout: () => void
    onNewConversation: () => void
    activeConversationId: string | null
    onSelectConversation: (conversation: Conversation) => void
    activeProjectId: string | null
    onSelectProject: (id: string | null) => void
    onDeleteConversation: (id: string) => Promise<void>
    onRenameConversation?: (id: string, newTitle: string) => Promise<void>
    onDeleteProject?: (id: string) => void
    totalTokensUsed: number
    refreshKey: number
    onOpenLibrary: () => void
    isLibraryOpen: boolean
    onOpenSearch: () => void
    onOpenGPTs: () => void
    onOpenAdmin: () => void
    onOpenProjects: () => void
    onOpenStudio: () => void
    onOpenPresentations: () => void
    currentView?: 'chat' | 'admin' | 'gpts' | 'search' | 'projects' | 'gpts-creator' | 'canvas' | 'studio' | 'presentations'
    showReflectionPanel?: boolean
    searchQuery?: string
    onSearchChange?: (val: string) => void
    profile: {
        firstName: string
        lastName: string
        email: string
        photo: string | null
        photoZoom: number
        photoOffset: { x: number, y: number }
        sidebarPhotoZoom: number
        sidebarPhotoOffset: { x: number, y: number }
    }
    onOpenNewProject?: () => void
}

// Helper for Accordion Item - Defined outside to prevent unmounting on parent re-render
const SidebarSection = React.memo(({ id, icon: Icon, title, isCollapsed, isOpen, onToggle, onExpand, children, action }: {
    id: string,
    icon: any,
    title: string,
    isCollapsed: boolean,
    isOpen: boolean,
    onToggle: (id: string) => void,
    onExpand: () => void,
    children: React.ReactNode,
    action?: React.ReactNode
}) => (
    <div className="border-b border-secondary/10 last:border-0">
        <div className={`w-full flex items-center transition-colors group/section ${isCollapsed ? 'justify-center py-4 px-0' : 'justify-between p-4 hover:bg-white/5'}`}>
            <button
                onClick={() => {
                    if (isCollapsed) onExpand()
                    onToggle(id)
                }}
                className={`flex items-center gap-4 text-sm font-semibold text-foreground text-left ${isCollapsed ? 'justify-center' : 'flex-1'}`}
                title={isCollapsed ? title : ''}
            >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-foreground/20 shadow-sm transition-all group-hover/section:scale-110 shrink-0">
                    <Icon size={18} className="text-foreground" />
                </div>
                {!isCollapsed && <span className="text-sm font-semibold text-foreground">{title}</span>}
            </button>

            {!isCollapsed && (
                <div className="flex items-center gap-2">
                    {action && (
                        <div className="opacity-0 group-hover/section:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            {action}
                        </div>
                    )}
                    <button onClick={() => onToggle(id)} className="text-foreground/50 hover:text-foreground transition-colors">
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            )}
        </div>

        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="px-4 pb-4 pt-0 space-y-2">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
))
SidebarSection.displayName = 'SidebarSection'

const Sidebar = ({
    status,
    error,
    fusionEnabled,
    onShowReflection,
    onLogout,
    onNewConversation,
    activeConversationId,
    onSelectConversation,
    activeProjectId,
    onSelectProject,
    onDeleteConversation,
    onRenameConversation,
    onDeleteProject,
    totalTokensUsed,
    refreshKey,
    onOpenLibrary,
    isLibraryOpen,
    onOpenSearch,
    onOpenGPTs,
    onOpenAdmin,
    onOpenProjects,
    onOpenStudio,
    onOpenPresentations,
    currentView,
    showReflectionPanel,
    searchQuery = '',
    onSearchChange,
    profile,
    onOpenNewProject
}: SidebarProps) => {
    const supabase = createClient()

    const [isCollapsed, setIsCollapsed] = useState(true)
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
    const [selectedProjectForSettings, setSelectedProjectForSettings] = useState<Project | null>(null)

    const [projects, setProjects] = useState<Project[]>([])
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [isHydrated, setIsHydrated] = useState(false)

    // Context Menu / Renaming State
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')

    // Accordion State - All closed by default
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        projects: false,
        library: false,
        chats: false,
        settings: false
    })

    // Load states from localStorage (SSR-safe)
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const savedSections = localStorage.getItem('sidebar-sections')
            if (savedSections) {
                setOpenSections(JSON.parse(savedSections))
            }
        } catch (e) { console.error(e) }

        try {
            const savedCollapsed = localStorage.getItem('sidebar-collapsed')
            if (savedCollapsed !== null) {
                setIsCollapsed(savedCollapsed === 'true')
            }
        } catch (e) { console.error(e) }

        setIsHydrated(true)
    }, [])

    // Save to localStorage only AFTER hydration (prevents overwriting saved values)
    useEffect(() => {
        if (!isHydrated) return
        try {
            localStorage.setItem('sidebar-sections', JSON.stringify(openSections))
            localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
        } catch (e) { console.error(e) }
    }, [openSections, isCollapsed, isHydrated])

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const user = session.user

        // 1. Fetch user's own projects and conversations
        const { data: proj } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
        const { data: conv } = await supabase
            .from('conversations')
            .select('*, mode, canvas_mode')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        let finalProjects = proj ? [...proj] : []
        let finalConversations = conv ? [...conv] : []

        // 2. Fetch shared resources via Edge Function (Point 4)
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invitations?action=shared-with-me`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                    }
                }
            )
            const sharedData = await res.json()

            if (sharedData?.shares) {
                // Shared Projects
                const sharedProjectIds = sharedData.shares
                    .filter((s: any) => s.resource_type === 'project')
                    .map((s: any) => s.resource_id)

                if (sharedProjectIds.length > 0) {
                    const { data: sharedProj } = await supabase
                        .from('projects')
                        .select('*')
                        .in('id', sharedProjectIds)
                    if (sharedProj) {
                        finalProjects = [...finalProjects, ...sharedProj.map(p => ({ ...p, isShared: true }))]
                    }
                }

                // Shared Conversations
                const sharedConvIds = sharedData.shares
                    .filter((s: any) => s.resource_type === 'conversation')
                    .map((s: any) => s.resource_id)

                if (sharedConvIds.length > 0) {
                    const { data: sharedConv } = await supabase
                        .from('conversations')
                        .select('*, mode, canvas_mode')
                        .in('id', sharedConvIds)
                    if (sharedConv) {
                        finalConversations = [...finalConversations, ...sharedConv.map(c => ({ ...c, isShared: true }))]
                    }
                }
            }
        } catch (err) {
            console.error('[Sidebar] Error fetching shared resources:', err)
        }

        setProjects(finalProjects)
        setConversations(finalConversations)
    }, [supabase])

    // Load Data and Subscriptions from Supabase
    useEffect(() => {
        fetchData()

        let projectsSub: any = null
        let conversationsSub: any = null

        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            projectsSub = supabase
                .channel(`projects-rt-${user.id}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
                    () => fetchData()
                )
                .subscribe()

            conversationsSub = supabase
                .channel(`conversations-rt-${user.id}`)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` },
                    () => fetchData()
                )
                .subscribe()
        }

        setupRealtime()

        return () => {
            if (projectsSub) supabase.removeChannel(projectsSub)
            if (conversationsSub) supabase.removeChannel(conversationsSub)
        }
    }, [fetchData])

    // Refetch when refreshKey changes (for instant delete updates)
    useEffect(() => {
        if (refreshKey > 0) {
            fetchData()
        }
    }, [refreshKey, fetchData])

    const toggleSection = useCallback((section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
    }, [])

    const handleCreateProject = useCallback(async (title: string, icon: any, image?: string) => {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error('Utilisateur non authentifié ou erreur auth:', authError)
            return
        }

        const { error } = await supabase.from('projects').insert({
            user_id: user.id,
            title,
            icon: typeof icon === 'string' ? icon : 'folder',
            image_url: image
        })

        if (error) {
            console.error('Erreur création projet:', error)
        }
    }, [])

    const handleDeleteProject = useCallback(async (id: string) => {
        if (!confirm('Supprimer ce dossier ? Les conversations seront conservées.')) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)

        if (error) {
            console.error('Erreur suppression projet:', error)
            alert('Erreur: ' + error.message)
        } else {
            console.log('Projet supprimé avec succès')
            if (activeProjectId === id) {
                onSelectProject(null)
            }
            fetchData()
        }
    }, [activeProjectId, onSelectProject, fetchData])

    return (
        <>
            <ProjectSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => {
                    setIsSettingsModalOpen(false)
                    setSelectedProjectForSettings(null)
                }}
                project={selectedProjectForSettings}
                onUpdate={fetchData}
                onDelete={handleDeleteProject}
            />

            <motion.div
                initial={{ width: 256 }}
                animate={{ width: isCollapsed ? 80 : 256 }}
                className="h-full hidden md:flex flex-col bg-sidebar border-r border-secondary/30 z-[60] transition-all duration-300 relative shadow-xl !overflow-visible"
            >
                {/* Collapse Toggle */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-8 bg-white border border-[#5C4B40]/20 rounded-full w-8 h-8 flex items-center justify-center text-[#5C4B40]/60 hover:text-[#5C4B40] transition-all z-[100] shadow-xl hover:scale-110 active:scale-95 group"
                    title={isCollapsed ? "Agrandir" : "Réduire"}
                >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>

                {/* Header - Clickable to Reset/New Conversation */}
                <button
                    onClick={() => onSelectProject(null)}
                    className={`w-full flex items-center justify-center border-b border-secondary/10 shrink-0 transition-all duration-300 hover:bg-white/5 group cursor-pointer ${isCollapsed ? 'py-4' : 'flex-col gap-3 p-6'}`}
                    title="Retour à l'accueil"
                >
                    <img
                        src="/logos/Jungle_studio.png"
                        alt="JS"
                        className={`object-contain brightness-110 drop-shadow-sm transition-all duration-300 group-hover:scale-105 ${isCollapsed ? 'w-[84px] h-auto' : 'w-[130px] h-auto'}`}
                    />
                    {!isCollapsed && (
                        <h2
                            className="text-[10px] font-light tracking-[0.4em] text-foreground opacity-80 uppercase transition-all duration-300 whitespace-nowrap group-hover:opacity-100"
                            style={{
                                fontFamily: "'Avenir', 'Avenir Next', 'Inter', sans-serif",
                                textShadow: '0 0 10px rgba(255, 255, 255, 0.4)'
                            }}
                        >
                            JUNGLE STUDIO
                        </h2>
                    )}
                </button>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar pt-2">

                    {/* Main Action Buttons Styled as Category Items */}
                    <div className="mb-2">
                        {/* 1. Recherche */}
                        <button
                            onClick={onOpenSearch}
                            className={`w-full flex items-center hover:bg-white/10 transition-colors group ${isCollapsed ? 'justify-center py-4 px-0' : 'gap-4 p-4'} ${currentView === 'search' ? 'bg-foreground/10' : ''}`}
                            title="Recherche"
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform shrink-0 ${currentView === 'search' ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                <Search size={18} className="text-foreground" />
                            </div>
                            {!isCollapsed && <span className={`text-sm font-semibold text-foreground ${currentView === 'search' ? 'font-bold' : ''}`}>Recherche</span>}
                        </button>

                        {/* 2. Nouvelle Discussion (Moved to pos 2) */}
                        <button
                            onClick={onNewConversation}
                            className={`w-full flex items-center hover:bg-white/10 transition-colors group ${isCollapsed ? 'justify-center py-4 px-0' : 'gap-4 p-4'}`}
                            title="Nouvelle Discussion"
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-foreground/20 shadow-sm group-hover:scale-110 transition-transform shrink-0">
                                <SquarePen size={18} className="text-foreground" />
                            </div>
                            {!isCollapsed && <span className="text-sm font-semibold text-foreground">Nouvelle Discussion</span>}
                        </button>

                        {/* 3. Mes GPTs */}
                        <button
                            onClick={onOpenGPTs}
                            className={`w-full flex items-center hover:bg-white/10 transition-colors group ${isCollapsed ? 'justify-center py-4 px-0' : 'gap-4 p-4'} ${currentView === 'gpts' ? 'bg-foreground/10' : ''}`}
                            title="GPTs"
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform shrink-0 ${currentView === 'gpts' ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                <Bot size={18} className="text-foreground" />
                            </div>
                            {!isCollapsed && <span className={`text-sm font-semibold text-foreground ${currentView === 'gpts' ? 'font-bold' : ''}`}>Mes GPTs</span>}
                        </button>

                        {/* 4. Réflexion IA */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onShowReflection();
                            }}
                            className={`w-full flex items-center hover:bg-white/10 transition-colors group border-b border-secondary/10 ${isCollapsed ? 'justify-center py-4 px-0' : 'gap-4 p-4'} ${showReflectionPanel ? 'bg-foreground/10' : ''}`}
                            title="Réflexion AI"
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform shrink-0 ${showReflectionPanel ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                <Sparkles size={18} className="text-foreground" />
                            </div>
                            {!isCollapsed && <span className={`text-sm font-semibold text-foreground ${showReflectionPanel ? 'font-bold' : ''}`}>Réflexion IA</span>}
                        </button>

                        {/* 5. Studio Image */}
                        <button
                            onClick={onOpenStudio}
                            className={`w-full flex items-center hover:bg-white/10 transition-colors group border-b border-secondary/10 ${isCollapsed ? 'justify-center py-4 px-0' : 'gap-4 p-4'} ${currentView === 'studio' ? 'bg-foreground/10' : ''}`}
                            title="Studio Image"
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform shrink-0 ${currentView === 'studio' ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                <Palette size={18} className="text-foreground" />
                            </div>
                            {!isCollapsed && <span className={`text-sm font-semibold text-foreground ${currentView === 'studio' ? 'font-bold' : ''}`}>Studio Image</span>}
                        </button>

                        {/* 6. Présentations */}
                        <button
                            onClick={onOpenPresentations}
                            className={`w-full flex items-center hover:bg-white/10 transition-colors group border-b border-secondary/10 ${isCollapsed ? 'justify-center py-4 px-0' : 'gap-4 p-4'} ${currentView === 'presentations' ? 'bg-foreground/10' : ''}`}
                            title="Présentations"
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm group-hover:scale-110 transition-transform shrink-0 ${currentView === 'presentations' ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                <Presentation size={18} className="text-foreground" />
                            </div>
                            {!isCollapsed && <span className={`text-sm font-semibold text-foreground ${currentView === 'presentations' ? 'font-bold' : ''}`}>Présentations</span>}
                        </button>
                    </div>

                    {/* 1. Projects Section */}
                    <div className="border-b border-secondary/10">
                        <div className={`w-full flex items-center transition-colors group/section ${isCollapsed ? 'justify-center py-4 px-0' : 'justify-between p-4 hover:bg-white/5'}`}>
                            <button
                                onClick={onOpenProjects}
                                className={`flex items-center gap-4 text-sm font-semibold text-foreground text-left ${isCollapsed ? 'justify-center' : 'flex-1'}`}
                                title={isCollapsed ? "Projets" : ""}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all shadow-sm group-hover/section:scale-110 shrink-0 ${currentView === 'projects' ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                    <Folder size={18} className="text-foreground" />
                                </div>
                                {!isCollapsed && <span className={`text-sm font-semibold text-foreground ${currentView === 'projects' ? 'font-bold' : ''}`}>Projets</span>}
                            </button>

                            {!isCollapsed && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onOpenNewProject?.()
                                        }}
                                        className="p-1 opacity-0 group-hover/section:opacity-100 hover:bg-foreground/20 rounded text-foreground transition-colors"
                                        title="Nouveau Projet"
                                    >
                                        <Plus size={18} />
                                    </button>
                                    <button onClick={() => toggleSection('projects')} className="text-foreground/50 hover:text-foreground transition-colors">
                                        {openSections['projects'] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        <AnimatePresence>
                            {openSections['projects'] && !isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 pb-4 pt-0 space-y-2">

                                        {projects.map(project => {
                                            const ProjectIconComponent = project.icon === 'briefcase' ? Briefcase :
                                                project.icon === 'star' ? Star :
                                                    project.icon === 'heart' ? Heart :
                                                        project.icon === 'cloud' ? Cloud :
                                                            project.icon === 'code' ? Code : Folder

                                            return (
                                                <div
                                                    key={project.id}
                                                    onClick={() => onSelectProject(project.id)}
                                                    className={`flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer text-xs font-medium group transition-colors ${activeProjectId === project.id ? 'bg-foreground/10 text-foreground font-bold' : 'text-foreground/80'}`}
                                                >
                                                    {project.image_url ? (
                                                        <img src={project.image_url} alt="icon" className="w-5 h-5 rounded object-cover" />
                                                    ) : (
                                                        <ProjectIconComponent size={14} className="text-foreground" />
                                                    )}
                                                    <span className="truncate flex-1">{project.title}</span>
                                                    {(project as any).isShared && <Share2 size={10} className="text-foreground/40 mr-1" />}
                                                    <MoreVertical
                                                        size={12}
                                                        className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground cursor-pointer"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedProjectForSettings(project)
                                                            setIsSettingsModalOpen(true)
                                                        }}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 2. Library Section - Direct Action */}
                    <div className="border-b border-secondary/10">
                        <button
                            onClick={onOpenLibrary}
                            className={`w-full flex items-center transition-colors group/section ${isCollapsed ? 'justify-center py-4 px-0' : 'justify-between p-4 hover:bg-white/5'} ${isLibraryOpen ? 'bg-foreground/10' : ''}`}
                            title={isCollapsed ? "Bibliothèque" : ""}
                        >
                            <div className={`flex items-center text-sm font-semibold text-foreground ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all shadow-sm ${isLibraryOpen ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                    <ImageIcon size={18} className="text-foreground" />
                                </div>
                                {!isCollapsed && <span className={isLibraryOpen ? 'font-bold' : ''}>Bibliothèque</span>}
                            </div>
                            {!isCollapsed && isLibraryOpen && (
                                <div className="w-2 h-2 rounded-full bg-foreground shadow-[0_0_8px_rgba(92,75,64,0.5)]" />
                            )}
                        </button>
                    </div>

                    {/* 3. Chats */}
                    <SidebarSection
                        id="chats"
                        icon={MessageSquare}
                        title="Discussions"
                        isCollapsed={isCollapsed}
                        isOpen={openSections['chats']}
                        onToggle={toggleSection}
                        onExpand={() => setIsCollapsed(false)}
                    >
                        {conversations
                            .filter(c => (!activeProjectId || c.project_id === activeProjectId) && !c.title?.startsWith('Analyse ce message'))
                            .map(conv => (
                                <div
                                    key={conv.id}
                                    onClick={() => onSelectConversation(conv)}
                                    className={`p-2 rounded border transition-colors cursor-pointer group mb-1 relative ${activeConversationId === conv.id ? 'bg-foreground/10 border-foreground/30 shadow-lg' : 'bg-white/5 border-foreground/5 hover:bg-white/10'}`}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            {renamingId === conv.id ? (
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onBlur={async () => {
                                                        if (renameValue.trim() && onRenameConversation) {
                                                            await onRenameConversation(conv.id, renameValue)
                                                        }
                                                        setRenamingId(null)
                                                    }}
                                                    onKeyDown={async (e) => {
                                                        if (e.key === 'Enter') {
                                                            if (renameValue.trim() && onRenameConversation) {
                                                                await onRenameConversation(conv.id, renameValue)
                                                            }
                                                            setRenamingId(null)
                                                        }
                                                        if (e.key === 'Escape') setRenamingId(null)
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full bg-white/10 border border-foreground/20 rounded px-1 text-xs text-foreground outline-none"
                                                />
                                            ) : (
                                                <>
                                                    {conv.mode === 'manus' && (
                                                        <img src="/Manus1.png" alt="Manus" className="w-3 h-3 object-contain shrink-0" />
                                                    )}
                                                    {(conv.mode === 'supernova' || conv.mode === 'fusion') && (
                                                        <img src="/fusion.png" alt="Fusion" className="w-3 h-3 object-contain brightness-[10] contrast-[10] shrink-0" />
                                                    )}
                                                    {conv.canvas_mode && (
                                                        <span className="text-[10px] shrink-0">
                                                            {conv.canvas_mode === 'slides' ? '📽️' :
                                                                conv.canvas_mode === 'react' ? '⚛️' :
                                                                    conv.canvas_mode === 'html' ? '🌐' :
                                                                        conv.canvas_mode === 'document' ? '📄' : '🎨'}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-medium text-foreground truncate flex-1">{conv.title || 'Sans titre'}</span>
                                                    {conv.isShared && <Share2 size={10} className="text-foreground/40 mr-1 shrink-0" />}
                                                </>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setMenuOpenId(menuOpenId === conv.id ? null : conv.id)
                                                }}
                                                className="text-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                            >
                                                <MoreVertical size={12} />
                                            </button>

                                            {menuOpenId === conv.id && (
                                                <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-xl py-1 z-[100] min-w-[140px]">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setRenameValue(conv.title || '')
                                                            setRenamingId(conv.id)
                                                            setMenuOpenId(null)
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-[#5C4B40] hover:bg-stone-50 flex items-center gap-2 whitespace-nowrap"
                                                    >
                                                        <SquarePen size={12} /> Renommer
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (confirm('Supprimer cette conversation ?')) {
                                                                onDeleteConversation(conv.id)
                                                            }
                                                            setMenuOpenId(null)
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 whitespace-nowrap"
                                                    >
                                                        <Trash2 size={12} /> Supprimer
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-foreground/50 mt-0.5">
                                        {new Date(conv.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))
                        }
                        {conversations.filter(c => !activeProjectId || c.project_id === activeProjectId).length === 0 && (
                            <div className="text-center p-4 text-[10px] text-secondary/40 border border-dashed border-secondary/20 rounded">
                                Aucune discussion {activeProjectId ? 'dans ce projet' : ''}
                            </div>
                        )}
                    </SidebarSection>
                </div>

                {/* Footer Area */}
                <div className="bg-background/20 border-t border-secondary/30 shrink-0">
                    {/* 4. Settings/Status */}
                    {/* 4. Système - Direct Access */}
                    <div className="border-t border-secondary/10">
                        <button
                            onClick={onOpenAdmin}
                            className={`w-full flex items-center transition-colors group/section ${isCollapsed ? 'justify-center py-4 px-0' : 'justify-between p-4 hover:bg-white/5'} ${currentView === 'admin' ? 'bg-foreground/10' : ''}`}
                            title={isCollapsed ? "Système" : ""}
                        >
                            <div className={`flex items-center text-sm font-semibold text-foreground ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all shadow-sm ${currentView === 'admin' ? 'border-foreground/40 bg-foreground/10' : 'border-foreground/20'}`}>
                                    <Settings size={18} className="text-foreground" />
                                </div>
                                {!isCollapsed && <span className={currentView === 'admin' ? 'font-bold' : ''}>Système</span>}
                            </div>
                            {!isCollapsed && currentView === 'admin' && (
                                <div className="w-2 h-2 rounded-full bg-foreground shadow-[0_0_8px_rgba(92,75,64,0.5)]" />
                            )}
                        </button>
                    </div>

                    <div className={`pt-2 flex items-center ${isCollapsed ? 'flex-col gap-4 py-6' : 'p-4 justify-between'}`}>
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full border border-foreground/20 overflow-hidden bg-white/10 flex items-center justify-center shrink-0 relative ${isCollapsed ? 'shadow-lg' : ''}`}>
                                {profile.photo ? (
                                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                                        <img
                                            key={`${profile.photo}-${profile.sidebarPhotoZoom}-${profile.sidebarPhotoOffset.x}-${profile.sidebarPhotoOffset.y}`}
                                            src={profile.photo}
                                            alt="Avatar"
                                            className="max-w-none shrink-0"
                                            style={{
                                                // Ratio: sidebar réelle (32px) / bulle preview modal (80px) = 0.4
                                                transform: `translate(${profile.sidebarPhotoOffset.x * 0.4}px, ${profile.sidebarPhotoOffset.y * 0.4}px) scale(${profile.sidebarPhotoZoom})`,
                                                transformOrigin: 'center',
                                                width: 'auto',
                                                height: 'auto',
                                                minWidth: '100%',
                                                minHeight: '100%'
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <User size={18} className="text-foreground/40" />
                                )}
                            </div>
                            {!isCollapsed && (
                                <div className="flex flex-col leading-tight">
                                    <span className="font-bold text-foreground truncate max-w-[120px]">
                                        {profile.firstName} {profile.lastName}
                                    </span>
                                    <span className="text-[8px] uppercase tracking-widest text-secondary/60">Utilisateur</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onLogout}
                            className={`p-2 hover:text-red-500 transition-colors text-foreground rounded-full hover:bg-red-500/10`}
                            title="Déconnexion"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    )
}

export default React.memo(Sidebar)
