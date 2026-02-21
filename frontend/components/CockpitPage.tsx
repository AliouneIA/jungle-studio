// cspell:disable
'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import FusionOrb from '@/components/fusion/FusionOrb'
import ReflectionPanel from '@/components/fusion/ReflectionPanel'
import ChatInput, { AVAILABLE_MODELS, IMAGE_MODELS } from '@/components/chat/ChatInput'
import Sidebar from '@/components/layout/Sidebar'
import VoiceButton from '@/components/voice/VoiceButton'
import HologramOverlay from '@/components/voice/HologramOverlay'
import { useFusionEngine, FusionMode } from '@/hooks/useFusionEngine'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, X, Briefcase, Star, Heart, Cloud, Code, Download, MessageSquare, ChevronRight, Brain, Copy, Pencil, ExternalLink, Loader2, Search, FileText } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import ImageLibrary from '@/components/fusion/ImageLibrary'
import ManusResult from '@/components/fusion/ManusResult'
import ManusLivePanel from '@/components/fusion/ManusLivePanel'
import AdminDashboard from '@/components/admin/AdminDashboard'
import GPTsCreator from '@/components/gpts/GPTsCreator'
import GPTsDiscovery from '@/components/gpts/GPTsDiscovery'
import GlobalSearch from '@/components/layout/GlobalSearch'
import ProjectsView from '@/components/projects/ProjectsView'
import ProjectSettingsModal from '@/components/projects/ProjectSettingsModal'
import NewProjectModal from '@/components/projects/NewProjectModal'
import CanvasView from '@/components/canvas/CanvasView'
import DeepResearchPanel from '@/components/research/DeepResearchPanel'
import { ResearchReportCard } from '@/components/research/ResearchReportCard'
import StudioHeader from '@/components/studio/StudioHeader'
import StudioLayout from '@/components/studio/StudioLayout'
import VideoStudioLayout from '@/components/studio/VideoStudioLayout'
import PresentationsLayout from '@/components/presentations/PresentationsLayout'
import NotificationSystem, { VideoNotificationData } from '@/components/layout/NotificationSystem'
import { runDiagnostics } from '@/utils/diagnostics'
import { migrateOldMessages } from '@/utils/migrate-messages'
import { testMessages } from '@/utils/test-messages'

// Fix Bug 9: Fonction utilitaire pour restaurer le mode d'une conversation
function restoreConversationMode(
  conv: { mode?: string; canvas_mode?: boolean },
  setFusionEnabled: (v: boolean) => void,
  setFusionMode: (v: FusionMode) => void,
  setIsManusMode: (v: boolean) => void
) {
  if (conv.mode === 'fusion') {
    setFusionEnabled(true)
    setFusionMode('fusion')
    setIsManusMode(false)
  } else if (conv.mode === 'supernova') {
    setFusionEnabled(true)
    setFusionMode('supernova')
    setIsManusMode(false)
  } else if (conv.mode === 'manus') {
    setIsManusMode(true)
    setFusionEnabled(false)
  } else if (conv.mode === 'canvas') {
    setFusionEnabled(false)
    setIsManusMode(false)
  } else {
    setFusionEnabled(false)
    setIsManusMode(false)
  }
}

export default function CockpitPage() {
  const supabase = createClient()
  const router = useRouter()
  const {
    runFusion,
    runSolo,
    runImageGen,
    runManus,
    status,
    fusionMode: currentFusionMode,
    result,
    rawResponses,
    phases,
    exchanges,
    totalTokensUsed,
    error,
    stop
  } = useFusionEngine()

  const [prompt, setPrompt] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')
  const [history, setHistory] = useState<{
    id?: string,
    role: 'user' | 'assistant',
    content: string,
    is_fusion_result?: boolean,
    run_id?: string,
    manus_data?: any,
    is_manus?: boolean,
    manus_status?: 'running' | 'completed' | 'failed',
    manus_status_text?: string,
    manus_task_id?: string,
    manus_task_url?: string | null,
    manus_structured?: any,
    manus_attachments?: any,
    web_verified?: boolean,
    citations?: { index: number, title: string, url: string, snippet: string }[],
    metadata?: any
  }[]>([])
  const [manusSteps, setManusSteps] = useState<any[]>([])
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fusion Controls
  const [fusionEnabled, setFusionEnabled] = useState(true)
  const [fusionMode, setFusionMode] = useState<FusionMode>('fusion')
  const [masterModel, setMasterModel] = useState('gpt-5.2')
  const [selectedModel, setSelectedModel] = useState('gpt-5.2')
  const [isImageMode, setIsImageMode] = useState(false)
  const [isManusMode, setIsManusMode] = useState(false)
  const [imageCount, setImageCount] = useState(1)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // UI State
  const [showReflectionPanel, setShowReflectionPanel] = useState(false)
  const [hoveredFusionMode, setHoveredFusionMode] = useState<FusionMode | null>(null)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const isSwitchingConversation = useRef(false)
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  // Fix Bug 2: Ref miroir pour éviter stale closure dans handleSubmit
  const activeConversationIdRef = useRef<string | null>(null)
  useEffect(() => { activeConversationIdRef.current = activeConversationId }, [activeConversationId])

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [activeProject, setActiveProject] = useState<{ id: string, title: string, icon?: string, image_url?: string, instructions?: string } | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  // Project Focus View State
  const [projectConversations, setProjectConversations] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'chat' | 'admin' | 'gpts' | 'search' | 'projects' | 'gpts-creator' | 'canvas' | 'studio' | 'presentations'>('chat')
  const [activeStudioTab, setActiveStudioTab] = useState<'image' | 'video'>('image')
  const [webVerifyEnabled, setWebVerifyEnabled] = useState(false)
  const [gptsSubView, setGptsSubView] = useState<'discovery' | 'creator'>('discovery')
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [selectedProjectForSettings, setSelectedProjectForSettings] = useState<any | null>(null)
  const [editingBotId, setEditingBotId] = useState<string | null>(null)
  const [refreshBotsKey, setRefreshBotsKey] = useState(0)
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [profile, setProfile] = useState({
    firstName: 'Alioune',
    lastName: 'DIENNA',
    email: 'alioune.ia77@gmail.com',
    photo: null as string | null,
    photoZoom: 1,
    photoOffset: { x: 0, y: 0 },
    sidebarPhotoZoom: 1,
    sidebarPhotoOffset: { x: 0, y: 0 }
  })
  const [user, setUser] = useState<any>(null)
  const [modeChangeNotification, setModeChangeNotification] = useState<string | null>(null)
  // Fix Bug 6: Stocker le state précédent pour pouvoir revert sur Cancel
  const [previousModeState, setPreviousModeState] = useState<{
    fusionEnabled: boolean
    fusionMode: FusionMode
    isManusMode: boolean
    isResearchMode: boolean
  } | null>(null)
  const [pendingModeSwitch, setPendingModeSwitch] = useState<{
    type: 'manus' | 'fusion' | 'solo',
    fusionMode?: FusionMode,
    fusionEnabled?: boolean
  } | null>(null)
  const [isResearchMode, setIsResearchMode] = useState(false)
  const [activeResearchRunId, setActiveResearchRunId] = useState<string | null>(null)
  const [researchConfig, setResearchConfig] = useState({
    sources: {
      web: true,
      googleDrive: false,
      gmail: false,
      specificSites: false
    },
    sites: [] as string[],
    depth: 'standard' as 'quick' | 'standard' | 'exhaustive'
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const [justSentMessage, setJustSentMessage] = useState(false)
  const [videoNotifications, setVideoNotifications] = useState<VideoNotificationData[]>([])
  const isFirstRender = useRef(true)

  // Fix Bug 1: Stabiliser la dépendance Manus task ID
  const activeManusTaskId = useMemo(() =>
    history.find(m => m.is_manus && m.manus_status === 'running')?.manus_task_id ?? null,
    [history]
  )

  // Load Preferences from localStorage
  useEffect(() => {
    const savedMaster = localStorage.getItem('jungle-master-model')
    const savedSolo = localStorage.getItem('jungle-selected-model')
    const savedFusionEnabled = localStorage.getItem('jungle-fusion-enabled')
    const savedFusionMode = localStorage.getItem('jungle-fusion-mode')
    const savedView = localStorage.getItem('jungle-current-view')
    const savedGptsView = localStorage.getItem('jungle-gpts-view')
    const savedProjectId = localStorage.getItem('jungle-active-project-id')
    const savedConvId = localStorage.getItem('jungle-active-conversation-id')
    const savedWebVerify = localStorage.getItem('jungle-web-verify-enabled')
    const savedStudioTab = localStorage.getItem('jungle-active-studio-tab')

    if (savedMaster) setMasterModel(savedMaster)
    if (savedSolo) setSelectedModel(savedSolo)
    if (savedFusionEnabled !== null) setFusionEnabled(savedFusionEnabled === 'true')
    if (savedFusionMode) setFusionMode(savedFusionMode as FusionMode)
    if (savedView) setCurrentView(savedView as any)
    if (savedGptsView) setGptsSubView(savedGptsView as any)
    if (savedProjectId) setActiveProjectId(savedProjectId)
    if (savedConvId) setActiveConversationId(savedConvId)
    if (savedWebVerify !== null) setWebVerifyEnabled(savedWebVerify === 'true')
    if (savedStudioTab === 'image' || savedStudioTab === 'video') setActiveStudioTab(savedStudioTab)

    // Fix Bug 10: Marquer hydratation immédiatement après les setState synchrones
    // (les setState sont batchés par React, donc le flag sera lu après le prochain render)
    setIsHydrated(true)
  }, [])

  // Save Preferences to localStorage
  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-master-model', masterModel)
  }, [masterModel, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-selected-model', selectedModel)
  }, [selectedModel, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-fusion-enabled', String(fusionEnabled))
  }, [fusionEnabled, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-fusion-mode', fusionMode)
  }, [fusionMode, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-current-view', currentView)
  }, [currentView, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-gpts-view', gptsSubView)
  }, [gptsSubView, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    if (activeProjectId) localStorage.setItem('jungle-active-project-id', activeProjectId)
    else localStorage.removeItem('jungle-active-project-id')
  }, [activeProjectId, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    if (activeConversationId) localStorage.setItem('jungle-active-conversation-id', activeConversationId)
    else localStorage.removeItem('jungle-active-conversation-id')
  }, [activeConversationId, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-web-verify-enabled', String(webVerifyEnabled))
  }, [webVerifyEnabled, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    localStorage.setItem('jungle-active-studio-tab', activeStudioTab)
  }, [activeStudioTab, isHydrated])

  // Handle mode change request
  useEffect(() => {
    if (!isHydrated) return

    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (history.length > 0) {
      if (isSwitchingConversation.current) {
        console.log('🔄 Mode switch ignored due to conversation loading')
        return
      }

      const targetType = isManusMode ? 'manus' : (fusionEnabled ? 'fusion' : 'solo')

      // Fix Bug 6: Stocker l'état précédent AVANT d'afficher la confirmation
      setPreviousModeState({
        fusionEnabled,
        fusionMode,
        isManusMode,
        isResearchMode
      })

      setPendingModeSwitch({
        type: targetType,
        fusionMode: fusionMode,
        fusionEnabled: fusionEnabled
      })
    } else {
      setActiveConversationId(null)
      setHistory([])
    }
  }, [isManusMode, fusionMode, fusionEnabled, isResearchMode, isHydrated])

  const confirmModeSwitch = () => {
    setActiveConversationId(null)
    setHistory([])
    const targetType = pendingModeSwitch?.type
    setPendingModeSwitch(null)
    setPreviousModeState(null)

    if (targetType !== 'manus') {
      setModeChangeNotification("Nouveau mode activé : Nouvelle discussion démarrée")
      setTimeout(() => setModeChangeNotification(null), 3000)
    }
  }

  // Fix Bug 6: Revert réel de l'état sur Cancel
  const cancelModeSwitch = () => {
    if (previousModeState) {
      setFusionEnabled(previousModeState.fusionEnabled)
      setFusionMode(previousModeState.fusionMode)
      setIsManusMode(previousModeState.isManusMode)
      setIsResearchMode(previousModeState.isResearchMode)
    }
    setPendingModeSwitch(null)
    setPreviousModeState(null)
  }

  // Fetch project info and conversations when activeProjectId changes
  useEffect(() => {
    if (activeProjectId) {
      const fetchProjectData = async () => {
        const { data: projectData } = await supabase.from('projects').select('*').eq('id', activeProjectId).single()
        if (projectData) setActiveProject(projectData)

        const { data: conversationsData } = await supabase
          .from('conversations')
          .select('*')
          .eq('project_id', activeProjectId)
          .order('created_at', { ascending: false })

        if (conversationsData) setProjectConversations(conversationsData)
      }
      fetchProjectData()
      setSearchQuery('')
      setIsSearchOpen(false)
    } else {
      setActiveProject(null)
      setProjectConversations([])
    }
  }, [activeProjectId, sidebarRefreshKey])

  // Fix Bug 4: fetchMessages avec protection race condition via ID check
  const fetchMessagesRef = useRef(0) // compteur pour invalider les anciens fetchs

  useEffect(() => {
    if (activeConversationId) {
      console.log('✅ useEffect: Calling fetchMessages for conversation:', activeConversationId, { status })
      fetchMessages(activeConversationId)
    }
  }, [activeConversationId])

  const fetchMessages = async (id: string) => {
    console.log('📨 fetchMessages called for conversation:', id)
    const fetchId = ++fetchMessagesRef.current // capturer l'ID du fetch

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error("❌ fetchMessages error:", error)
      return
    }

    // Fix Bug 4: Vérifier que ce fetch est toujours le plus récent
    if (fetchId !== fetchMessagesRef.current) {
      console.warn('🛡️ fetchMessages: Stale fetch ignored (newer fetch in progress)', { fetchId, current: fetchMessagesRef.current })
      return
    }

    // Vérifier aussi que la conversation active n'a pas changé
    if (id !== activeConversationIdRef.current) {
      console.warn('🛡️ fetchMessages: Conversation changed during fetch, ignoring', { fetchedFor: id, currentActive: activeConversationIdRef.current })
      return
    }

    console.log(`✅ fetchMessages: Loaded ${data?.length || 0} messages from DB`)

    if (!data || data.length === 0) {
      console.log('ℹ️ No messages found in DB for this conversation')
      setHistory([])
      return
    }

    const mappedMessages = data.map(m => {
      let meta = null
      if (m.metadata) {
        try {
          meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata
        } catch (e) {
          console.error("Error parsing metadata:", e)
        }
      }

      let citations = []
      if (m.citations) {
        try {
          citations = typeof m.citations === 'string' ? JSON.parse(m.citations) : m.citations
        } catch (e) {
          console.error("Error parsing citations:", e)
        }
      }

      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content || '',
        is_fusion_result: m.is_fusion_result,
        run_id: m.fusion_run_id,
        manus_data: m.manus_structured ? { content: m.content, structured: m.manus_structured } : null,
        is_manus: m.is_manus || m.content?.includes('MANUS_TASK::') || !!m.manus_structured || false,
        manus_status: m.manus_status || null,
        manus_status_text: m.manus_status_text || null,
        manus_task_id: m.manus_task_id || null,
        manus_task_url: m.manus_task_url || null,
        manus_structured: m.manus_structured || null,
        manus_attachments: m.manus_attachments || null,
        web_verified: m.web_verified || false,
        citations: citations,
        metadata: meta
      }
    })

    setHistory(prev => {
      console.log(`🔄 fetchMessages: Updating history (prev: ${prev.length}, new: ${mappedMessages.length})`)

      if (prev.length === 0) {
        console.log('✅ fetchMessages: Local history empty, loading messages from DB')
        return mappedMessages
      }

      if (!isSwitchingConversation.current && prev.length > mappedMessages.length) {
        const lastLocal = prev[prev.length - 1]
        if (lastLocal.role === 'assistant' && !lastLocal.content.includes('⏳')) {
          console.warn('🛡️ fetchMessages: BLOCKING update to avoid local regression', {
            prevLength: prev.length,
            newLength: mappedMessages.length,
            lastMessage: lastLocal.content.substring(0, 50)
          })
          return prev
        }
      }

      console.log('✅ fetchMessages: History updated successfully')
      return mappedMessages
    })
  }

  // Auth Check
  useEffect(() => {
    const checkUser = async () => {
      console.log('🚀 Checking user session...')
      const { data: { session }, error } = await supabase.auth.getSession()
      const user = session?.user
      setUser(user)

      if (error) {
        console.error('❌ Auth error:', error)
        router.push('/login')
        return
      }

      if (!user) {
        console.log('ℹ️ No user session found, redirecting...')
        router.push('/login')
        return
      }

      console.log('✅ User logged in:', user.email)

      const { data: dbProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('❌ Erreur chargement profile SQL:', profileError)
      }

      const meta = user.user_metadata

      if (dbProfile || meta) {
        console.log('📊 Profile SQL chargé:', {
          avatar_url: dbProfile?.avatar_url,
          avatar_zoom: dbProfile?.avatar_zoom,
          avatar_offset_x: dbProfile?.avatar_offset_x,
          avatar_offset_y: dbProfile?.avatar_offset_y,
          avatar_sidebar_zoom: dbProfile?.avatar_sidebar_zoom,
          avatar_sidebar_offset_x: dbProfile?.avatar_sidebar_offset_x,
          avatar_sidebar_offset_y: dbProfile?.avatar_sidebar_offset_y
        })

        setProfile(prev => {
          const newProfile = {
            ...prev,
            firstName: dbProfile?.first_name || meta?.first_name || meta?.full_name?.split(' ')[0] || prev.firstName,
            lastName: dbProfile?.last_name || meta?.last_name || meta?.full_name?.split(' ').slice(1).join(' ') || prev.lastName,
            email: user.email || prev.email,
            photo: dbProfile?.avatar_url || meta?.avatar_url || prev.photo,
            photoZoom: dbProfile?.avatar_zoom ?? prev.photoZoom,
            photoOffset: {
              x: dbProfile?.avatar_offset_x ?? prev.photoOffset.x,
              y: dbProfile?.avatar_offset_y ?? prev.photoOffset.y
            },
            sidebarPhotoZoom: dbProfile?.avatar_sidebar_zoom ?? prev.sidebarPhotoZoom,
            sidebarPhotoOffset: {
              x: dbProfile?.avatar_sidebar_offset_x ?? prev.sidebarPhotoOffset.x,
              y: dbProfile?.avatar_sidebar_offset_y ?? prev.sidebarPhotoOffset.y
            }
          }
          return newProfile
        })
      }
    }
    checkUser()
  }, [router])

  // Diagnostics
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).runDiagnostics = runDiagnostics
      console.log('🔍 Diagnostics available! Run window.runDiagnostics() in console to check database state')

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Running auto-diagnostics...')
        runDiagnostics().then(results => {
          console.log('📊 Diagnostic results:', results)
        })
      }
    }
  }, [])

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedId(index)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleEdit = (text: string) => {
    setPrompt(text)
  }

  // --- MANUS REALTIME SYNC ---
  // Fix Bug 1: Utiliser activeManusTaskId (useMemo stable) comme dépendance
  useEffect(() => {
    if (!activeManusTaskId) {
      if (manusSteps.length > 0) setManusSteps([])
      return
    }

    console.log('📡 Dynamically subscribing to Manus Realtime for task:', activeManusTaskId)

    const messageSub = supabase
      .channel(`manus-msg-sync-${activeManusTaskId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `manus_task_id=eq.${activeManusTaskId}`
      }, (payload) => {
        const updated = payload.new
        setHistory(prev => prev.map(msg =>
          (msg as any).manus_task_id === activeManusTaskId
            ? { ...msg, ...updated }
            : msg
        ))
      })
      .subscribe()

    const progressSub = supabase
      .channel(`manus-progress-sync-${activeManusTaskId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'manus_progress',
        filter: `task_id=eq.${activeManusTaskId}`
      }, (payload) => {
        setManusSteps(prev => [...prev, payload.new])
      })
      .subscribe()

    supabase.from('manus_progress')
      .select('*')
      .eq('task_id', activeManusTaskId)
      .order('received_at', { ascending: true })
      .then(({ data }) => {
        if (data) setManusSteps(data)
      })

    return () => {
      console.log('🔌 Unsubscribing from Manus Realtime')
      supabase.removeChannel(messageSub)
      supabase.removeChannel(progressSub)
    }
  }, [activeManusTaskId])

  // --- VIDEO GLOBAL NOTIFICATIONS ---
  useEffect(() => {
    if (!user?.id) return

    console.log('📡 Subscribing to global video notifications for user:', user.id)

    const channel = supabase
      .channel('global-video-notifications')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'studio_videos',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const { status, prompt, model, video_url, thumbnail_url, id } = payload.new
        const oldStatus = payload.old.status

        if ((status === 'done' || status === 'failed') && (oldStatus === 'processing' || oldStatus === 'pending')) {
          console.log('🔔 Video notification trigger:', status, id)

          const newNotif: VideoNotificationData = {
            id,
            title: prompt,
            status: status as 'done' | 'failed',
            video_url,
            thumbnail_url,
            model
          }

          setVideoNotifications(prev => {
            if (prev.find(n => n.id === id)) return prev
            return [...prev, newNotif]
          })

          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
            audio.volume = 0.2
            audio.play().catch(() => { })
          } catch (e) {
            console.error('Audio failed:', e)
          }

          setTimeout(() => {
            setVideoNotifications(prev => prev.filter(n => n.id !== id))
          }, 8000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    if (isManusMode && result) {
      setHistory(prev => {
        if (prev.length === 0) return prev
        const lastIdx = prev.length - 1
        const lastMsg = prev[lastIdx]

        if (lastMsg.role === 'assistant' && (lastMsg as any).is_manus) {
          try {
            const data = JSON.parse(result)
            if (data.status) {
              const updated = [...prev]
              updated[lastIdx] = {
                ...updated[lastIdx],
                manus_status: data.status === 'completed' ? 'completed' : 'running',
                manus_task_url: data.taskUrl || updated[lastIdx].manus_task_url,
                content: data.status_text || updated[lastIdx].content
              }
              return updated
            }
          } catch {
            const isCompleted = status === 'complete' || status === 'idle' || result.length > 100
            const updated = [...prev]
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: result,
              manus_status: result.includes('❌') ? 'failed' : (isCompleted ? 'completed' : 'running')
            }
            return updated
          }
        }
        return prev
      })
    }
  }, [result, status, isManusMode])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Fix Bug 7: Ne scroller que après envoi d'un message (pas quand on charge un historique)
  useEffect(() => {
    if (justSentMessage) scrollToBottom()
  }, [history, justSentMessage])

  // Écouteur pour les changements de vue globaux
  useEffect(() => {
    const handleViewChange = (e: any) => {
      if (e.detail?.view) {
        setCurrentView(e.detail.view)
        if (e.detail.view === 'canvas') {
          setIsLibraryOpen(false)
          setIsSearchOpen(false)
          setShowReflectionPanel(false)
        }
      }
    }
    window.addEventListener('change-view', handleViewChange)
    return () => window.removeEventListener('change-view', handleViewChange)
  }, [])

  // Fix Bug 8: autoRename ne se déclenche que pour la PREMIÈRE conv (pas de titre existant significatif)
  const autoRenameConversation = async (convId: string, userPrompt: string) => {
    try {
      const renamePrompt = `Analyse ce message et génère un titre ultra-court (max 4 mots) qui résume parfaitement le sujet de la discussion. 
Retourne UNIQUEMENT le titre, sans ponctuation, ni guillemets, ni explication.

MESSAGE : ${userPrompt.substring(0, 500)}`

      const { data, error } = await supabase.functions.invoke('fusion-run', {
        body: {
          prompt: renamePrompt,
          model_slugs: ['gemini-3-flash'],
          master_model_slug: 'gemini-3-flash',
          fusion_mode: 'fusion',
          history: [],
          skip_save: true
        }
      })

      if (error) throw error
      const generatedTitle = data?.fusion?.trim() || userPrompt.substring(0, 40)

      // Fix Bug 8: Ne pas écraser si le titre a déjà été mis à jour par un autre rename
      const { data: currentConv } = await supabase.from('conversations')
        .select('title')
        .eq('id', convId)
        .single()

      // Si le titre actuel n'est plus le prompt original tronqué, un autre rename l'a déjà fait
      if (currentConv?.title && currentConv.title !== userPrompt.substring(0, 40)) {
        console.log('[AutoRename] Skipped — title already updated by another rename')
        return
      }

      await supabase.from('conversations')
        .update({ title: generatedTitle })
        .eq('id', convId)

      setSidebarRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('[AutoRename] Erreur:', err)
    }
  }

  const handleSubmit = async (files?: File[]) => {
    if ((!prompt.trim() && (!files || files.length === 0)) || status !== 'idle') return

    let currentPrompt = prompt
    setPrompt('')

    // Gestion de l'upload des fichiers si présents
    if (files && files.length > 0) {
      try {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `${Date.now()}_${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('chat_attachments')
            .upload(filePath, file)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('chat_attachments')
            .getPublicUrl(filePath)

          return { name: file.name, url: publicUrl }
        })

        const uploadedFiles = await Promise.all(uploadPromises)
        const fileLinks = uploadedFiles.map(f => `\n📎 [${f.name}](${f.url})`).join('')
        currentPrompt += fileLinks
      } catch (err: any) {
        console.error("Upload error:", err)
        alert("Erreur lors de l'upload des fichiers : " + err.message)
      }
    }

    const userMsg = { role: 'user' as const, content: currentPrompt }
    setHistory(prev => [...prev, userMsg])
    setJustSentMessage(true)
    setTimeout(() => setJustSentMessage(false), 3000)

    try {
      let data: any
      const isEffectiveImageMode = isImageMode || IMAGE_MODELS.some(m => m.id === selectedModel)

      // Fix Bug 2: Utiliser la ref pour éviter stale closure
      let convId = activeConversationIdRef.current
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non connecté")

      if (!convId) {
        const mode = isManusMode ? 'manus' :
          isResearchMode ? 'research' :
            isEffectiveImageMode ? 'solo' :
              (fusionEnabled ? fusionMode : 'solo')

        const { data: newConv } = await supabase.from('conversations')
          .insert({
            user_id: user.id,
            title: currentPrompt.substring(0, 40),
            project_id: activeProjectId,
            mode: mode
          })
          .select().single()

        if (newConv) {
          convId = newConv.id
          setActiveConversationId(convId)
          // Fix Bug 2: Mettre à jour la ref immédiatement (pas attendre le re-render)
          activeConversationIdRef.current = convId
          if (convId) autoRenameConversation(convId, currentPrompt)
        }
      }

      if (isResearchMode) {
        const { data: run, error: runError } = await supabase.from('research_runs').insert({
          user_id: user.id,
          conversation_id: convId,
          query: currentPrompt,
          mode: 'web',
          depth: 'standard',
          status: 'pending'
        }).select().single()

        if (runError) throw runError

        supabase.functions.invoke('deep-research', {
          body: {
            run_id: run.id,
            query: currentPrompt,
            mode: 'web',
            depth: researchConfig.depth,
            sites: researchConfig.sources.specificSites ? researchConfig.sites : []
          }
        }).catch(err => console.error("Deep Research Invoke Error:", err))

        return
      }

      if (isManusMode) {
        await supabase.from('messages').insert({
          conversation_id: convId,
          user_id: user.id,
          role: 'user',
          content: currentPrompt
        })

        const { data: placeholderDb } = await supabase.from('messages')
          .insert({
            conversation_id: convId,
            user_id: user.id,
            role: 'assistant',
            content: '⏳ Manus lance la mission...',
            is_manus: true,
            manus_status: 'running'
          })
          .select().single()

        const manusMsgId = placeholderDb?.id

        const placeholderMsg = {
          role: 'assistant' as const,
          content: '⏳ Manus lance la mission...',
          is_manus: true,
          manus_status: 'running' as const,
          id: manusMsgId
        }
        setHistory(prev => [...prev, placeholderMsg])

        try {
          data = await runManus(
            currentPrompt,
            convId || undefined,
            activeProjectId || undefined,
            history,
            manusMsgId
          )

          setHistory(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && (updated[lastIdx] as any).is_manus) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: data?.extracted_content || result || '✅ Terminé',
                manus_status: 'completed',
                manus_data: data?.structured ? { content: data.extracted_content, structured: data.structured } : null,
                manus_structured: data?.structured,
                manus_task_url: data?.task?.url || updated[lastIdx].manus_task_url
              }
            }
            return [...updated]
          })
        } catch (e: any) {
          if (manusMsgId) {
            await supabase.from('messages').update({ content: `❌ Erreur Manus : ${e.message}`, manus_status: 'failed' }).eq('id', manusMsgId)
          }
          setHistory(prev => {
            const updated = [...prev]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && (updated[lastIdx] as any).is_manus) {
              updated[lastIdx] = {
                ...updated[lastIdx],
                content: `❌ Erreur Manus : ${e.message}`,
                manus_status: 'failed'
              }
            }
            return [...updated]
          })
        }
        return
      } else if (isEffectiveImageMode) {
        data = await runImageGen(
          currentPrompt,
          selectedModel,
          convId || undefined,
          activeProjectId || undefined,
          imageCount
        )
      } else if (fusionEnabled) {
        data = await runFusion(
          currentPrompt,
          ['gpt-5.2-pro', 'claude-opus-4-6', 'gemini-3-pro-preview'],
          masterModel,
          fusionMode,
          convId || undefined,
          activeProjectId || undefined,
          history,
          webVerifyEnabled
        )
      } else {
        data = await runSolo(currentPrompt, selectedModel, convId || undefined, activeProjectId || undefined, history, webVerifyEnabled)
      }

      console.log('✅ handleSubmit: Data received from backend:', {
        web_verified: (data as any).web_verified,
        citations_count: (data as any).citations?.length
      })

      const aiMsg = {
        role: 'assistant' as const,
        content: data.fusion,
        is_fusion_result: true,
        run_id: (data as any).run_id,
        manus_data: (data as any).manusData,
        is_manus: isManusMode,
        web_verified: (data as any).web_verified || false,
        citations: (data as any).citations || []
      }

      if (data.conversation_id && !activeConversationIdRef.current) {
        setActiveConversationId(data.conversation_id)
        activeConversationIdRef.current = data.conversation_id
      }

      setHistory(prev => {
        if (isManusMode) {
          const updated = [...prev]
          const lastIdx = updated.length - 1
          if (lastIdx >= 0 && (updated[lastIdx] as any).is_manus) {
            updated[lastIdx] = aiMsg
            return updated
          }
        }
        return [...prev, aiMsg]
      })
    } catch (e: any) {
      console.error(e)
      const errorMsg = {
        role: 'assistant' as const,
        content: `⚠️ **Erreur:** ${e.message || 'Une erreur est survenue.'}`
      }
      setHistory(prev => [...prev, errorMsg])
    }
  }

  const handleNewConversation = () => {
    setActiveConversationId(null)
    setHistory([])
    setPrompt('')
    setCurrentView('chat')
    setIsLibraryOpen(false)
    setShowReflectionPanel(false)
  }

  // Fix Bug 3: Ajouter user_id aux requêtes delete
  const handleDeleteConversation = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id)

    if (msgError) console.error(msgError)

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      alert('Erreur: ' + error.message)
    } else {
      setSidebarRefreshKey(prev => prev + 1)
      if (activeConversationId === id) {
        handleNewConversation()
      }
    }
  }

  const handleRenameConversation = async (id: string, newTitle: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', id)

    if (error) {
      console.error('Erreur renommage:', error)
    } else {
      setSidebarRefreshKey(prev => prev + 1)
    }
  }

  const handleToolSelect = (tool: string) => {
    if (tool === 'image') {
      setIsImageMode(prev => !prev)
      setIsManusMode(false)
      setIsResearchMode(false)
      setFusionEnabled(false)
      if (!isImageMode) setSelectedModel('gemini-3-pro-image-preview')
    } else if (tool === 'manus') {
      setIsImageMode(false)
      setIsManusMode(prev => !prev)
      setIsResearchMode(false)
      setFusionEnabled(false)
    } else if (tool === 'canvas') {
      setCurrentView('canvas')
      setIsLibraryOpen(false)
      setIsSearchOpen(false)
      setShowReflectionPanel(false)
    } else if (tool === 'presentations') {
      setCurrentView('presentations')
      setIsLibraryOpen(false)
      setIsSearchOpen(false)
      setShowReflectionPanel(false)
    } else if (tool === 'deep-research') {
      setIsResearchMode(prev => !prev)
      setIsImageMode(false)
      setIsManusMode(false)
      setFusionEnabled(false)
    } else if (tool === 'none') {
      setIsImageMode(false)
      setIsManusMode(false)
      setIsResearchMode(false)
    } else {
      setIsImageMode(false)
      setIsManusMode(false)
      setIsResearchMode(false)
    }
  }

  const getStatusText = () => {
    if (status === 'idle' || status === 'complete') return ''
    if (isImageMode) return 'GÉNÉRATION D\'IMAGE...'
    if (isManusMode) return ''
    if (isResearchMode) return 'RECHERCHE APPROFONDIE...'
    if (fusionEnabled && fusionMode === 'supernova') {
      if (status === 'analyzing') return 'SUPERNOVA: Phase 1 - Analyse initiale...'
      if (status === 'cross-analysis') return 'SUPERNOVA: Phase 2 - Cross-analyse... 🔥'
      if (status === 'refining') return 'SUPERNOVA: Phase 3 - Affinement des réponses... 🔄'
      if (status === 'synthesizing') return 'SUPERNOVA: Phase 4 - Fact-check & Synthèse Master...'
      if (status === 'fusing') return 'SUPERNOVA: Fusion en cours...'
    }
    return fusionEnabled ? 'FUSION EN COURS...' : `${(selectedModel || '').toUpperCase()} PROCESSING...`
  }

  const handleStopThinking = async () => {
    stop()

    let fastModelId = selectedModel
    if (fusionEnabled) {
      setFusionEnabled(false)
      const master = AVAILABLE_MODELS.find(m => m.id === masterModel) || AVAILABLE_MODELS.find(m => m.id === 'gpt-5.2')
      if (master?.variants?.[0]) fastModelId = master.variants[0].id
    } else {
      const parent = AVAILABLE_MODELS.find(m => m.id === selectedModel)
      if (parent?.variants?.[0]) {
        fastModelId = parent.variants[0].id
      }
    }

    setSelectedModel(fastModelId)

    const lastUserMessage = history.filter(m => m.role === 'user').pop()?.content || ''

    if (!lastUserMessage) {
      console.error('handleStopThinking: No user message found in history')
      return
    }

    try {
      const data = await runSolo(lastUserMessage, fastModelId, activeConversationId || undefined, activeProjectId || undefined, history)

      if (data.conversation_id && !activeConversationId) {
        setActiveConversationId(data.conversation_id)
        activeConversationIdRef.current = data.conversation_id
      }

      const aiMsg = {
        role: 'assistant' as const,
        content: data.fusion,
        is_fusion_result: true,
        run_id: (data as any).run_id
      }
      setHistory(prev => [...prev, aiMsg])
    } catch (e: any) {
      console.error(e)
    }
  }

  // Fix Bug 9: Helper pour sélectionner une conversation (utilisé en 3 endroits)
  const handleSelectConversation = useCallback((conv: { id: string; mode?: string; canvas_mode?: boolean }) => {
    isSwitchingConversation.current = true
    console.log('📋 Selecting conversation:', conv.id, { mode: conv.mode, canvas_mode: conv.canvas_mode })

    if (activeConversationId !== conv.id) {
      console.log('🧹 Clearing local history (switching conversations)')
      setHistory([])
    }
    setJustSentMessage(false)
    setShowReflectionPanel(false)
    setIsLibraryOpen(false)

    // Fix Bug 9: Utiliser la fonction utilitaire
    restoreConversationMode(conv, setFusionEnabled, setFusionMode, setIsManusMode)

    console.log('🎯 Setting active conversation ID:', conv.id)
    setActiveConversationId(conv.id)

    if (conv.mode === 'canvas' || conv.canvas_mode) {
      console.log('🎨 Opening in CANVAS view')
      setCurrentView('canvas')
    } else {
      console.log('💬 Opening in CHAT view')
      setCurrentView('chat')
    }

    setTimeout(() => {
      isSwitchingConversation.current = false
    }, 500)
  }, [activeConversationId])

  return (
    <div className="flex h-screen bg-background text-foreground font-mono overflow-hidden relative">

      <FusionOrb
        isProcessing={status === 'analyzing' || status === 'fusing' || status === 'cross-analysis' || status === 'refining' || status === 'synthesizing'}
        isHovered={!!hoveredFusionMode}
        liveUrl={null}
      />

      {currentView === 'chat' && (
        <>
          <HologramOverlay
            isOpen={isVoiceActive}
            onClose={() => setIsVoiceActive(false)}
            onTranscriptSave={(transcript) => {
              setHistory(prev => [...prev, {
                role: 'assistant',
                content: `🎤 **Note de session vocale:**\n${transcript}`
              }])
            }}
          />

          {!isVoiceActive && (
            <VoiceButton
              isActive={isVoiceActive}
              onClick={() => setIsVoiceActive(true)}
            />
          )}
        </>
      )}

      <div className={`relative z-10 flex w-full h-full transition-all duration-700`}>

        <Sidebar
          status={status}
          error={error}
          fusionEnabled={fusionEnabled}
          onShowReflection={() => {
            if (showReflectionPanel) {
              setShowReflectionPanel(false)
            } else {
              setShowReflectionPanel(true)
              setIsLibraryOpen(false)
              setIsSearchOpen(false)
              if (currentView !== 'chat') setCurrentView('chat')
            }
          }}
          onLogout={handleLogout}
          onNewConversation={handleNewConversation}
          activeConversationId={activeConversationId}
          onSelectConversation={(conv: any) => handleSelectConversation(conv)}
          activeProjectId={activeProjectId}
          onSelectProject={(id) => {
            setActiveProjectId(id)
            handleNewConversation()
            setIsLibraryOpen(false)
            setShowReflectionPanel(false)
            setCurrentView('chat')
          }}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          totalTokensUsed={totalTokensUsed}
          refreshKey={sidebarRefreshKey}
          onOpenLibrary={() => {
            if (isLibraryOpen) {
              setIsLibraryOpen(false)
            } else {
              setIsLibraryOpen(true)
              setShowReflectionPanel(false)
              setIsSearchOpen(false)
              setActiveProjectId(null)
              if (currentView !== 'chat') setCurrentView('chat')
            }
          }}
          isLibraryOpen={isLibraryOpen}
          onOpenSearch={() => {
            if (currentView === 'search') {
              setCurrentView('chat')
            } else {
              setCurrentView('search')
              setIsLibraryOpen(false)
              setShowReflectionPanel(false)
              setActiveProjectId(null)
            }
          }}
          onOpenGPTs={() => {
            if (currentView === 'gpts' || currentView === 'gpts-creator') {
              setCurrentView('chat')
            } else {
              setCurrentView('gpts')
              setIsLibraryOpen(false)
              setIsSearchOpen(false)
              setShowReflectionPanel(false)
              setActiveConversationId(null)
              setActiveProjectId(null)
            }
          }}
          onOpenProjects={() => {
            if (currentView === 'projects') {
              setCurrentView('chat')
            } else {
              setCurrentView('projects')
              setIsLibraryOpen(false)
              setIsSearchOpen(false)
              setShowReflectionPanel(false)
              setActiveProjectId(null)
            }
          }}
          onOpenAdmin={() => {
            if (currentView === 'admin') {
              setCurrentView('chat')
            } else {
              setCurrentView('admin')
              setIsLibraryOpen(false)
              setIsSearchOpen(false)
              setShowReflectionPanel(false)
              setActiveConversationId(null)
              setActiveProjectId(null)
            }
          }}
          onOpenStudio={() => {
            if (currentView === 'studio') {
              setCurrentView('chat')
            } else {
              setCurrentView('studio')
              setIsLibraryOpen(false)
              setIsSearchOpen(false)
              setShowReflectionPanel(false)
              setActiveConversationId(null)
              setActiveProjectId(null)
            }
          }}
          onOpenPresentations={() => {
            if (currentView === 'presentations') {
              setCurrentView('chat')
            } else {
              setCurrentView('presentations')
              setIsLibraryOpen(false)
              setIsSearchOpen(false)
              setShowReflectionPanel(false)
              setActiveConversationId(null)
              setActiveProjectId(null)
            }
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentView={currentView}
          showReflectionPanel={showReflectionPanel}
          profile={profile}
          onOpenNewProject={() => setIsNewProjectModalOpen(true)}
        />

        <div className="flex-1 relative flex flex-col h-full overflow-hidden">
          <AnimatePresence>
            {showReflectionPanel && (
              <ReflectionPanel
                isOpen={showReflectionPanel}
                onClose={() => setShowReflectionPanel(false)}
                rawResponses={rawResponses}
                isLoading={status === 'analyzing' || status === 'fusing' || status === 'cross-analysis' || status === 'synthesizing'}
                fusionResult={result}
                phases={phases}
                exchanges={exchanges}
                fusionMode={fusionMode}
                activeConversationId={activeConversationId || undefined}
                requestedRunId={requestedRunId}
                supabaseClient={supabase}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {isLibraryOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute inset-0 z-[40] bg-background text-foreground"
              >
                <ImageLibrary onClose={() => setIsLibraryOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 flex flex-col items-center h-full z-20 overflow-hidden relative">
            {currentView === 'chat' ? (
              <div className={`flex-1 flex flex-col h-full w-full transition-all duration-1000 ${history.length === 0 ? 'justify-center items-center' : ''}`}>

                {activeProject && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-4 left-4 z-30 flex items-center gap-3 px-4 py-2 bg-white/60 backdrop-blur-md border border-secondary/20 rounded-xl shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {activeProject.image_url ? (
                        <img src={activeProject.image_url} alt="project icon" className="w-8 h-8 rounded-lg object-cover shadow-sm" />
                      ) : (
                        (() => {
                          const IconComponent = activeProject.icon === 'briefcase' ? Briefcase :
                            activeProject.icon === 'star' ? Star :
                              activeProject.icon === 'heart' ? Heart :
                                activeProject.icon === 'cloud' ? Cloud :
                                  activeProject.icon === 'code' ? Code : Folder
                          return <div className="p-1.5 bg-white/50 rounded-lg"><IconComponent size={20} className="text-secondary" /></div>
                        })()
                      )}
                      <div>
                        <span className="text-lg font-bold text-foreground block leading-tight">{activeProject.title}</span>
                        <span className="text-[10px] text-[#5C4B40]/40 uppercase tracking-wider font-semibold">Project Workspace</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeProject && !activeConversationId && (
                  <div className="w-full flex-1 flex flex-col items-center pt-24 px-4 overflow-y-auto no-scrollbar pb-20">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-3xl mb-12 text-center space-y-4"
                    >
                      <h2 className="text-3xl font-light tracking-[0.3em] text-[#5C4B40] uppercase" style={{ fontFamily: "'Avenir', 'Avenir Next', 'Inter', sans-serif" }}>
                        {activeProject.title}
                      </h2>
                      <p className="text-[#5C4B40]/40 text-xs font-medium uppercase tracking-[0.2em]">Espace de Travail</p>
                    </motion.div>

                    <div className="w-full max-w-4xl mb-12">
                      <ChatInput
                        prompt={prompt}
                        setPrompt={setPrompt}
                        onSubmit={handleSubmit}
                        disabled={status !== 'idle' && status !== 'complete'}
                        fusionEnabled={fusionEnabled}
                        onFusionToggle={() => {
                          const newVal = !fusionEnabled
                          setFusionEnabled(newVal)
                          localStorage.setItem('jungle-fusion-enabled', String(newVal))
                        }}
                        fusionMode={fusionMode}
                        onFusionModeChange={(mode) => {
                          setFusionMode(mode)
                          localStorage.setItem('jungle-fusion-mode', mode)
                        }}
                        masterModel={masterModel}
                        onMasterModelChange={(m) => {
                          setMasterModel(m)
                          localStorage.setItem('jungle-master-model', m)
                        }}
                        selectedModel={selectedModel}
                        onModelChange={(m) => {
                          setSelectedModel(m)
                          localStorage.setItem('jungle-selected-model', m)
                        }}
                        isThinking={status !== 'idle' && status !== 'complete'}
                        onStop={handleStopThinking}
                        statusText={getStatusText()}
                        isImageMode={isImageMode}
                        imageCount={imageCount}
                        onImageCountChange={setImageCount}
                        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
                        isSearchOpen={isSearchOpen}
                        onSearchChange={setSearchQuery}
                        searchQuery={searchQuery}
                        onHoverModeChange={setHoveredFusionMode}
                        webVerifyEnabled={webVerifyEnabled}
                        onToggleWebVerify={() => setWebVerifyEnabled(!webVerifyEnabled)}
                      />
                    </div>

                    <div className="w-full max-w-4xl space-y-6">
                      <div className="flex items-center justify-between border-b border-[#5C4B40]/10 pb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/40">Conversations Récentes</h3>
                        <span className="text-[10px] font-bold text-[#5C4B40]/30">{projectConversations.length} DISCUSSIONS</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {projectConversations
                          .filter(c => ((c.title?.toLowerCase().includes(searchQuery.toLowerCase()) || !searchQuery)) && !c.title?.startsWith('Analyse ce message'))
                          .map((conv, idx) => (
                            <motion.div
                              key={conv.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              onClick={() => handleSelectConversation(conv)}
                              className="group bg-white/40 backdrop-blur-md border border-[#5C4B40]/5 p-5 rounded-2xl cursor-pointer hover:bg-white hover:border-[#5C4B40]/20 hover:shadow-xl hover:shadow-[#5C4B40]/5 transition-all flex items-center gap-4 relative overflow-hidden"
                            >
                              <div className="w-10 h-10 rounded-xl bg-[#EAE1D3]/30 flex items-center justify-center text-[#5C4B40]/40 group-hover:bg-[#5C4B40] group-hover:text-white transition-all">
                                <MessageSquare size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-[#5C4B40] mb-0.5 truncate group-hover:text-black transition-colors">
                                  {conv.title || 'Nouvelle discussion'}
                                </h3>
                                <p className="text-[10px] text-[#5C4B40]/40 font-bold uppercase tracking-wider">
                                  {new Date(conv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id) }}
                                  className="p-2 hover:bg-red-50 text-[#5C4B40]/20 hover:text-red-500 rounded-lg transition-all"
                                >
                                  <X size={14} />
                                </button>
                                <ChevronRight size={16} className="text-[#5C4B40]/20" />
                              </div>
                            </motion.div>
                          ))}

                        {projectConversations.length === 0 && (
                          <div className="py-20 text-center space-y-4 bg-white/20 rounded-3xl border-2 border-dashed border-[#5C4B40]/5">
                            <div className="w-12 h-12 rounded-full bg-[#EAE1D3]/30 flex items-center justify-center mx-auto text-[#5C4B40]/20">
                              <Folder size={24} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#5C4B40]/40 uppercase tracking-widest">Aucune discussion</p>
                              <p className="text-[10px] text-[#5C4B40]/30">Posez une question ci-dessus pour commencer.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {modeChangeNotification && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, x: '-50%' }}
                      animate={{ opacity: 1, y: 0, x: '-50%' }}
                      exit={{ opacity: 0, y: -20, x: '-50%' }}
                      className="absolute top-24 left-1/2 z-50 px-6 py-3 rounded-full bg-white border border-[#4a0505] shadow-lg flex items-center gap-3 backdrop-blur-md"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#4a0505] animate-pulse" />
                      <span className="text-xs md:text-sm font-bold text-[#4a0505] uppercase tracking-wide whitespace-nowrap">
                        {modeChangeNotification}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {activeConversationId && (
                  <div className="flex-1 w-full overflow-y-auto p-6 pt-32 space-y-6 no-scrollbar flex flex-col items-center relative">

                    <div className="w-full max-w-6xl space-y-8 pb-32">
                      <AnimatePresence key={activeConversationId}>
                        {history.length === 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 text-center"
                          >
                            <div className="w-16 h-16 rounded-full bg-[#EAE1D3]/30 flex items-center justify-center mx-auto text-[#5C4B40]/20 mb-4">
                              <MessageSquare size={32} />
                            </div>
                            <p className="text-sm font-bold text-[#5C4B40]/40 uppercase tracking-[0.2em]">Discussion vide</p>
                            <p className="text-[10px] text-[#5C4B40]/30 mt-1">Écrivez un message pour commencer.</p>
                          </motion.div>
                        )}
                        {history.filter(msg => !msg.content?.includes('Analyse ce message')).map((msg, idx) => (
                          <motion.div
                            key={msg.id || `msg-${idx}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                              <div className={`text-[10px] font-bold px-1 opacity-70 select-none uppercase tracking-widest flex items-center gap-1.5 mb-1 ${(isManusMode || (fusionEnabled && fusionMode === 'fusion')) ? 'text-[#5C4B40]' :
                                (fusionEnabled && fusionMode === 'supernova') ? 'text-[#800020]' : 'text-[#5C4B40]'
                                }`}>
                                {msg.role === 'assistant' && (
                                  (msg as any).is_manus || (msg as any).manus_data ? (
                                    <img src="/Manus1.png" alt="Manus" className="w-3 h-3 object-contain" />
                                  ) : (
                                    <div className={`w-1 h-1 rounded-full ${fusionEnabled ? (fusionMode === 'supernova' ? 'bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.5)]' : 'bg-white shadow-[0_0_5px_white]') : 'bg-secondary'}`} />
                                  )
                                )}
                                <span>{msg.role === 'user' ? profile.firstName : ((msg as any).is_manus || (msg as any).manus_data ? 'Manus' : (fusionEnabled ? (fusionMode === 'supernova' ? 'Supernova' : 'Fusion Core') : (([...AVAILABLE_MODELS, ...IMAGE_MODELS, ...AVAILABLE_MODELS.flatMap(m => m.variants || [])].find(m => m.id === selectedModel)?.name || selectedModel))))}</span>
                              </div>

                              <div className={`p-4 rounded-2xl border min-w-[60px] ${msg.role === 'user'
                                ? 'bg-secondary/10 border-secondary/20 backdrop-blur-sm text-foreground rounded-tr-none shadow-sm'
                                : 'bg-white/40 border-white/60 backdrop-blur-md text-foreground rounded-tl-none shadow-sm'
                                }`}>
                                {msg.content.includes('![Image]') ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {msg.content.split('\n').map((line, lineIdx) => {
                                        const imageMatch = line.match(/!\[Image\]\((.*?)\)/)
                                        if (imageMatch) {
                                          return (
                                            <div key={lineIdx} className="relative aspect-square rounded-lg overflow-hidden border border-white/20 shadow-sm bg-black/5">
                                              <img
                                                src={imageMatch[1]}
                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                alt="IA Generated"
                                                onClick={() => setPreviewImage(imageMatch[1])}
                                              />
                                            </div>
                                          )
                                        }
                                        return null
                                      })}
                                    </div>
                                    {msg.content.split('\n').map((line, lineIdx) => {
                                      if (!line.includes('![Image]')) {
                                        return <p key={lineIdx} className="text-sm whitespace-pre-wrap">{line}</p>
                                      }
                                      return null
                                    })}
                                  </div>
                                ) : (msg as any).is_manus ? (
                                  (msg as any).manus_status === 'completed' ? (
                                    <div
                                      className="leading-relaxed text-base md:text-lg font-light text-[#1a1a1a]"
                                      style={{ fontFamily: "'Avenir', 'Avenir Next', 'Inter', sans-serif" }}
                                    >
                                      <ReactMarkdown
                                        components={{
                                          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                          ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-2">{children}</ul>,
                                          ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-2">{children}</ol>,
                                          li: ({ children }) => <li>{children}</li>,
                                          h1: ({ children }) => <h1 className="text-2xl font-black mb-4 uppercase tracking-tighter text-[#5C4B40]">{children}</h1>,
                                          h2: ({ children }) => <h2 className="text-xl font-black mb-3 uppercase tracking-tighter text-[#5C4B40]">{children}</h2>,
                                          h3: ({ children }) => <h3 className="text-lg font-black mb-2 uppercase tracking-tighter text-[#5C4B40]">{children}</h3>,
                                          strong: ({ children }) => <strong className="font-black text-[#5C4B40] tracking-tight">{children}</strong>,
                                          code: ({ children }) => <code className="bg-[#5C4B40]/5 px-1.5 py-0.5 rounded-md font-mono text-sm border border-[#5C4B40]/10">{children}</code>,
                                          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#d4a574] underline decoration-skip-ink">{children}</a>,
                                          img: ({ src, alt }) => (
                                            <div className="w-full max-w-2xl aspect-video rounded-[32px] overflow-hidden border border-[#5C4B40]/10 shadow-2xl my-6 bg-white/50 relative group">
                                              <img
                                                src={src}
                                                alt={alt}
                                                onClick={() => src && setPreviewImage(String(src))}
                                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-700"
                                              />
                                            </div>
                                          )
                                        }}
                                      >
                                        {(() => {
                                          let content = msg.content;
                                          try {
                                            let clean = content.trim();
                                            if (clean.startsWith('```')) clean = clean.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
                                            const parsed = JSON.parse(clean);
                                            content = parsed.final_answer || content;
                                          } catch {
                                            content = msg.content;
                                          }
                                          return content === 'MANUS_TASK::COMPLETED' ? 'Mission Manus terminée.' : content;
                                        })()}
                                      </ReactMarkdown>
                                    </div>
                                  ) : (msg as any).manus_status === 'failed' ? (
                                    <p className="text-red-400 font-bold" style={{ fontFamily: "'Avenir', 'Avenir Next', 'Inter', sans-serif" }}>❌ {msg.content}</p>
                                  ) : (
                                    <ManusLivePanel
                                      taskUrl={(msg as any).manus_task_url || ''}
                                      statusText={
                                        msg.content?.startsWith('MANUS_TASK::')
                                          ? 'Manus travaille sur sa mission...'
                                          : (msg.content || (msg as any).manus_status_text || "Manus travaille...")
                                      }
                                      steps={manusSteps}
                                    />
                                  )
                                ) : msg.metadata?.type === 'research_report' ? (
                                  <div className="mt-2 w-full">
                                    <ResearchReportCard
                                      metadata={msg.metadata}
                                      supabase={supabase}
                                      onOpenPanel={(id) => setActiveResearchRunId(id)}
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="leading-relaxed text-base md:text-lg font-light text-[#1a1a1a]"
                                    style={{ fontFamily: "'Avenir', 'Avenir Next', 'Inter', sans-serif" }}
                                  >
                                    <ReactMarkdown
                                      components={{
                                        p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                                        ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-2">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-2">{children}</ol>,
                                        li: ({ children }) => <li>{children}</li>,
                                        strong: ({ children }) => <strong className="font-black text-[#5C4B40] tracking-tight">{children}</strong>,
                                        code: ({ children }) => <code className="bg-[#5C4B40]/5 px-1.5 py-0.5 rounded-md font-mono text-sm border border-[#5C4B40]/10">{children}</code>,
                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#d4a574] underline decoration-skip-ink">{children}</a>,
                                        img: ({ src, alt }) => (
                                          <div className="w-full max-w-2xl aspect-video rounded-[32px] overflow-hidden border border-[#5C4B40]/10 shadow-2xl my-6 bg-white/50 relative group">
                                            <img
                                              src={src}
                                              alt={alt}
                                              onClick={() => src && setPreviewImage(src as string)}
                                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-700"
                                            />
                                          </div>
                                        )
                                      }}
                                    >
                                      {(() => {
                                        let displayContent = msg.content || ''
                                        if (!displayContent) return ''

                                        const hasCitations = (msg as any).citations?.length > 0

                                        if (hasCitations) {
                                          const cites = (msg as any).citations as { index: number, url: string }[]
                                          const sortedCites = [...cites].sort((a, b) => b.index.toString().length - a.index.toString().length)

                                          sortedCites.forEach((cite) => {
                                            const marker = `[${cite.index}]`
                                            if (displayContent.includes(marker) && !displayContent.includes(`(${cite.url})`)) {
                                              const escapedMarker = `\\[${cite.index}\\]`
                                              const regex = new RegExp(escapedMarker, 'g')
                                              displayContent = displayContent.replace(regex, `[${marker}](${cite.url})`)
                                            }
                                          })

                                          displayContent = displayContent.replace(/\n*(---SOURCES---|Sources\s*:)[\s\S]*$/i, '').trim()
                                        }
                                        return displayContent
                                      })()}
                                    </ReactMarkdown>
                                  </div>
                                )}

                                {(msg as any).web_verified && (msg as any).citations?.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-[#5C4B40]/10">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-[#EAE1D3] to-[#c1b2a2] flex items-center justify-center border border-[#5C4B40]/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]">Vérifié par le web</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {((msg as any).citations as { index: number, title: string, url: string, snippet: string }[]).map((cite) => {
                                        let shortDomain = cite.url
                                        try {
                                          const u = new URL(cite.url)
                                          shortDomain = u.hostname.replace(/^www\./, '')
                                        } catch { }
                                        return (
                                          <a
                                            key={cite.index}
                                            href={cite.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#5C4B40] bg-[#EAE1D3]/40 hover:bg-[#EAE1D3] border border-[#5C4B40]/10 hover:border-[#5C4B40]/30 rounded-full transition-all cursor-pointer hover:shadow-md"
                                            title={cite.title || cite.snippet}
                                          >
                                            <span className="font-black">[{cite.index}]</span>
                                            <span className="truncate max-w-[240px]">{cite.title || shortDomain}</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40 flex-shrink-0"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                          </a>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className={`flex items-center gap-1.5 w-full px-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className="flex items-center gap-1 group/copy-container relative">
                                  <button
                                    onClick={() => handleCopy(msg.content, idx)}
                                    className="p-1 hover:bg-[#5C4B40]/5 rounded-md text-[#5C4B40]/25 hover:text-[#5C4B40] transition-all flex items-center gap-1.5 group/btn"
                                    title="Copier"
                                  >
                                    <Copy size={11} className="group-hover/btn:scale-110 transition-transform" />
                                  </button>
                                  <AnimatePresence>
                                    {copiedId === idx && (
                                      <motion.span
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -5 }}
                                        className="text-[9px] font-black uppercase tracking-widest text-white bg-[#5C4B40] px-2 py-0.5 rounded border border-[#5C4B40] absolute left-full ml-1 shadow-md whitespace-nowrap z-50 pointer-events-none"
                                      >
                                        Copié
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {msg.role === 'user' && (
                                  <button
                                    onClick={() => handleEdit(msg.content)}
                                    className="p-1 hover:bg-[#5C4B40]/5 rounded-md text-[#5C4B40]/25 hover:text-[#5C4B40] transition-all flex items-center gap-1.5 group/btn"
                                    title="Modifier"
                                  >
                                    <Pencil size={11} className="group-hover/btn:scale-110 transition-transform" />
                                  </button>
                                )}

                                {msg.role === 'assistant' && msg.is_fusion_result && (
                                  <button
                                    onClick={() => {
                                      setRequestedRunId(msg.run_id || null)
                                      setShowReflectionPanel(true)
                                    }}
                                    className="p-1 hover:bg-[#5C4B40]/5 rounded-md text-[#5C4B40]/25 hover:text-[#5C4B40] transition-all flex items-center gap-1.5 group/btn ml-auto"
                                  >
                                    <Brain size={11} className="group-hover/btn:scale-110 group-hover/btn:text-orange-500 transition-all" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {status !== 'idle' && status !== 'complete' && !isManusMode && (
                        <div className="flex justify-start p-4">
                          <div className={`text-xs font-black flex gap-2 items-center ${isManusMode || (fusionMode === 'fusion' && fusionEnabled) ? 'text-[#5C4B40]' : (fusionMode === 'supernova' && fusionEnabled ? 'text-[#800020]' : 'text-secondary')}`}>
                            <span className={`w-2.5 h-2.5 rounded-full animate-ping ${isManusMode || (fusionMode === 'fusion' && fusionEnabled) ? 'bg-[#5C4B40]' : (fusionMode === 'supernova' && fusionEnabled ? 'bg-[#800020]' : 'bg-secondary')}`} />
                            {getStatusText()}
                          </div>
                        </div>
                      )}
                    </div>
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {!activeProject && history.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                  >
                    <div className="flex justify-center mb-4">
                      <img
                        src="/logos/Jungle_studio.png"
                        alt="Jungle Studio Logo"
                        className="h-32 md:h-48 w-auto object-contain brightness-110 drop-shadow-sm transition-all hover:scale-105"
                      />
                    </div>
                    <h1
                      className="text-2xl font-light tracking-[0.4em] text-foreground mb-4 opacity-80 uppercase"
                      style={{
                        fontFamily: "'Avenir', 'Avenir Next', 'Inter', sans-serif",
                        textShadow: '0 0 15px rgba(255, 255, 255, 0.4)'
                      }}
                    >
                      JUNGLE STUDIO
                    </h1>
                  </motion.div>
                )}

                {(!activeProject || activeConversationId) && (
                  <div className={`w-full flex flex-col items-center justify-end p-6 bg-gradient-to-t from-background via-background/80 to-transparent transition-all duration-700 pointer-events-none ${history.length === 0 ? 'max-w-4xl scale-110 mb-10' : 'max-w-full absolute bottom-0 left-0 right-0 z-40'}`}>

                    <AnimatePresence>
                      {pendingModeSwitch && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 20 }}
                          className="pointer-events-auto mb-4 bg-white border border-[#4a0505] shadow-lg rounded-xl p-4 flex items-center justify-between gap-6 max-w-xl w-full"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#4a0505]/10 flex items-center justify-center text-[#4a0505]">
                              <img src="/fusion.png" alt="Mode Switch" className="w-5 h-5 object-contain" style={{ filter: 'brightness(0) saturate(100%) invert(8%) sepia(94%) saturate(4649%) hue-rotate(352deg) brightness(96%) contrast(101%)' }} />
                            </div>
                            <div>
                              <h4 className="font-bold text-[#4a0505]">Changer de mode ?</h4>
                              <p className="text-xs text-[#5C4B40]/80">Une nouvelle discussion sera créée.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={cancelModeSwitch}
                              className="px-3 py-1.5 text-xs font-bold text-[#5C4B40]/60 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-lg transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={confirmModeSwitch}
                              className="px-4 py-1.5 text-xs font-bold text-white bg-[#4a0505] hover:bg-[#3d0404] rounded-lg transition-colors shadow-sm"
                            >
                              Confirmer
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className={`w-full pointer-events-auto transition-all duration-700 ${history.length === 0 ? 'max-w-4xl' : 'max-w-6xl'}`}>
                      <ChatInput
                        prompt={prompt}
                        setPrompt={setPrompt}
                        onSubmit={handleSubmit}
                        disabled={status !== 'idle' && status !== 'complete'}
                        fusionEnabled={fusionEnabled}
                        onFusionToggle={() => setFusionEnabled(!fusionEnabled)}
                        fusionMode={fusionMode}
                        onFusionModeChange={setFusionMode}
                        masterModel={masterModel}
                        onMasterModelChange={setMasterModel}
                        selectedModel={selectedModel}
                        onModelChange={(m) => {
                          setSelectedModel(m)
                          setIsManusMode(false)
                        }}
                        onToolSelect={handleToolSelect}
                        isImageMode={isImageMode}
                        isManusMode={isManusMode}
                        isResearchMode={isResearchMode}
                        imageCount={imageCount}
                        onImageCountChange={setImageCount}
                        isThinking={status !== 'idle' && status !== 'complete'}
                        onStop={handleStopThinking}
                        statusText={getStatusText()}
                        webVerifyEnabled={webVerifyEnabled}
                        onToggleWebVerify={() => setWebVerifyEnabled(!webVerifyEnabled)}
                        researchConfig={researchConfig}
                        onResearchConfigChange={setResearchConfig}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : currentView === 'admin' ? (
              <AdminDashboard
                totalTokensUsed={totalTokensUsed}
                onClose={() => setCurrentView('chat')}
                profile={profile}
                setProfile={setProfile}
                refreshSidebar={() => setSidebarRefreshKey(prev => prev + 1)}
              />
            ) : currentView === 'canvas' ? (
              <CanvasView
                projectId={activeProjectId}
                selectedModel={selectedModel}
                initialConversationId={activeConversationId || undefined}
                onClose={() => setCurrentView('chat')}
              />
            ) : currentView === 'search' ? (
              <GlobalSearch
                onClose={() => setCurrentView('chat')}
                activeProjectId={activeProjectId}
                onSelectConversation={async (id) => {
                  isSwitchingConversation.current = true
                  console.log('🔍 Selecting conversation from search:', id)

                  const { data: conv, error } = await supabase
                    .from('conversations')
                    .select('canvas_mode, mode')
                    .eq('id', id)
                    .single()

                  if (error) {
                    console.error('❌ Error loading conversation info:', error)
                    isSwitchingConversation.current = false
                    return
                  }

                  if (activeConversationId !== id) {
                    setHistory([])
                  }
                  setJustSentMessage(false)

                  // Fix Bug 9: Utiliser la fonction utilitaire
                  restoreConversationMode(
                    conv || {},
                    setFusionEnabled,
                    setFusionMode,
                    setIsManusMode
                  )

                  setIsLibraryOpen(false)
                  setShowReflectionPanel(false)
                  setActiveConversationId(id)

                  if (conv?.mode === 'canvas' || conv?.canvas_mode) {
                    setCurrentView('canvas')
                  } else {
                    setCurrentView('chat')
                  }

                  setTimeout(() => {
                    isSwitchingConversation.current = false
                  }, 500)
                }}
              />
            ) : currentView === 'projects' ? (
              <ProjectsView
                onClose={() => setCurrentView('chat')}
                onSelectProject={(id) => {
                  setActiveProjectId(id)
                  setCurrentView('chat')
                  handleNewConversation()
                  setIsLibraryOpen(false)
                }}
                onOpenSettings={(p) => {
                  setSelectedProjectForSettings(p)
                  setIsSettingsModalOpen(true)
                }}
                onOpenNewProject={() => setIsNewProjectModalOpen(true)}
              />
            ) : currentView === 'studio' ? (
              <div className="w-full flex flex-col h-full bg-[#EAE1D3] overflow-hidden">
                <StudioHeader
                  activeTab={activeStudioTab}
                  onTabChange={setActiveStudioTab}
                  onClose={() => setCurrentView('chat')}
                />
                <div className="flex-1 overflow-hidden relative">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full"
                  >
                    {activeStudioTab === 'image' ? (
                      <StudioLayout />
                    ) : (
                      <VideoStudioLayout user={user} />
                    )}
                  </motion.div>
                </div>
              </div>
            ) : currentView === 'presentations' ? (
              <PresentationsLayout />
            ) : (
              <div className="flex-1 w-full h-full overflow-hidden relative">
                {gptsSubView === 'discovery' ? (
                  <GPTsDiscovery
                    onCreateClick={() => {
                      setEditingBotId(null)
                      setGptsSubView('creator')
                    }}
                    onEditClick={(botId) => {
                      setEditingBotId(botId)
                      setGptsSubView('creator')
                    }}
                    refreshKey={refreshBotsKey}
                    activeProjectId={activeProjectId}
                  />
                ) : (
                  <GPTsCreator
                    botId={editingBotId || undefined}
                    onBack={() => {
                      setEditingBotId(null)
                      setGptsSubView('discovery')
                    }}
                    onDeploy={() => {
                      setEditingBotId(null)
                      setGptsSubView('discovery')
                      setRefreshBotsKey(prev => prev + 1)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeResearchRunId && (
        <DeepResearchPanel
          runId={activeResearchRunId}
          onClose={() => setActiveResearchRunId(null)}
          onSendToCanvas={async (content, title) => {
            try {
              setActiveResearchRunId(null)

              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return

              const { data: newConv } = await supabase.from('conversations')
                .insert({
                  user_id: user.id,
                  title: title.substring(0, 40),
                  project_id: activeProjectId,
                  mode: 'canvas'
                })
                .select().single()

              if (newConv) {
                setActiveConversationId(newConv.id)
                setHistory([])
                setCurrentView('canvas')

                const res = await fetch('/api/canvas', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: title,
                    content: content,
                    kind: 'doc',
                    project_id: activeProjectId
                  })
                })
                const data = await res.json()
                console.log('📐 Artefact Canevas créé:', data)
              }
            } catch (err) {
              console.error('❌ Erreur lors de l\'envoi vers Canevas:', err)
            }
          }}
        />
      )}

      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-12 cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl max-h-full flex items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 md:-right-12 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                title="Fermer"
              >
                <X size={24} />
              </button>
              <img
                src={previewImage}
                alt="Enlarged view"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
              />
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-4">
                <a
                  href={previewImage}
                  download="generated-image.png"
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white text-sm font-bold backdrop-blur-md border border-white/10 transition-all"
                >
                  <Download size={18} /> Télécharger HD
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={selectedProjectForSettings}
        onUpdate={() => setSidebarRefreshKey(prev => prev + 1)}
        onDelete={(id) => {
          setSidebarRefreshKey(prev => prev + 1)
        }}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreate={(title, icon, image) => {
          const handleCreate = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { error } = await supabase.from('projects').insert({
              user_id: user.id,
              title,
              icon: typeof icon === 'string' ? icon : 'folder',
              image_url: image
            })
            if (!error) {
              setSidebarRefreshKey(prev => prev + 1)
              setIsNewProjectModalOpen(false)
            }
          }
          handleCreate()
        }}
      />

      <NotificationSystem
        notifications={videoNotifications}
        onClose={(id) => setVideoNotifications(prev => prev.filter(n => n.id !== id))}
        onView={(id) => {
          setVideoNotifications(prev => prev.filter(n => n.id !== id))
          setActiveStudioTab('video')
          setCurrentView('studio')
        }}
      />
    </div >
  )
}
