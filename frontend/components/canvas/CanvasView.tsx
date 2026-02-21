'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  X,
  History,
  Save,
  ChevronLeft,
  FileText,
  Code,
  Sparkles,
  Loader2,
  ChevronRight,
  RotateCcw,
  Check,
  Presentation,
  Download,
  Copy,
  Monitor,
  Play,
  Brain,
  ChevronDown,
  Mic,
  Plus
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import ReactMarkdown from 'react-markdown'
import PptxGenJS from 'pptxgenjs'
import { useFusionEngine } from '@/hooks/useFusionEngine'
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea'

interface TextStyle {
  fontSize?: string
  fontWeight?: string
  color?: string
  textAlign?: 'left' | 'center' | 'right'
}

type Block =
  | { id: string; type: 'h1'; content: string; style?: TextStyle }
  | { id: string; type: 'h2'; content: string; style?: TextStyle }
  | { id: string; type: 'text'; content: string; style?: TextStyle }
  | { id: string; type: 'bullets'; items: string[]; style?: TextStyle }
  | { id: string; type: 'image'; src: string; caption?: string; width: 'full' | 'half'; style?: TextStyle }
  | { id: string; type: 'grid'; columns: 2 | 3; items: Block[]; style?: TextStyle }
  | { id: string; type: 'stat'; value: string; label: string; icon?: string; style?: TextStyle }
  | { id: string; type: 'quote'; content: string; author?: string; style?: TextStyle }
  | { id: string; type: 'divider'; style?: TextStyle }
  | { id: string; type: 'spacer'; height: number; style?: TextStyle }

interface SlideTheme {
  background: string
  textColor: string
  accentColor: string
  cardBg?: string
}

interface Slide {
  id: string
  blocks: Block[]
  theme: SlideTheme
  backgroundImage?: string
}

interface CanvasState {
  slides: Slide[]
  activeSlideIndex: number
  selectedBlockId: string | null
  title: string
}

const SLIDE_THEMES: Record<string, SlideTheme> = {
  'midnight-blue': {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    textColor: '#ffffff',
    accentColor: '#e94560',
    cardBg: 'rgba(255,255,255,0.08)'
  },
  'emerald': {
    background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    textColor: '#ffffff',
    accentColor: '#34d399',
    cardBg: 'rgba(255,255,255,0.1)'
  },
  'warm-cream': {
    background: 'linear-gradient(135deg, #FDFCF8 0%, #F5F0E8 100%)',
    textColor: '#5C4B40',
    accentColor: '#c2410c',
    cardBg: '#ffffff'
  },
  'royal-purple': {
    background: 'linear-gradient(135deg, #3b0764 0%, #6b21a8 100%)',
    textColor: '#ffffff',
    accentColor: '#e9d5ff',
    cardBg: 'rgba(255,255,255,0.08)'
  },
  'ocean': {
    background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
    textColor: '#ffffff',
    accentColor: '#7dd3fc',
    cardBg: 'rgba(255,255,255,0.1)'
  },
  'sunset': {
    background: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)',
    textColor: '#ffffff',
    accentColor: '#fbbf24',
    cardBg: 'rgba(255,255,255,0.1)'
  },
  'clean-white': {
    background: '#ffffff',
    textColor: '#1a1a2e',
    accentColor: '#0369a1',
    cardBg: '#f8fafc'
  },
  'jungle': {
    background: 'linear-gradient(135deg, #5C4B40 0%, #8B7355 100%)',
    textColor: '#ffffff',
    accentColor: '#EAE1D3',
    cardBg: 'rgba(255,255,255,0.1)'
  }
}

interface Version {
  id: string
  summary: string
  created_at: string
}

export default function CanvasView({
  projectId,
  selectedModel = 'gemini-3-flash',
  initialMode = 'document',
  onClose,
  initialConversationId
}: {
  projectId?: string | null,
  selectedModel?: string,
  initialMode?: 'slides' | 'document',
  onClose?: () => void,
  initialConversationId?: string
}) {
  const supabase = createClient()

  type CanvasMode = 'slides' | 'document' | 'html' | 'react'
  const [canvasState, setCanvasState] = useState<CanvasState>({
    slides: [],
    activeSlideIndex: 0,
    selectedBlockId: null,
    title: 'Nouvelle Présentation'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])

  // Canvas View States
  const [canvasMode, setCanvasMode] = useState<CanvasMode>(initialMode as CanvasMode)
  const [canvasView, setCanvasView] = useState<'preview' | 'code'>('preview')
  const [isPresenting, setIsPresenting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [documentContent, setDocumentContent] = useState<string>('')

  // Assistant state
  const { runSolo, status: fusionStatus, error: fusionError } = useFusionEngine()
  const [prompt, setPrompt] = useState('')
  const [currentPresentationId, setCurrentPresentationId] = useState<string | null>(null)
  const [userOriginalPrompt, setUserOriginalPrompt] = useState<string>('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [presentations, setPresentations] = useState<any[]>([])
  const [isNavHovered, setIsNavHovered] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [expandedModel, setExpandedModel] = React.useState<string | null>(null)
  const assistantTextareaRef = useRef<HTMLTextAreaElement>(null)
  const propertiesTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [canvasSelectedModel, setCanvasSelectedModel] = useState(selectedModel)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
  const [conversationId, setConversationId] = useState<string>('')
  const [canvasHistory, setCanvasHistory] = useState<any[]>([])
  const [currentVersion, setCurrentVersion] = useState<number>(1)

  // Resize State
  const [chatWidth, setChatWidth] = useState(280)
  const chatWidthRef = useRef(chatWidth)

  useEffect(() => {
    chatWidthRef.current = chatWidth
  }, [chatWidth])

  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const chatEndRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX < 150) {
        setChatWidth(0)
      } else {
        const newWidth = Math.min(Math.max(e.clientX, 300), 600)
        setChatWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      // Fix Bug 7: Use ref to get current value, not stale closure
      if (typeof window !== 'undefined') {
        localStorage.setItem('jungle-canvas-chat-width', chatWidthRef.current.toString())
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedModel = localStorage.getItem('canvas_last_model')
    if (savedModel) {
      if (savedModel === 'nano-banana-pro') {
        setCanvasSelectedModel('gemini-3-flash')
        localStorage.setItem('canvas_last_model', 'gemini-3-flash')
      } else {
        setCanvasSelectedModel(savedModel)
      }
    } else {
      setCanvasSelectedModel('gemini-3-flash')
    }
    const savedWidth = localStorage.getItem('jungle-canvas-chat-width')
    if (savedWidth) {
      setChatWidth(parseInt(savedWidth))
    }

    // Charger l'historique au montage
    loadCanvasHistory().then(setCanvasHistory)

    if (initialConversationId) {
      loadCanvasContent(initialConversationId)
    }
  }, [initialConversationId])

  // Presentation State
  const [isPresentingMode, setIsPresentingMode] = useState(false)
  const [presentingIndex, setPresentingIndex] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)

  // --- Edition Logic ---
  const updateBlockContent = (slideIndex: number, blockId: string, newContent: string) => {
    setCanvasState(prev => {
      const newSlides = [...prev.slides]
      newSlides[slideIndex] = {
        ...newSlides[slideIndex],
        blocks: newSlides[slideIndex].blocks.map((b: any) =>
          b.id === blockId ? { ...b, content: newContent } : b
        ),
        backgroundImage: undefined // On retire l'image si on modifie le texte
      }
      return { ...prev, slides: newSlides }
    })
  }

  const updateBlockItems = (slideIndex: number, blockId: string, newItems: string[]) => {
    setCanvasState(prev => {
      const newSlides = [...prev.slides]
      newSlides[slideIndex] = {
        ...newSlides[slideIndex],
        blocks: newSlides[slideIndex].blocks.map((b: any) =>
          b.id === blockId ? { ...b, items: newItems } : b
        ),
        backgroundImage: undefined
      }
      return { ...prev, slides: newSlides }
    })
  }

  const removeBlockFromSlide = (slideIndex: number, blockId: string) => {
    setCanvasState(prev => {
      const newSlides = [...prev.slides]
      newSlides[slideIndex] = {
        ...newSlides[slideIndex],
        blocks: newSlides[slideIndex].blocks.filter((b: any) => b.id !== blockId),
        backgroundImage: undefined
      }
      return { ...prev, slides: newSlides }
    })
  }

  const addBlockToSlide = (slideIndex: number, type: string) => {
    const newBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: type as any,
      content: type === 'h2' ? 'Nouveau titre' : type === 'text' ? 'Nouveau texte' : '',
      items: type === 'bullets' ? ['Point 1', 'Point 2'] : undefined
    }
    setCanvasState(prev => {
      const newSlides = [...prev.slides]
      newSlides[slideIndex] = {
        ...newSlides[slideIndex],
        blocks: [...newSlides[slideIndex].blocks, newBlock],
        backgroundImage: undefined
      }
      return { ...prev, slides: newSlides }
    })
  }

  const resetCanvas = () => {
    setConversationId('')
    setChatHistory([])
    setCanvasState({
      slides: [],
      activeSlideIndex: 0,
      selectedBlockId: null,
      title: 'Nouveau Projet'
    })
    setHtmlContent('')
    setPrompt('')
    setUserOriginalPrompt('')
    console.log('[Canvas] Session réinitialisée')
  }

  // --- Storage & Sync Logic ---
  const saveCanvasContent = async (convId: string, override?: { mode?: CanvasMode, title?: string, slides?: any[], html?: string }) => {
    setIsSaving(true)
    try {
      const mode = override?.mode || canvasMode
      const currentTitle = override?.title || canvasState.title

      const content: any = { mode, title: currentTitle }
      if (mode === 'slides') content.slides = override?.slides || canvasState.slides
      if (mode === 'html') content.html = override?.html || htmlContent
      if (mode === 'document') content.content = override?.html || documentContent

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (currentPresentationId) {
        // Fix Bug 5: Separate update with user_id filter
        const { error } = await supabase
          .from('canvas_artifacts')
          .update({
            mode: mode,
            title: currentTitle,
            content: content,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentPresentationId)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('canvas_artifacts')
          .insert({
            conversation_id: convId,
            user_id: user.id,
            project_id: projectId,
            mode: mode,
            title: currentTitle,
            content: content,
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        if (data) {
          setCurrentPresentationId(data.id)
          setCurrentVersion(data.current_version || 1)
        }
      }
    } catch (err) {
      console.error('[Canvas] Erreur sauvegarde:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const saveEditedSlides = async () => {
    if (!currentPresentationId) return
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const nextVersion = (currentVersion || 1) + 1
      const slidesForSave = canvasState.slides.map((slide, i) => ({
        index: i,
        blocks: slide.blocks,
        theme: slide.theme,
        backgroundImage: slide.backgroundImage || null
      }))

      // 1. Mettre à jour l'artifact principal
      const { error: patchError } = await supabase
        .from('canvas_artifacts')
        .update({
          content: { mode: canvasMode, title: canvasState.title, slides: slidesForSave },
          is_edited: true,
          current_version: nextVersion,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentPresentationId)
        .eq('user_id', user.id) // Fix Bug 8

      if (patchError) throw patchError

      // 2. Sauvegarder la version pour historique
      const versionInserts = canvasState.slides.map((slide, i) => ({
        canvas_artifact_id: currentPresentationId,
        user_id: user.id,
        version: nextVersion,
        slide_index: i,
        blocks: slide.blocks,
        theme: slide.theme,
        background_image: slide.backgroundImage || null
      }))

      const { error: versionError } = await supabase
        .from('canvas_slide_versions')
        .insert(versionInserts)

      if (versionError) throw versionError

      setCurrentVersion(nextVersion)
      console.log('[Canvas] Édition sauvegardée, version:', nextVersion)
    } catch (err) {
      console.error('[Canvas] Erreur saveEditedSlides:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const loadCanvasContent = async (convId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('canvas_artifacts')
        .select('*')
        .eq('conversation_id', convId)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        console.error('[Canvas] Artifact non trouvé ou erreur:', error)
        return
      }

      console.log('[Canvas] Chargement artifact:', data.mode, data.title)
      const content = data.content
      const mode = (data.mode as CanvasMode)

      // Réinitialisation propre avant chargement
      setCanvasMode(mode)
      setCanvasState(prev => ({ ...prev, title: data.title, selectedBlockId: null }))

      if (mode === 'slides' && content.slides) {
        setHtmlContent('')
        setCanvasState(prev => ({
          ...prev,
          slides: content.slides.map((s: any) => ({
            id: s.id || crypto.randomUUID(),
            blocks: s.blocks,
            theme: s.theme,
            backgroundImage: s.backgroundImage || null
          })),
          activeSlideIndex: 0
        }))
      } else if (content.htmlContent || mode !== 'slides') {
        const loadedHtml = content.htmlContent || ''
        setCanvasState(prev => ({ ...prev, slides: [] }))
        setHtmlContent(loadedHtml)
      }

      setChatHistory([
        { role: 'assistant', content: `Chargement du projet **${data.title}** (${mode})...` }
      ])

      setConversationId(convId)
    } catch (err) {
      console.error('[Canvas] Erreur chargement:', err)
    }
  }

  const loadCanvasHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return []

    const { data, error } = await supabase
      .from('canvas_artifacts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[Canvas] Erreur chargement historique:', error)
      return []
    }
    return data || []
  }

  // Helpers
  const getCanvasSystemPrompt = () => {
    // ... (existant)
  }

  const detectCanvasMode = (message: string): CanvasMode => {
    const msg = message.toLowerCase()

    // Mode HTML / Application
    if (msg.includes('page html') || msg.includes('landing page') || msg.includes('site web') ||
      msg.includes('page web') || msg.includes('website')) {
      return 'html'
    }

    // Mode React / Application interactive
    if (msg.includes('application') || msg.includes('app') || msg.includes('jeu') ||
      msg.includes('game') || msg.includes('dashboard') || msg.includes('calculateur') ||
      msg.includes('todo') || msg.includes('formulaire') || msg.includes('coder') ||
      msg.includes('code') || msg.includes('react') || msg.includes('composant')) {
      return 'react'
    }

    // Mode Document
    if (msg.includes('document') || msg.includes('rapport') || msg.includes('article') ||
      msg.includes('lettre') || msg.includes('essai') || msg.includes('rédige') ||
      msg.includes('écris') || msg.includes('texte') || msg.includes('a4') ||
      msg.includes('memo') || msg.includes('note')) {
      return 'document'
    }

    // Mode Slides par défaut
    return 'slides'
  }

  const parseSlidesResponse = (response: string): CanvasState | null => {
    let jsonContent = ''
    const tagMatch = response.match(/<slides>([\s\S]*?)<\/slides>/)

    if (tagMatch) {
      jsonContent = tagMatch[1]
    } else {
      const trimmed = response.trim()
      if (trimmed.startsWith('{') && trimmed.includes('"slides"')) {
        jsonContent = trimmed
      }
    }

    if (!jsonContent) return null

    try {
      const data = JSON.parse(jsonContent.trim())
      const theme = SLIDE_THEMES[data.theme] || SLIDE_THEMES['warm-cream']

      const normalizeBlock = (block: any): any => ({
        ...block,
        id: block.id || crypto.randomUUID(),
        content: block.content || block.value || '',
        items: block.items
          ? Array.isArray(block.items)
            ? block.items.map((item: any) =>
              typeof item === 'string' ? item : normalizeBlock(item)
            )
            : block.items
          : undefined
      })

      const slides = data.slides.map((s: any, i: number) => ({
        id: crypto.randomUUID(),
        blocks: s.blocks.map(normalizeBlock),
        theme: i === 0 ? theme : { ...theme },
        backgroundImage: undefined
      }))

      const firstH1 = slides[0]?.blocks.find((b: any) => b.type === 'h1')

      return {
        title: firstH1?.content || 'Sans titre',
        activeSlideIndex: 0,
        selectedBlockId: null,
        slides
      }
    } catch (e) {
      console.error("Parse Error:", e)
      return null
    }
  }

  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (canvasState.activeSlideIndex !== undefined && slideRefs.current[canvasState.activeSlideIndex]) {
      slideRefs.current[canvasState.activeSlideIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [canvasState.activeSlideIndex])

  // Navigation au clavier mode présentation
  useEffect(() => {
    if (!isPresentingMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setPresentingIndex(prev => Math.min(canvasState.slides.length - 1, prev + 1))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPresentingIndex(prev => Math.max(0, prev - 1))
      }
      if (e.key === 'Escape') {
        setIsPresentingMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresentingMode, canvasState.slides.length])

  useAutoResizeTextarea(assistantTextareaRef, prompt)
  useAutoResizeTextarea(propertiesTextareaRef, (canvasState.slides[canvasState.activeSlideIndex]?.blocks.find(b => b.id === canvasState.selectedBlockId) as any)?.content || '')

  // Bloquer le scroll et masquer la sidebar lors de la présentation
  useEffect(() => {
    if (isPresentingMode) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [isPresentingMode])

  const generateSlideImages = async (slidesData: any[], startIndex: number = 0, originalPrompt: string = '') => {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id || ''
    if (!userId) {
      console.error('[Canvas] User not authenticated')
      return
    }

    console.log('[Canvas] Génération images, user:', userId)

    // UN batch_id unique pour TOUTE la présentation afin de grouper les slides
    const presentationBatchId = crypto.randomUUID()

    // On garde une copie locale pour la sauvegarde car le state canvasState.slides sera obsolète dans cette boucle
    const currentSlidesForSaving = [...canvasState.slides];

    for (let i = 0; i < slidesData.length; i++) {
      const slideIndex = startIndex + i
      const slide = slidesData[i]

      // Extraire le contenu
      const allText = slide.blocks?.map((b: any) => {
        if (b.type === 'h1' || b.type === 'h2' || b.type === 'text') return b.content || ''
        if (b.type === 'bullets') return (b.items || []).join(', ')
        if (b.type === 'stat') return `${b.icon || ''} ${b.value || ''} ${b.label || ''}`
        if (b.type === 'quote') return b.content || ''
        return ''
      }).filter(Boolean).join('. ') || 'Slide'

      // Détecter le style demandé par l'utilisateur
      const promptLower = originalPrompt.toLowerCase()
      let styleInstruction = 'professional presentation slide, modern business design, clean layout'

      if (promptLower.includes('bande dessinée') || promptLower.includes('bd') || promptLower.includes('comic')) {
        styleInstruction = 'comic book page style, hand-drawn illustration, speech bubbles, dynamic panels, colorful cartoon art, Franco-Belgian comic style (like Tintin or Asterix)'
      } else if (promptLower.includes('manga')) {
        styleInstruction = 'manga style illustration, Japanese comic art, black and white with screentones, dynamic action poses'
      } else if (promptLower.includes('enfant') || promptLower.includes('kids') || promptLower.includes('enfants')) {
        styleInstruction = 'children book illustration, colorful, cute, playful, hand-drawn watercolor style'
      } else if (promptLower.includes('minimaliste') || promptLower.includes('minimal')) {
        styleInstruction = 'minimalist slide design, lots of white space, simple clean typography, subtle accents'
      } else if (promptLower.includes('luxe') || promptLower.includes('premium') || promptLower.includes('élégant')) {
        styleInstruction = 'luxury premium design, dark background, gold accents, elegant serif typography'
      } else if (promptLower.includes('tech') || promptLower.includes('startup') || promptLower.includes('innovation')) {
        styleInstruction = 'modern tech startup design, gradient backgrounds, futuristic elements, neon accents'
      } else if (promptLower.includes('nature') || promptLower.includes('écologie') || promptLower.includes('vert')) {
        styleInstruction = 'nature-inspired design, earth tones, botanical illustrations, organic shapes'
      }

      let slidePrompt = ''

      if (i === 0) {
        slidePrompt = `${styleInstruction}. Title page about: "${allText}". Context: ${originalPrompt}. 16:9 ratio. High quality illustration with the title text visible.`
      } else {
        slidePrompt = `${styleInstruction}. Page showing: ${allText}. Context: ${originalPrompt}. 16:9 ratio. Visually rich with readable text integrated into the design.`
      }

      console.log(`[Canvas] Prompt slide ${slideIndex}:`, slidePrompt.substring(0, 200))

      try {
        const { data, error: invokeError } = await supabase.functions.invoke('studio-generate', {
          body: {
            prompt: slidePrompt,
            model: 'nano-banana-pro',
            count: 1,
            ratio: '16:9',
            user_id: userId,
            source: 'canvas',
            batch_id: presentationBatchId
          }
        })

        if (invokeError) {
          console.error(`[Canvas] slide ${slideIndex} erreur:`, invokeError)
          continue
        }
        const img = data?.images?.[0]
        const imageUrl = img?.url || img?.image_url || img?.signed_url || img?.public_url ||
          data?.image_url || data?.url ||
          (typeof img === 'string' ? img : null)

        if (imageUrl) {
          // Mettre à jour la copie locale pour la sauvegarde
          if (currentSlidesForSaving[slideIndex]) {
            currentSlidesForSaving[slideIndex] = { ...currentSlidesForSaving[slideIndex], backgroundImage: imageUrl };
          } else if (startIndex === 0) {
            // Si on part de 0 et que slidesData est la source
            slidesData[i] = { ...slidesData[i], backgroundImage: imageUrl };
          }

          setCanvasState((prev: any) => ({
            ...prev,
            slides: prev.slides.map((s: any, idx: number) =>
              idx === slideIndex ? { ...s, backgroundImage: imageUrl } : s
            )
          }))
        }
      } catch (err) {
        console.error(`[Canvas] slide ${slideIndex} exception:`, err)
      }
    }

    // Sauvegarde automatique après la génération
    console.log('[Canvas] Toutes les images générées, sauvegarde...')

    // On utilise soit slidesData mis à jour (si c'était une nouvelle prez) soit currentSlidesForSaving
    const slidesToSave = startIndex === 0 ? slidesData : currentSlidesForSaving;

    setTimeout(() => {
      savePresentation(slidesToSave, canvasState.title)
    }, 1000)
  }

  const savePresentation = async (slidesData: any[], presentationTitle: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const slidesForSave = slidesData.map((slide, i) => ({
      index: i,
      blocks: slide.blocks,
      theme: slide.theme,
      backgroundImage: slide.backgroundImage || null
    }))

    try {
      if (currentPresentationId) {
        // Fix Bug 3: Use supabase client + user_id filter
        const { error } = await supabase
          .from('canvas_presentations')
          .update({
            title: presentationTitle,
            slides: slidesForSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentPresentationId)
          .eq('user_id', user.id)

        if (error) console.error('[Canvas] Update error:', error)
        else console.log('[Canvas] Updated:', currentPresentationId)
      } else {
        // Fix Bug 3: Use supabase client for insert
        const { data, error } = await supabase
          .from('canvas_presentations')
          .insert({
            user_id: user.id,
            title: presentationTitle,
            slides: slidesForSave,
            source: 'gemini'
          })
          .select()
          .single()

        if (error) console.error('[Canvas] Insert error:', error)
        else if (data) {
          setCurrentPresentationId(data.id)
          console.log('[Canvas] Sauvegardé:', data.id)
        }
      }
    } catch (err) {
      console.error('[Canvas] Erreur sauvegarde:', err)
    }
  }

  const loadPresentations = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return []

    try {
      const { data, error } = await supabase
        .from('canvas_presentations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (err) {
      console.error('[Canvas] Erreur chargement presentations:', err)
      return []
    }
  }

  const openPresentation = (presentation: any) => {
    setCanvasState({
      title: presentation.title,
      slides: presentation.slides.map((s: any) => ({
        id: crypto.randomUUID(),
        blocks: s.blocks,
        theme: s.theme,
        backgroundImage: s.backgroundImage
      })),
      activeSlideIndex: 0,
      selectedBlockId: null
    })
    setCurrentPresentationId(presentation.id)
  }

  // --- Voice Dictation Logic ---
  const startRecording = async () => {
    try {
      // Fix Bug 1: Cleanup previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream // Fix Bug 1: Track stream

      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream)
      } catch (err) {
        // Fix Bug 1: Cleanup stream if MediaRecorder constructor fails
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        throw err
      }

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleTranscription(audioBlob)
        // Fix Bug 1: Cleanup stream in onstop
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (err: any) {
      console.error('Mic error:', err)
      alert("Impossible d'accéder au micro.")
    }
  }

  const stopRecording = () => {
    // Fix Bug 2: Check .state instead of stale isListening closure
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsListening(false)
    }
  }

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', blob)
      formData.append('model', 'whisper-1')

      const { data, error } = await supabase.functions.invoke('whisper-stt', {
        body: formData,
      })

      if (error) throw error
      if (data?.text) {
        setPrompt(prev => prev ? `${prev} ${data.text}` : data.text)
      }
    } catch (err: any) {
      console.error('Transcription error:', err)
    } finally {
      setIsTranscribing(false)
    }
  }

  const toggleListening = () => {
    if (isListening) stopRecording()
    else startRecording()
  }

  const generateSlides = async (userMessage: string, originalPrompt: string, convId: string) => {
    try {
      const systemPrompt = getCanvasSystemPrompt()
      let actualModel = canvasSelectedModel
      if (actualModel === 'nano-banana-pro') {
        actualModel = 'gemini-3-flash'
        setCanvasSelectedModel('gemini-3-flash')
      }

      const userMessageWithFormat = `${userMessage}

INSTRUCTIONS CRITIQUES (respecter absolument) :
- Retourne UNIQUEMENT un objet JSON valide, rien d'autre
- Format : {"theme":"...", "slides":[{"blocks":[...]}]}
- Chaque slide doit avoir des blocs VARIÉS (pas toujours les mêmes)
- Utilise des grids de stats avec icônes emoji
- Varie les layouts entre chaque slide
- Le thème doit correspondre aux couleurs demandées par l'utilisateur`

      const res = await runSolo(
        `${systemPrompt}\n\nL'utilisateur travaille sur ce contenu :\n---\n${JSON.stringify(canvasState)}\n---\n\nQUESTION : ${userMessageWithFormat}`,
        actualModel,
        undefined,
        projectId || undefined,
        chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        false,
        true // forceJson
      )

      if (res && res.fusion) {
        const fullResponse = res.fusion
        const newState = parseSlidesResponse(fullResponse)

        if (newState) {
          const firstH1 = newState.slides[0]?.blocks?.find((b: any) => b.type === 'h1')
          const autoTitle = (firstH1 as any)?.content || newState.title || 'Présentation'

          setCanvasState({
            ...newState,
            title: autoTitle
          })

          await supabase.from('conversations')
            .update({ title: autoTitle, canvas_mode: 'slides' })
            .eq('id', convId)

          generateSlideImages(newState.slides, 0, originalPrompt)

          // Sauvegarde automatique avec les données fraîches
          setTimeout(() => {
            saveCanvasContent(convId, {
              mode: 'slides',
              title: autoTitle,
              slides: newState.slides
            })
          }, 1000)
        } else {
          setChatHistory(prev => [...prev, { role: 'assistant', content: fullResponse }])
        }
      }
    } catch (err: any) {
      console.error('Slides error:', err)
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Désolé, une erreur est survenue : ${err.message}` }])
    }
  }

  const generateHTML = async (userMessage: string, convId: string) => {
    const systemPrompt = `Tu es un expert en développement web frontend. L'utilisateur te demande de créer une page HTML.

RÈGLES OBLIGATOIRES :
1. Génère une page HTML COMPLÈTE avec CSS et JavaScript intégrés
2. Le code doit être moderne, responsive et visuellement impressionnant
3. TOUS les boutons et liens doivent être FONCTIONNELS :
   - Les boutons de navigation scrollent vers les sections correspondantes (smooth scroll)
   - Les boutons CTA scrollent vers une section pertinente (formulaire, features, etc.)
   - Les liens du menu naviguent entre les sections de la page
4. Ajouter des ANIMATIONS :
   - Fade-in au scroll avec IntersectionObserver
   - Hover effects sur les boutons et cards
   - Transitions smooth sur tous les éléments interactifs
5. Menu RESPONSIVE avec hamburger menu sur mobile
6. Utilise des sections avec des id (hero, features, about, pricing, contact, footer)
7. Chaque section doit avoir un id correspondant au lien du menu

STRUCTURE ATTENDUE :
- Header fixe avec navigation (liens vers #hero, #features, #about, #pricing, #contact)
- Section Hero avec CTA qui scroll vers #features ou #contact
- Sections de contenu avec animations au scroll
- Formulaire de contact (validation JS côté client)
- Footer avec liens

JAVASCRIPT À INCLURE :
- Smooth scroll pour tous les liens ancres
- IntersectionObserver pour les animations d'apparition
- Menu hamburger toggle sur mobile
- Validation basique du formulaire
- Active state dans le menu selon la section visible

Exemple de JS à inclure :
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
});

Retourne UNIQUEMENT le code HTML complet (<!DOCTYPE html>...).
Pas de markdown, pas de backticks, pas d'explications.
Juste le code HTML avec CSS et JS intégrés.`

    try {
      let actualModel = canvasSelectedModel
      if (actualModel === 'nano-banana-pro') {
        actualModel = 'gemini-3-flash'
        setCanvasSelectedModel('gemini-3-flash')
      }

      const body = {
        prompt: `${systemPrompt}\n\nQUESTION : ${userMessage}`,
        model_slugs: [actualModel],
        master_model_slug: actualModel,
        fusion_mode: 'fusion',
        history: chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        forceJson: false
      }

      console.log('[Canvas] Body envoyé à fusion-run:', JSON.stringify(body))

      const { data, error } = await supabase.functions.invoke('fusion-run', { body })

      if (error) throw error
      console.log('[Canvas] Réponse brute fusion-run:', JSON.stringify(data))

      const htmlCode = data?.fusion || ''

      let cleanHTML = htmlCode
        .replace(/^```html?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()

      setHtmlContent(cleanHTML)
      setCanvasState(prev => ({ ...prev, title: userMessage.substring(0, 50) }))
      await supabase.from('conversations').update({ title: userMessage.substring(0, 50), canvas_mode: 'html' }).eq('id', convId)

      // Sauvegarde automatique avec les données fraîches
      setTimeout(() => {
        saveCanvasContent(convId, {
          mode: 'html',
          title: userMessage.substring(0, 50),
          html: cleanHTML
        })
      }, 1000)
    } catch (err) {
      console.error('[Canvas] Erreur HTML:', err)
    }
  }

  const generateReact = async (userMessage: string, convId: string) => {
    const systemPrompt = `Tu es un expert React. L'utilisateur te demande de créer une application ou un composant React.
Génère un composant React COMPLET et fonctionnel dans un seul fichier.
Utilise des hooks React (useState, useEffect, useRef, etc.).
Utilise du CSS inline (style={{}}) ou des classes Tailwind.
Inclus TOUTE la logique dans ce seul composant.
Retourne UNIQUEMENT le code JSX/React. Pas de markdown, pas de backticks.

IMPORTANT : 
- N'utilise PAS de "export default". Déclare juste le composant avec "const" ou "function".
- N'importe PAS de bibliothèques externes (pas de lucide-react, pas de framer-motion).
- Utilise uniquement React, useState, useEffect, useRef, useCallback, useMemo (déjà disponibles).
- Pour les icônes, utilise des émojis ou des caractères Unicode.
- Le composant principal DOIT s'appeler "App".`

    try {
      let actualModel = canvasSelectedModel
      if (actualModel === 'nano-banana-pro') {
        actualModel = 'gemini-3-flash'
        setCanvasSelectedModel('gemini-3-flash')
      }

      const body = {
        prompt: `${systemPrompt}\n\nQUESTION : ${userMessage}`,
        model_slugs: [actualModel],
        master_model_slug: actualModel,
        fusion_mode: 'fusion',
        history: chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        forceJson: false
      }

      console.log('[Canvas] Body envoyé à fusion-run:', JSON.stringify(body))

      const { data, error } = await supabase.functions.invoke('fusion-run', { body })

      if (error) throw error
      console.log('[Canvas] Réponse brute fusion-run:', JSON.stringify(data))

      const reactCode = data?.fusion || ''

      let cleanCode = reactCode
        .replace(/^```(?:jsx|tsx|javascript|typescript|react)?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()

      // Nettoyage agressif des imports et exports
      cleanCode = cleanCode
        // Supprimer import React et ses variantes
        .replace(/import\s+React\s*,?\s*\{[^}]*\}\s*from\s*['"]react['"]\s*;?\n?/g, '')
        .replace(/import\s+React\s+from\s*['"]react['"]\s*;?\n?/g, '')
        .replace(/import\s*\{[^}]*\}\s*from\s*['"]react['"]\s*;?\n?/g, '')
        // Supprimer import ReactDOM
        .replace(/import\s+ReactDOM\s+from\s*['"]react-dom['"]\s*;?\n?/g, '')
        .replace(/import\s*\{[^}]*\}\s*from\s*['"]react-dom['"]\s*;?\n?/g, '')
        .replace(/import\s*\{[^}]*\}\s*from\s*['"]react-dom\/client['"]\s*;?\n?/g, '')
        // Supprimer TOUS les imports restants (lucide-react, etc.)
        .replace(/import\s+.*from\s*['"][^'"]+['"]\s*;?\n?/g, '')
        // Supprimer les export default/named
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+\{[^}]*\}\s*;?\n?/g, '')
        .replace(/export\s+(const|function|class|let|var)\s+/g, '$1 ')
        .trim()

      const htmlWrapper = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas App</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
    #root { min-height: 100vh; }
  </style>
  <script>
    // Polyfill pour les modules CommonJS
    var exports = {};
    var module = { exports: exports };
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    // Hooks et APIs React disponibles globalement
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment, memo, forwardRef } = React;
    const { createRoot } = ReactDOM;
    
    // Icônes factices pour éviter les erreurs d'import lucide-react si l'IA en génère
    const IconPlaceholder = (props) => React.createElement('span', { 
      style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1em', height: '1em', fontSize: '1.2em' },
      ...props 
    }, '●');
    const X = IconPlaceholder;
    const Circle = IconPlaceholder;
    const RotateCcw = IconPlaceholder;
    const Trophy = IconPlaceholder;
    const RefreshCw = IconPlaceholder;
    const ChevronLeft = IconPlaceholder;
    const ChevronRight = IconPlaceholder;
    const Plus = IconPlaceholder;
    const Trash = IconPlaceholder;
    const Edit = IconPlaceholder;
    const Settings = IconPlaceholder;
    const Search = IconPlaceholder;
    const Bell = IconPlaceholder;
    const User = IconPlaceholder;

    ${cleanCode}
    
    // Montage automatique — chercher le composant exporté
    const _findComponent = () => {
      const names = ['App', 'Default', 'TicTacToe', 'Game', 'Calculator', 'Dashboard', 
                     'TodoApp', 'Main', 'Home', 'Snake', 'SnakeGame', 'Morpion',
                     'Counter', 'Timer', 'Quiz', 'Board', 'Player'];
      for (const name of names) {
        try { 
          const comp = eval(name); 
          if (typeof comp === 'function' || typeof comp === 'object') return comp; 
        } catch(e) {}
      }
      // Chercher dans exports (CommonJS fallback)
      if (exports.default) return exports.default;
      if (module.exports && module.exports !== exports) return module.exports;
      return null;
    };
    
    const _Component = _findComponent();
    if (_Component) {
      createRoot(document.getElementById('root')).render(React.createElement(_Component));
    } else {
      document.getElementById('root').innerHTML = '<div style="padding:40px;text-align:center;color:#666;">Composant non trouvé. Vérifiez la console.</div>';
    }
  </script>
</body>
</html>`

      setHtmlContent(htmlWrapper)
      setCanvasState(prev => ({ ...prev, title: userMessage.substring(0, 50) }))
      await supabase.from('conversations').update({ title: userMessage.substring(0, 50), canvas_mode: 'react' }).eq('id', convId)

      // Sauvegarde automatique avec les données fraîches
      setTimeout(() => {
        saveCanvasContent(convId, {
          mode: 'react',
          title: userMessage.substring(0, 50),
          html: htmlWrapper
        })
      }, 1000)
    } catch (err) {
      console.error('[Canvas] Erreur React:', err)
    }
  }

  const generateDocument = async (userMessage: string, convId: string) => {
    const systemPrompt = `Tu es un expert en rédaction. L'utilisateur te demande de créer un document.
Génère un document HTML formaté en A4 avec du contenu riche.
Utilise des titres (h1, h2, h3), des paragraphes, des listes, des tableaux si nécessaire.
Le style doit être professionnel : police serif pour le corps, sans-serif pour les titres.
Inclus une mise en page A4 (max-width 210mm, padding, margins).
Retourne UNIQUEMENT le code HTML complet. Pas de markdown, pas de backticks.`

    try {
      let actualModel = canvasSelectedModel
      if (actualModel === 'nano-banana-pro') {
        actualModel = 'gemini-3-flash'
        setCanvasSelectedModel('gemini-3-flash')
      }

      const body = {
        prompt: `${systemPrompt}\n\nQUESTION : ${userMessage}`,
        model_slugs: [actualModel],
        master_model_slug: actualModel,
        fusion_mode: 'fusion',
        history: chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        forceJson: false
      }

      console.log('[Canvas] Body envoyé à fusion-run:', JSON.stringify(body))

      const { data, error } = await supabase.functions.invoke('fusion-run', { body })

      if (error) throw error
      console.log('[Canvas] Réponse brute fusion-run:', JSON.stringify(data))

      const docCode = data?.fusion || ''

      let cleanHTML = docCode
        .replace(/^```html?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim()

      setHtmlContent(cleanHTML)
      setCanvasState(prev => ({ ...prev, title: userMessage.substring(0, 50) }))
      await supabase.from('conversations').update({ title: userMessage.substring(0, 50), canvas_mode: 'document' }).eq('id', convId)

      // Sauvegarde automatique avec les données fraîches
      setTimeout(() => {
        saveCanvasContent(convId, {
          mode: 'document',
          title: userMessage.substring(0, 50),
          html: cleanHTML
        })
      }, 1000)
    } catch (err) {
      console.error('[Canvas] Erreur document:', err)
    }
  }

  const autoRenameConversation = async (convId: string, userPrompt: string) => {
    try {
      const renamePrompt = `Analyse ce message et génère un titre ultra-court (max 4 mots) qui résume parfaitement le sujet du projet. 
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

      const { data: { user: renameUser } } = await supabase.auth.getUser()
      if (!renameUser) return

      await supabase.from('conversations')
        .update({
          title: generatedTitle,
          canvas_mode: canvasMode
        })
        .eq('id', convId)
        .eq('user_id', renameUser.id) // Fix Bug 9
    } catch (err) {
      console.error('[Canvas AutoRename] Erreur:', err)
    }
  }

  const handleAssistantSubmit = async () => {
    if (!prompt.trim()) return

    const userMsgContent = prompt
    setUserOriginalPrompt(userMsgContent)

    const detectedMode = detectCanvasMode(userMsgContent)
    setCanvasMode(detectedMode)
    console.log('[Canvas] Mode détecté:', detectedMode)

    // Créer un ID de conversation si pas encore défini
    let currentId = conversationId
    if (!currentId) {
      currentId = crypto.randomUUID()
      setConversationId(currentId)

      // 1. Créer physiquement la conversation en base (requis pour FK)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('conversations').insert({
          id: currentId,
          user_id: user.id,
          title: prompt.substring(0, 40),
          project_id: projectId,
          mode: 'canvas',
          canvas_mode: detectedMode
        })
        // 2. Renommage automatique IA
        autoRenameConversation(currentId, prompt)
      }
    }

    const userMsg = {
      role: 'user' as const,
      content: selectedFiles.length > 0
        ? `${userMsgContent}\n\n[Fichiers joints: ${selectedFiles.map(f => f.name).join(', ')}]`
        : userMsgContent
    }
    setChatHistory(prev => [...prev, userMsg])
    setPrompt('')
    setSelectedFiles([])
    setIsGenerating(true)
    if (assistantTextareaRef.current) {
      assistantTextareaRef.current.style.height = '48px';
    }

    try {
      if (detectedMode === 'slides') {
        await generateSlides(userMsgContent, userMsgContent, currentId)
      } else if (detectedMode === 'html') {
        await generateHTML(userMsgContent, currentId)
      } else if (detectedMode === 'react') {
        await generateReact(userMsgContent, currentId)
      } else if (detectedMode === 'document') {
        await generateDocument(userMsgContent, currentId)
      }
    } catch (err: any) {
      console.error('Assistant error:', err)
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Désolé, une erreur est survenue : ${err.message}` }])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleModifySubmit = async (userMessage: string) => {
    setIsGenerating(true)
    try {
      const activeSlide = canvasState.slides[canvasState.activeSlideIndex]
      const slideContent = JSON.stringify(activeSlide?.blocks || [])

      const modifyPrompt = `L'utilisateur veut modifier la slide ${canvasState.activeSlideIndex + 1} de sa présentation.
Contenu actuel de la slide : ${slideContent}
Demande de l'utilisateur : "${userMessage}"

Retourne UNIQUEMENT le JSON de cette slide modifiée au format :
{"blocks": [...]}
Les blocs disponibles sont : h1, h2, text, bullets, stat, grid, quote, divider.`

      const res = await runSolo(modifyPrompt, canvasSelectedModel, undefined, projectId || undefined, [], false, true)

      if (res && res.fusion) {
        const updatedSlideData = JSON.parse(res.fusion)
        const newSlides = [...canvasState.slides]
        newSlides[canvasState.activeSlideIndex] = {
          ...newSlides[canvasState.activeSlideIndex],
          blocks: updatedSlideData.blocks.map((b: any) => ({ ...b, id: b.id || crypto.randomUUID() })),
          backgroundImage: undefined // Reset pour re-générer
        }
        setCanvasState(prev => ({ ...prev, slides: newSlides }))

        // Re-générer l'image de cette slide uniquement
        generateSlideImages([newSlides[canvasState.activeSlideIndex]], canvasState.activeSlideIndex, userMessage)
      }
    } catch (err) {
      console.error('[Canvas] Erreur modification:', err)
    } finally {
      setIsGenerating(false)
    }
  }


  const deleteSlide = (index: number) => {
    setCanvasState(prev => {
      const newSlides = prev.slides.filter((_, i) => i !== index)
      return { ...prev, slides: newSlides, activeSlideIndex: Math.max(0, Math.min(prev.activeSlideIndex, newSlides.length - 1)) }
    })
  }

  const addSlide = () => {
    setCanvasState(prev => ({
      ...prev,
      slides: [...prev.slides, {
        id: crypto.randomUUID(),
        blocks: [{ id: crypto.randomUUID(), type: 'h2', content: 'Nouveau Slide' }],
        theme: prev.slides[0]?.theme || SLIDE_THEMES['midnight-blue']
      }],
      activeSlideIndex: prev.slides.length
    }))
  }

  const handleDownloadPptx = async () => {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE' // 16:9

    for (let i = 0; i < canvasState.slides.length; i++) {
      const slide = canvasState.slides[i]
      const pptxSlide = pptx.addSlide()

      if (slide.backgroundImage) {
        // Convertir l'URL en base64 pour pptxgenjs
        try {
          const response = await fetch(slide.backgroundImage)
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })

          pptxSlide.addImage({
            data: base64,
            x: 0, y: 0,
            w: '100%', h: '100%'
          })
        } catch (err) {
          console.error(`[Canvas] Erreur export slide ${i}:`, err)
          // Fallback : slide avec titre texte
          const titleBlock = slide.blocks?.find((b: any) => b.type === 'h1' || b.type === 'h2')
          pptxSlide.addText((titleBlock as any)?.content || `Slide ${i + 1}`, {
            x: 1, y: 2, w: 8, h: 2,
            fontSize: 36, color: '5C4B40', align: 'center'
          })
        }
      } else {
        // Fallback si pas d'image
        const titleBlock = slide.blocks?.find((b: any) => b.type === 'h1' || b.type === 'h2')
        pptxSlide.addText((titleBlock as any)?.content || `Slide ${i + 1}`, {
          x: 1, y: 2, w: 8, h: 2,
          fontSize: 36, color: '5C4B40', align: 'center'
        })
      }
    }

    const fileName = `${canvasState.title || 'presentation'}.pptx`
    await pptx.writeFile({ fileName })
  }

  const handleSaveCanvas = async () => {
    setIsSaving(true)
    await savePresentation(canvasState.slides, canvasState.title)
    setIsSaving(false)
  }

  const startPresentation = () => {
    setIsPresentingMode(true)
    setPresentingIndex(0)
  }

  const activeSlide = canvasState.slides[canvasState.activeSlideIndex]
  const selectedBlock = activeSlide?.blocks.find(b => b.id === canvasState.selectedBlockId)

  const BlockRenderer = ({ block, theme, interactive, isSelected, onSelect }: {
    block: Block, theme: SlideTheme, interactive: boolean, isSelected: boolean, onSelect: () => void
  }) => {
    const style = interactive ? {
      cursor: 'pointer',
      outline: isSelected ? `2px solid ${theme.accentColor}` : 'none',
      borderRadius: 8,
      position: 'relative' as const,
      transition: 'all 150ms'
    } : {}

    switch (block.type) {
      case 'h1': return <div style={style} onClick={onSelect}><h1 style={{ fontSize: '42px', fontWeight: '800', color: block.style?.color || theme.textColor, textAlign: block.style?.textAlign || 'left' }}>{block.content}</h1></div>
      case 'h2': return <div style={style} onClick={onSelect}><h2 style={{ fontSize: '28px', fontWeight: '700', color: block.style?.color || theme.textColor, textAlign: block.style?.textAlign || 'left', display: 'flex', alignItems: 'center', gap: 12 }}>{block.content}</h2></div>
      case 'text': return <div style={style} onClick={onSelect}><p style={{ fontSize: '18px', opacity: 0.8, color: block.style?.color || theme.textColor, textAlign: block.style?.textAlign || 'left', lineHeight: 1.6 }}>{block.content}</p></div>
      case 'bullets': return (
        <div style={style} onClick={onSelect}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ fontSize: '18px', padding: '4px 0', paddingLeft: 24, position: 'relative', color: theme.textColor }}>
                <span style={{ position: 'absolute', left: 0, color: theme.accentColor }}>•</span>{item}
              </li>
            ))}
          </ul>
        </div>
      )
      case 'image': return (
        <div style={{ ...style, width: block.width === 'full' ? '100%' : '50%', borderRadius: 12, overflow: 'hidden', margin: '16px 0' }} onClick={onSelect}>
          <img src={block.src} alt="" style={{ width: '100%', display: 'block' }} />
        </div>
      )
      case 'stat': return (
        <div style={{ ...style, textAlign: 'center', padding: 20 }} onClick={onSelect}>
          <div style={{ fontSize: '42px', fontWeight: '900', color: theme.accentColor }}>{block.value}</div>
          <div style={{ fontSize: '14px', opacity: 0.6 }}>{block.label}</div>
        </div>
      )
      case 'grid': return (
        <div style={{ ...style, display: 'grid', gridTemplateColumns: `repeat(${block.columns}, 1fr)`, gap: 20, margin: '16px 0' }} onClick={onSelect}>
          {block.items.map((item, i) => (
            <div key={item.id || i} style={{ background: theme.cardBg || 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12 }}>
              <BlockRenderer block={item} theme={theme} interactive={false} isSelected={false} onSelect={() => { }} />
            </div>
          ))}
        </div>
      )
      case 'quote': return (
        <div style={{ ...style, borderLeft: `4px solid ${theme.accentColor}`, paddingLeft: 20, margin: '20px 0', fontStyle: 'italic', fontSize: '20px', color: theme.textColor }} onClick={onSelect}>
          "{block.content}"
          {block.author && <div style={{ fontSize: '14px', opacity: 0.5, marginTop: 8 }}>— {block.author}</div>}
        </div>
      )
      case 'divider': return <hr style={{ border: 'none', height: 1, background: `${theme.textColor}20`, margin: '20px 0' }} />
      case 'spacer': return <div style={{ height: block.height }} />
      default: return null
    }
  }

  const SlideRenderer = ({ slide, interactive = true }: { slide: Slide, interactive?: boolean }) => {
    const isLoading = !slide.backgroundImage

    return (
      <div style={{
        width: '100%',
        aspectRatio: '16/9',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        background: slide.backgroundImage ? '#fff' : slide.theme?.background || '#f5f3ee'
      }}>
        {slide.backgroundImage ? (
          // Image Nano Banana Pro générée
          <img
            src={slide.backgroundImage}
            alt="Slide"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          // Rendu HTML des blocs (visible en arrière-plan flou si isLoading)
          <div style={{
            width: '100%',
            height: '100%',
            padding: '48px 64px',
            color: slide.theme?.textColor || '#5C4B40',
            opacity: isLoading ? 0.3 : 1
          }}>
            {slide.blocks?.map(block => (
              <BlockRenderer key={block.id} block={block} theme={slide.theme} interactive={interactive}
                isSelected={canvasState.selectedBlockId === block.id} onSelect={() => setCanvasState(prev => ({ ...prev, selectedBlockId: block.id }))}
              />
            ))}
          </div>
        )}

        {/* OVERLAY LOADING — Glassmorphism blanc nacré */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse at 30% 20%, rgba(255, 240, 245, 0.9) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(230, 240, 255, 0.8) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255, 250, 240, 0.7) 0%, transparent 60%),
              linear-gradient(135deg, 
                rgba(255, 253, 250, 0.95) 0%, 
                rgba(245, 240, 248, 0.95) 25%, 
                rgba(250, 248, 255, 0.95) 50%, 
                rgba(255, 245, 240, 0.95) 75%, 
                rgba(248, 255, 250, 0.95) 100%
              )
            `,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            animation: 'pearlShimmer 4s ease-in-out infinite'
          }}>
            {/* Lueur nacrée animée qui se déplace */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.6) 50%, transparent 70%)',
              animation: 'shimmerMove 3s ease-in-out infinite',
              pointerEvents: 'none'
            }} />

            {/* Cercle spinner */}
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '3px solid rgba(92, 75, 64, 0.08)',
              borderTopColor: 'rgba(92, 75, 64, 0.4)',
              animation: 'spin 1s linear infinite',
              zIndex: 1
            }} />

            {/* Texte */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              zIndex: 1
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(92, 75, 64, 0.6)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                Création du visuel
              </span>
              <span style={{
                fontSize: 11,
                color: 'rgba(92, 75, 64, 0.35)'
              }}>
                Nano Banana Pro
              </span>
            </div>

            {/* Barre de progression subtile */}
            <div style={{
              width: 120,
              height: 3,
              borderRadius: 2,
              background: 'rgba(92, 75, 64, 0.06)',
              overflow: 'hidden',
              marginTop: 4,
              zIndex: 1
            }}>
              <div style={{
                width: '60%',
                height: '100%',
                borderRadius: 2,
                background: 'linear-gradient(90deg, rgba(92, 75, 64, 0.2), rgba(92, 75, 64, 0.4))',
                animation: 'progress 2s ease-in-out infinite'
              }} />
            </div>
          </div>
        )}

        {/* Badge Nano Banana Pro (uniquement quand image chargée) */}
        {slide.backgroundImage && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            fontSize: 10,
            padding: '4px 10px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            🍌 Nano Banana Pro
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex w-full h-full bg-[#F5F3EE] overflow-hidden relative font-sans text-stone-800">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes pearlShimmer {
          0%, 100% { 
            filter: hue-rotate(0deg) brightness(1); 
          }
          33% { 
            filter: hue-rotate(10deg) brightness(1.02); 
          }
          66% { 
            filter: hue-rotate(-10deg) brightness(1.01); 
          }
        }
        @keyframes shimmerMove {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      <div className="flex flex-1 h-full overflow-hidden">

        {/* Resize Handle Drag Area */}
        {isDragging && (
          <div className="fixed inset-0 z-[100] cursor-col-resize" />
        )}

        {/* Assistant Panel */}
        <AnimatePresence>
          {chatWidth > 0 && (
            <motion.div
              style={{ width: chatWidth }}
              className="border-r border-stone-200 bg-white/80 backdrop-blur-xl flex flex-col h-full z-40 relative"
            >
              <div className="p-4 border-b border-stone-200 flex items-center justify-between">
                <button
                  onClick={resetCanvas}
                  className="flex items-center gap-2 hover:opacity-70 transition-opacity group"
                  title="Démarrer un nouveau projet"
                >
                  <div className="p-1.5 bg-[#5C4B40] text-white rounded-lg group-hover:scale-110 transition-transform">
                    <Sparkles size={16} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">Canevas</span>
                  <Plus size={12} className="text-[#5C4B40]/40 ml-1" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-full p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#5C4B40] text-white' : 'bg-white border border-stone-200'
                      }`}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-stone-200 relative">
                <textarea
                  ref={assistantTextareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAssistantSubmit())}
                  placeholder={isListening ? "J'écoute..." : isTranscribing ? "Transcription..." : "Créer votre projet..."}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-3 text-sm focus:outline-none min-h-[48px] max-h-[200px] no-scrollbar resize-none pr-12"
                />
                <div className="absolute bottom-6 right-6 flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    disabled={isTranscribing || isGenerating}
                    className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-stone-400 hover:text-[#5C4B40] bg-stone-100 hover:bg-stone-200'
                      } disabled:opacity-50`}
                  >
                    {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                  </button>
                  <button
                    onClick={handleAssistantSubmit}
                    disabled={isGenerating || isListening || isTranscribing}
                    className="p-2 bg-[#5C4B40] text-white rounded-xl transition-all hover:scale-105 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 hover:w-1.5 bg-stone-200/50 hover:bg-[#5C4B40]/30 cursor-col-resize transition-all z-50 relative h-full shrink-0"
        />

        {/* Main Stage */}
        <div className="flex-1 flex flex-col items-center overflow-hidden">
          <div className="w-full flex items-center justify-between p-6 border-b border-stone-200 bg-white/40 backdrop-blur-md z-10">
            <div className="flex items-center gap-3 w-[300px]">
              <input
                value={canvasState.title}
                onChange={(e) => setCanvasState(prev => ({ ...prev, title: e.target.value }))}
                className="bg-transparent text-sm font-black uppercase tracking-widest text-[#5C4B40] border-none focus:outline-none flex-1 truncate"
              />
            </div>

            <div className="flex-1 flex justify-center">
              {(canvasMode === 'html' || canvasMode === 'react') && (
                <span className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5C4B40]/5 text-[#5C4B40] border border-[#5C4B40]/10" style={{
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}>
                  {canvasMode === 'html' && 'HTML5'}
                  {canvasMode === 'react' && 'REACT'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-[300px] justify-end">
              <button
                title="Actualiser"
                onClick={() => conversationId && loadCanvasContent(conversationId)}
                disabled={!conversationId || isGenerating}
                className="p-2 text-stone-400 hover:text-[#5C4B40] transition-colors disabled:opacity-30"
              >
                <RotateCcw size={20} className={isGenerating ? "animate-spin" : ""} />
              </button>
              <button
                title="Historique"
                onClick={async () => {
                  const items = await loadCanvasHistory()
                  setCanvasHistory(items)
                  setShowLibrary(true)
                }}
                className="p-2 text-stone-400 hover:text-[#5C4B40] transition-colors"
              >
                <History size={20} />
              </button>
              <button
                onClick={() => setEditMode(!editMode)}
                style={{
                  background: editMode ? '#5C4B40' : 'transparent',
                  color: editMode ? 'white' : '#5C4B40',
                  border: '1px solid rgba(92,75,64,0.2)',
                  borderRadius: 8,
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {editMode ? '👁️ Aperçu' : '✏️ Éditer'}
              </button>

              {editMode && (
                <button
                  onClick={saveEditedSlides}
                  disabled={isSaving}
                  style={{
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
                  }}
                >
                  {isSaving ? '⌛...' : '💾 Sauvegarder'}
                </button>
              )}
              <button title="Présenter" onClick={startPresentation} className="p-2 text-stone-400 hover:text-[#5C4B40] transition-colors"><Play size={20} /></button>
              <button title="Exporter PPTX" onClick={handleDownloadPptx} className="p-2 text-stone-400 hover:text-[#5C4B40] transition-colors"><Download size={20} /></button>
              {onClose && (
                <button
                  title="Revenir au chat"
                  onClick={onClose}
                  className="p-2 ml-2 text-stone-400 hover:text-red-500 transition-colors border-l border-stone-200 pl-4"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 w-full overflow-hidden flex flex-col" style={{ background: '#F5F3EE' }}>
            {/* Mode SLIDES */}
            {canvasMode === 'slides' && (
              <div className="flex-1 overflow-y-auto p-12 space-y-12 no-scrollbar scroll-smooth">
                {isGenerating && canvasState.slides.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="flex gap-3 mb-8 justify-center">
                      {[0, 1, 2, 3, 4].map(i => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0.1 }}
                          animate={{ opacity: [0.1, 0.6, 0.1] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                          className="w-20 h-12 rounded-xl shadow-lg"
                          style={{ background: `linear-gradient(135deg, #5C4B40 0%, #8B7355 100%)` }}
                        />
                      ))}
                    </div>
                    <h3 className="text-[#5C4B40] font-bold text-xl mb-2">Création de la présentation...</h3>
                    <p className="text-[#5C4B40]/50 text-sm mb-8">Génération des slides et du contenu visuel</p>
                    <div className="w-64 h-1.5 bg-[#5C4B40]/10 rounded-full overflow-hidden relative">
                      <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-y-0 w-1/2 bg-[#5C4B40] rounded-full" />
                    </div>
                  </div>
                ) : canvasState.slides.length > 0 ? (
                  canvasState.slides.map((slide, index) => (
                    <div key={slide.id} style={{ marginBottom: 48 }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontSize: 11, color: '#5C4B40', opacity: 0.4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          SLIDE {String(index + 1).padStart(2, '0')}
                        </span>
                        {editMode && (
                          <button
                            onClick={() => {
                              setEditMode(false)
                              generateSlideImages([slide], index, userOriginalPrompt)
                            }}
                            className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200"
                          >
                            🔄 Re-générer le visuel
                          </button>
                        )}
                      </div>
                      <div
                        ref={el => { slideRefs.current[index] = el }}
                        onClick={() => setCanvasState(prev => ({ ...prev, activeSlideIndex: index }))}
                        className={`mx-auto transition-all duration-500 ${canvasState.activeSlideIndex === index ? 'ring-2 ring-[#5C4B40] scale-[1.01] shadow-2xl' : 'opacity-80 hover:opacity-100 hover:ring-1 hover:ring-[#5C4B40]/30 shadow-xl'
                          }`}
                        style={{ maxWidth: 900 }}
                      >
                        {editMode
                          ? <EditableSlideRenderer
                            slide={slide}
                            index={index}
                            onAddBlock={addBlockToSlide}
                            onRemoveBlock={removeBlockFromSlide}
                            onUpdateContent={updateBlockContent}
                            onUpdateItems={updateBlockItems}
                            selectedBlockId={selectedBlockId}
                            onSelectBlock={setSelectedBlockId}
                          />
                          : <SlideRenderer slide={slide} />
                        }
                      </div>
                    </div>
                  ))
                ) : !isGenerating && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center p-12 border-2 border-dashed border-stone-200 rounded-[40px] max-w-md">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Sparkles className="text-[#5C4B40]/20" size={32} />
                      </div>
                      <h3 className="text-[#5C4B40] font-bold text-lg mb-2">Votre présentation commence ici</h3>
                      <p className="text-stone-400 text-sm">Utilisez l'assistant à gauche pour générer vos premiers slides.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode HTML / REACT / DOCUMENT — Rendu dans une iframe */}
            {(canvasMode === 'html' || canvasMode === 'react' || canvasMode === 'document') && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {isGenerating && !htmlContent ? (
                  <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                      <Loader2 size={32} className="text-[#5C4B40] animate-spin" />
                    </div>
                    <h3 className="text-[#5C4B40] font-bold text-xl mb-2">Génération du {canvasMode === 'document' ? 'document' : 'code'}...</h3>
                    <p className="text-[#5C4B40]/50 text-sm">L'IA assemble vos idées</p>
                  </div>
                ) : htmlContent ? (
                  <div style={{
                    padding: canvasMode === 'document' ? '32px' : '16px',
                    display: 'flex',
                    justifyContent: 'center',
                    height: '100%',
                    overflowY: 'auto'
                  }} className="no-scrollbar">
                    <div style={{
                      width: canvasMode === 'document' ? '210mm' : '100%',
                      maxWidth: canvasMode === 'document' ? '210mm' : '100%',
                      minHeight: canvasMode === 'document' ? '297mm' : '100%',
                      height: canvasMode === 'document' ? 'fit-content' : '100%',
                      background: '#fff',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 4px 24px rgba(92, 75, 64, 0.1)',
                      marginBottom: canvasMode === 'document' ? '40px' : '0'
                    }}>
                      <iframe
                        srcDoc={htmlContent}
                        style={{
                          width: '100%',
                          height: canvasMode === 'document' ? '1200px' : '100%',
                          border: 'none'
                        }}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        title="Canvas Preview"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center p-12 border-2 border-dashed border-stone-200 rounded-[40px] max-w-md">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Code className="text-[#5C4B40]/20" size={32} />
                      </div>
                      <h3 className="text-[#5C4B40] font-bold text-lg mb-2">Créez votre projet</h3>
                      <p className="text-stone-400 text-sm">Décrivez votre page web, application React ou document dans l'assistant.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedBlock && (
          <div className="w-[280px] border-l border-stone-200 bg-white/80 backdrop-blur-xl p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Propriétés</span>
              <button onClick={() => setCanvasState(prev => ({ ...prev, selectedBlockId: null }))} className="text-stone-400 hover:text-stone-800"><X size={16} /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-bold uppercase block mb-2 opacity-50">Texte</label>
                <textarea
                  ref={propertiesTextareaRef}
                  value={(selectedBlock as any).content || ''}
                  onChange={(e) => setCanvasState(prev => {
                    const newSlides = [...prev.slides]; const s = newSlides[prev.activeSlideIndex];
                    const b = s.blocks.find(blk => blk.id === selectedBlock.id);
                    if (b && 'content' in b) (b as any).content = e.target.value;
                    return { ...prev, slides: newSlides };
                  })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs min-h-[48px] max-h-[200px] resize-none focus:outline-none no-scrollbar"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase block mb-2 opacity-50">Alignement</label>
                <div className="flex bg-stone-100 p-1 rounded-lg">
                  {['left', 'center', 'right'].map(align => (
                    <button
                      key={align}
                      onClick={() => setCanvasState(prev => {
                        const newSlides = [...prev.slides]; const s = newSlides[prev.activeSlideIndex];
                        const b = s.blocks.find(blk => blk.id === selectedBlock.id);
                        if (b) b.style = { ...b.style, textAlign: align as any };
                        return { ...prev, slides: newSlides };
                      })}
                      className={`flex-1 py-1.5 rounded text-[10px] capitalize transition-all ${selectedBlock.style?.textAlign === align ? 'bg-white shadow-sm font-bold text-[#5C4B40]' : 'opacity-40 hover:opacity-60'
                        }`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setCanvasState(prev => {
                  const newSlides = [...prev.slides]; const s = newSlides[prev.activeSlideIndex];
                  s.blocks = s.blocks.filter(b => b.id !== selectedBlock.id);
                  return { ...prev, slides: newSlides, selectedBlockId: null };
                })}
                className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs hover:bg-red-100 transition-all font-black uppercase tracking-widest mt-4"
              >
                Supprimer le bloc
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLibrary && (
          <div className="fixed inset-0 z-[1000] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLibrary(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h2 className="text-[#5C4B40] font-black uppercase tracking-widest text-lg">Historique</h2>
                  <p className="text-stone-400 text-xs">Vos conversations passées et créations</p>
                </div>
                <button onClick={() => setShowLibrary(false)} className="p-2 hover:bg-stone-100 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {canvasHistory.length > 0 ? (
                  canvasHistory.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        loadCanvasContent(p.conversation_id)
                        setShowLibrary(false)
                      }}
                      className="group p-5 border border-stone-100 rounded-3xl cursor-pointer hover:border-[#5C4B40]/30 hover:bg-stone-50 transition-all shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">
                            {p.mode === 'slides' ? '📽️' : p.mode === 'react' ? '⚛️' : p.mode === 'html' ? '🌐' : '📄'}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-[#5C4B40]/5 rounded text-[#5C4B40]/40">
                            {p.mode}
                          </span>
                        </div>
                        <span className="text-[10px] opacity-30 whitespace-nowrap font-medium">
                          {new Date(p.updated_at || p.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <h3 className="font-bold text-[#5C4B40] text-sm group-hover:text-[#5C4B40] transition-colors line-clamp-2">{p.title}</h3>
                      <div className="mt-3 flex items-center gap-2 text-[9px] text-stone-400 uppercase tracking-widest font-black">
                        {p.mode === 'slides' && <span>{p.content?.slides?.length || 0} PAGES</span>}
                        {p.mode !== 'slides' && <span>PROJET CODE</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                    <History size={48} className="mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Aucun historique</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPresentingMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Bouton fermer en haut à droite */}
            <button
              onClick={() => setIsPresentingMode(false)}
              style={{
                position: 'absolute',
                top: 40,
                right: 40,
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 100,
                transition: 'all 0.2s'
              }}
              className="hover:bg-red-500/20 hover:scale-110 active:scale-95 transition-all"
            >
              <X size={28} />
            </button>

            {/* Slide centrée */}
            <div style={{
              width: '90vw',
              maxWidth: '1400px',
              aspectRatio: '16/9',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <SlideRenderer slide={canvasState.slides[presentingIndex]} interactive={false} />
            </div>

            {/* Navigation en bas */}
            <div
              onMouseEnter={() => setIsNavHovered(true)}
              onMouseLeave={() => setIsNavHovered(false)}
              style={{
                position: 'absolute',
                bottom: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 32,
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: 32,
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: isNavHovered ? 1 : 0.05,
                transform: `scale(${isNavHovered ? 1 : 0.8})`,
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                cursor: 'default'
              }}
            >
              <button
                onClick={() => setPresentingIndex(prev => Math.max(0, prev - 1))}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  width: 56, height: 56,
                  borderRadius: '50%',
                  fontSize: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: presentingIndex === 0 ? 0.2 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <ChevronLeft size={28} />
              </button>

              <span style={{ color: 'white', fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', minWidth: 80, textAlign: 'center' }}>
                {presentingIndex + 1} / {canvasState.slides.length}
              </span>

              <button
                onClick={() => setPresentingIndex(prev => Math.min(canvasState.slides.length - 1, prev + 1))}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  width: 56, height: 56,
                  borderRadius: '50%',
                  fontSize: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: presentingIndex === canvasState.slides.length - 1 ? 0.2 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <ChevronRight size={28} />
              </button>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Editing Components ---

const EditableSlideRenderer = ({
  slide,
  index,
  onAddBlock,
  onRemoveBlock,
  onUpdateContent,
  onUpdateItems,
  selectedBlockId,
  onSelectBlock
}: {
  slide: any;
  index: number;
  onAddBlock: (idx: number, type: string) => void;
  onRemoveBlock: (idx: number, id: string) => void;
  onUpdateContent: (idx: number, id: string, content: string) => void;
  onUpdateItems: (idx: number, id: string, items: string[]) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}) => {
  return (
    <div style={{
      aspectRatio: '16/9',
      background: slide.theme?.background || '#f5f3ee',
      borderRadius: 16,
      padding: '48px 64px',
      position: 'relative',
      cursor: 'default',
      overflow: 'hidden'
    }}>
      {/* Toolbar flottante de la slide */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: 6,
        zIndex: 50
      }}>
        {['h2', 'text', 'bullets'].map((type) => (
          <button
            key={type}
            onClick={(e) => { e.stopPropagation(); onAddBlock(index, type); }}
            className="bg-black/50 hover:bg-black/70 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md transition-all border border-white/10"
          >
            + {type === 'h2' ? 'Titre' : type === 'bullets' ? 'Liste' : 'Texte'}
          </button>
        ))}
      </div>

      {/* Blocs éditables */}
      <div className="flex flex-col h-full">
        {slide.blocks?.map((block: any) => (
          <div
            key={block.id}
            onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
            style={{
              position: 'relative',
              border: selectedBlockId === block.id ? '2px solid #5C4B40' : '2px solid transparent',
              borderRadius: 8,
              padding: 8,
              margin: '4px 0',
              cursor: 'text',
              transition: 'all 0.2s',
              background: selectedBlockId === block.id ? 'rgba(92, 75, 64, 0.05)' : 'transparent'
            }}
          >
            {/* Bouton supprimer */}
            {selectedBlockId === block.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveBlock(index, block.id)
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg hover:bg-red-600 transition-colors z-50 border border-white"
              >
                ×
              </button>
            )}

            {/* Contenu éditable */}
            <EditableBlock
              block={block}
              onUpdate={(content) => onUpdateContent(index, block.id, content)}
              onUpdateItems={(items) => onUpdateItems(index, block.id, items)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const EditableBlock = ({
  block,
  onUpdate,
  onUpdateItems
}: {
  block: any;
  onUpdate: (content: string) => void;
  onUpdateItems: (items: string[]) => void;
}) => {
  if (block.type === 'h1' || block.type === 'h2') {
    return (
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate(e.currentTarget.textContent || '')}
        style={{
          fontSize: block.type === 'h1' ? 42 : 32,
          fontWeight: 900,
          outline: 'none',
          color: 'inherit',
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em'
        }}
      >
        {block.content}
      </div>
    )
  }

  if (block.type === 'text') {
    return (
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onUpdate(e.currentTarget.textContent || '')}
        style={{
          fontSize: 18,
          outline: 'none',
          color: 'inherit',
          lineHeight: 1.6,
          opacity: 0.8
        }}
      >
        {block.content}
      </div>
    )
  }

  if (block.type === 'bullets') {
    return (
      <ul style={{ paddingLeft: 24, margin: '8px 0', listStyleType: 'disc' }}>
        {(block.items || []).map((item: string, i: number) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const newItems = [...(block.items || [])]
                newItems[i] = e.currentTarget.textContent || ''
                onUpdateItems(newItems)
              }}
              style={{ outline: 'none', fontSize: 18, opacity: 0.8 }}
            >
              {item}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return <div className="text-xs opacity-30 italic">Bloc type {block.type} non encore éditable</div>
}
