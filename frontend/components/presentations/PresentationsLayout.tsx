'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Presentation,
  Sparkles,
  Type,
  LayoutTemplate,
  Upload,
  Globe,
  FileText,
  Share2,
  ChevronDown,
  X,
  Loader2,
  Settings,
  MessageSquare,
  Plus,
  ArrowLeft,
  Send,
  FileUp,
  History,
  Mic,
  Download,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Play,
  Save,
  Presentation as PresentationIcon
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import PptxGenJS from 'pptxgenjs'
import ReactMarkdown from 'react-markdown'
import PresentationGrid from './PresentationGrid'
import PresentationConfigPanel from './PresentationConfigPanel'
import PresentationDetailPanel from './PresentationDetailPanel'
import ChatInput from '../chat/ChatInput'
import CanvasView from '../canvas/CanvasView'
import { useFusionEngine } from '@/hooks/useFusionEngine'
import SlideEditor from './SlideEditor'

export type PresentationData = {
  id: string
  user_id: string
  title: string
  prompt: string
  provider: 'gamma' | 'gemini'
  gamma_url?: string
  pptx_url?: string
  pdf_url?: string
  num_slides?: number
  format?: string
  dimensions?: string
  language?: string
  theme?: string
  tone?: string
  conversation_id?: string
  metadata?: any
  created_at: string
  thumbnail?: string
}

export interface SlideData {
  id: string
  title: string
  content: string        // texte avec bullet points
  notes: string          // notes présentateur
  imageUrl: string       // URL image si présente
  imagePrompt: string    // prompt pour générer l'image
  backgroundColor: string
  textColor: string
  layout: 'title' | 'content' | 'two-column' | 'image-left' | 'image-right' | 'blank'
}

export interface SlideCard {
  id: string
  title: string
  content: string  // bullet points séparés par \n
  order: number
}

const presentationSystemPrompt = `Tu es un expert en création de présentations professionnelles.
Quand tu proposes un plan de présentation, formate CHAQUE slide séparément avec ce format exact :

Titre du slide 1
- Point clé 1
- Point clé 2
- Point clé 3
---
Titre du slide 2
- Point clé 1
- Point clé 2
- Point clé 3
---
Titre du slide 3
- Point clé 1
- Point clé 2

RÈGLES STRICTES :
- Sépare CHAQUE slide par --- (trois tirets sur une ligne seule)
- Chaque slide a UN titre (première ligne, sans numéro, sans #, sans **)
- Puis des bullet points avec •
- Ne mets PAS de numéro devant les titres
- Ne mets PAS "Slide 1:", juste le titre directement
- Génère le nombre de slides demandé par l'utilisateur`

// Extraire un titre lisible du prompt
const extractTitle = (prompt: string) => {
  // Pattern 1: Title page about: "..."
  const titleMatch = prompt.match(/Title page about: "(.*?)"/i)
  if (titleMatch) return titleMatch[1].trim().substring(0, 60)

  // Pattern 2: Page showing: ...
  const pageMatch = prompt.match(/Page showing: (.*?)(?:\.|$)/i)
  if (pageMatch) return pageMatch[1].trim().substring(0, 60)

  // Pattern 3: Content: ...
  const contentMatch = prompt.match(/Content:\s*(.*?)(?:\.|Context:|$)/i)
  if (contentMatch) return contentMatch[1].trim().substring(0, 60)

  // Chercher dans "Context:"
  const contextMatch = prompt.match(/Context:\s*(.+?)(?:\.\s*\d|$)/i)
  if (contextMatch) return contextMatch[1].trim().substring(0, 60)

  // Fallback
  return prompt.substring(0, 50).replace(/^(professional|comic book|manga|modern|luxury|nature|minimalist).+?,\s*/i, '').trim() || 'Présentation sans titre'
}

// Extraire le contexte original (le prompt utilisateur) pour grouper les slides
const extractContext = (prompt: string) => {
  const match = prompt.match(/Context:\s*(.+?)(?:\.\s*16:9|\.\s*\d|$)/i)
  return match ? match[1].trim() : null
}

export default function PresentationsLayout() {
  const [activeTab, setActiveTab] = useState<'gamma' | 'gemini'>('gamma')
  const [presentationView, setPresentationView] = useState<'library' | 'create'>('library')
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [centerView, setCenterView] = useState<'grid' | 'chat' | 'models' | 'import' | 'paste'>('grid')
  const [editorView, setEditorView] = useState<'chat' | 'outline' | 'editor'>('chat')
  const [showEditor, setShowEditor] = useState(false)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [editorSlides, setEditorSlides] = useState<any[]>([])
  const isSavingRef = useRef(false)

  // Gemini Integrated Editor States
  const [slides, setSlides] = useState<SlideData[]>([])
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0)
  const [isPresentingMode, setIsPresentingMode] = useState(false)
  const [presentingIndex, setPresentingIndex] = useState(0)
  const [presentationTitle, setPresentationTitle] = useState('Nouvelle Présentation')
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null)

  const currentTheme = {
    bgColor: '#ffffff',
    textColor: '#5C4B40',
    accentColor: '#d4a574'
  }
  const [presentations, setPresentations] = useState<PresentationData[]>([])
  const [selectedPresentation, setSelectedPresentation] = useState<PresentationData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingGamma, setIsGeneratingGamma] = useState(false)
  const [outlineCards, setOutlineCards] = useState<SlideCard[]>([])
  const { runSolo, status: fusionStatus, error: fusionError } = useFusionEngine()

  // Chat state for presentation editing
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant' | 'system', content: string }[]>([])
  const [chatPrompt, setChatPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('gpt-5.2')

  // Voice/Transcription state
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [sttModel, setSttModel] = useState<'whisper-1' | 'gpt-4o-transcribe'>('whisper-1')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const sendToGammaRef = useRef<() => void>(() => { })

  // Config state (shared with panel)
  const [config, setConfig] = useState({
    format: 'presentation',
    dimensions: 'fluid',
    theme: '',
    language: 'Français',
    numSlides: 10,
    tone: 'Professionnel',
    audience: '',
    imageModel: 'imagen-4-pro',
    imageStyle: 'photorealistic',
    instructions: '',
    imageSource: 'IA', // IA, Web, None
    artStyle: 'Photo',
    visualKeywords: [] as string[]
  })

  // Advanced Gamma personalization states
  const [textAmount, setTextAmount] = useState<'brief' | 'medium' | 'detailed' | 'extensive'>('medium')
  const [imageSource, setImageSource] = useState<'aiGenerated' | 'web' | 'none'>('aiGenerated')
  const [imageModel, setImageModel] = useState<'auto' | 'nano-banana-pro' | 'imagen-4-pro' | 'flux-1.1-pro'>('auto')
  const [imageStyle, setImageStyle] = useState<'photorealistic' | 'illustration' | 'abstract' | '3d' | 'lineart' | 'custom'>('photorealistic')
  const [imageKeywords, setImageKeywords] = useState<string[]>([])
  const [gammaThemes, setGammaThemes] = useState<any[]>([])
  const [useThemeStyle, setUseThemeStyle] = useState(true)
  const [showAdvancedMode, setShowAdvancedMode] = useState(false)
  const [showConfig, setShowConfig] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const loadSTTModel = async () => {
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
      } catch {
        // Pas de settings = on garde whisper-1 par défaut
      }
    }
    loadSTTModel()
  }, [])

  useEffect(() => {
    const fetchGammaThemes = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('studio-presentation-themes')
        if (!error && data?.data) {
          setGammaThemes(data.data)
        }
      } catch (err) {
        console.error('Error fetching gamma themes:', err)
      }
    }
    fetchGammaThemes()
  }, [])

  const startRecording = async () => {
    // Cleanup any existing recording first
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
    setIsListening(false)

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream)
      } catch (constructErr) {
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        throw constructErr
      }

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await handleTranscription(audioBlob)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (err: any) {
      console.error('Mic error:', err)
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      streamRef.current = null
      alert("Impossible d'accéder au micro.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsListening(false)
  }

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', blob)
      formData.append('model', sttModel)

      const { data, error } = await supabase.functions.invoke('whisper-stt', {
        body: formData,
      })

      if (error) throw error
      if (data?.text) {
        setChatPrompt(prev => prev ? `${prev} ${data.text}` : data.text)
      }
    } catch (err: any) {
      console.error('Transcription error:', err)
    } finally {
      setIsTranscribing(false)
    }
  }

  const parseAssistantToCards = (message: string): SlideCard[] => {
    // Nettoyer le markdown pour simplifier le parsing
    let cleaned = message
      .replace(/```[\s\S]*?```/g, '') // retirer les blocs de code
      .replace(/\*\*/g, '')           // retirer le bold
      .replace(/#{1,3}\s/g, '')       // retirer les headers markdown
      .trim()

    // Découper sur --- (le séparateur demandé au LLM)
    let sections = cleaned.split(/\n\s*---\s*\n/)

    // Fallback : si pas de ---, essayer de découper sur les numéros "1." "2." etc.
    if (sections.length <= 1) {
      sections = cleaned.split(/\n(?=\d+[\.\)]\s)/)
    }

    // Fallback 2 : si toujours 1 seul bloc, découper sur les lignes qui ressemblent à des titres
    // (Ligne commençant par une majuscule, entre 5 et 80 caractères, finissant sans ponctuation forte)
    if (sections.length <= 1) {
      sections = cleaned.split(/\n(?=[A-ZÀÁÂÃÄÅÆÇÈÉÊË][^\n]{5,80}$)/m)
    }

    return sections
      .filter(s => s.trim().length > 10)
      .map((section, i) => {
        const lines = section.trim().split('\n')
        // Le titre est la première ligne non vide
        let title = lines[0]
          .replace(/^\d+[\.\)\-]\s*/, '')  // retirer "1." "2)" etc
          .replace(/^Slide\s*\d+\s*:?\s*/i, '') // retirer "Slide 1:"
          .trim()

        // Le contenu est le reste (bullet points)
        const content = lines.slice(1)
          .map(l => l.trim())
          .filter(l => l.length > 0)
          .join('\n')

        return {
          id: crypto.randomUUID(),
          title: title || `Carte ${i + 1}`,
          content: content,
          order: i + 1
        }
      })
  }

  const handleReParseWithAI = async () => {
    if (outlineCards.length === 0) return
    setIsGenerating(true)

    const reParsePrompt = `Voici un plan de présentation. Reformate-le en slides séparés par ---.
Chaque slide doit avoir un titre puis des bullet points avec •.
Sépare chaque slide par --- sur une ligne seule.
Ne numérote pas les titres.

Contenu à reformater :
${outlineCards.map(c => c.title + '\n' + c.content).join('\n')}`

    try {
      const data = await runSolo(
        reParsePrompt,
        selectedModel,
        activeConversationId || undefined,
        undefined, // projectId
        [{ role: 'system' as any, content: presentationSystemPrompt }], // history
        false // webVerify
      )

      if (data?.fusion) {
        const newCards = parseAssistantToCards(data.fusion)
        if (newCards.length > 0) {
          setOutlineCards(newCards)
        }
      }
    } catch (err) {
      console.error('Error re-parsing:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateFromOutline = async () => {
    setIsGeneratingGamma(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Construire le inputText avec séparateurs --- entre les cartes
    const inputText = outlineCards
      .map(card => {
        const bullets = card.content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .map(line => (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) ? line : `• ${line}`)
          .join('\n')
        return `${card.title}\n${bullets}`
      })
      .join('\n---\n')

    // Envoyer à Gamma avec cardSplit: 'inputTextBreaks'
    // car on utilise --- comme séparateur de cartes
    try {
      const { data, error } = await supabase.functions.invoke('studio-presentation-generate', {
        body: JSON.stringify({
          prompt: inputText,
          provider: 'gamma',
          num_slides: outlineCards.length,
          theme: config.theme,
          tone: config.tone,
          audience: config.audience,
          language: config.language,
          format: config.format,
          dimensions: config.dimensions,
          user_id: user.id,
          text_mode: 'generate',
          card_split: 'inputTextBreaks',
          additional_instructions: config.instructions,
          // Nouveaux paramètres visuels
          text_amount: textAmount,
          image_source: imageSource,
          image_model: imageModel,
          image_style: imageStyle,
          image_keywords: imageKeywords.join(', ')
        })
      })

      if (!error && data) {
        if (data.gamma_url) {
          window.open(data.gamma_url, '_blank')
        }
        fetchPresentations()
        setPresentationView('library')
        setDirection('backward')
      } else if (error) {
        alert("Erreur lors de la génération : " + error.message)
      }
    } catch (err: any) {
      alert("Erreur : " + err.message)
    } finally {
      setIsGeneratingGamma(false)
    }
  }

  const fetchPresentations = React.useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // 1. Fetch from 'presentations'
      const { data: pData } = await supabase
        .from('presentations')
        .select('*')
        .eq('user_id', user.id)

      // 2. Fetch from 'canvas_artifacts' (slides)
      const { data: aData } = await supabase
        .from('canvas_artifacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('mode', 'slides')

      // 3. Fetch from 'canvas_presentations'
      const { data: cpData } = await supabase
        .from('canvas_presentations')
        .select('*')
        .eq('user_id', user.id)

      // 4. Fetch from 'studio_images' (canvas source)
      const { data: sData } = await supabase
        .from('studio_images')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'canvas')

      let combined: any[] = []

      if (pData) combined = [...combined, ...pData]

      if (aData) {
        const mapped = aData.map(a => ({
          ...a,
          provider: 'gemini',
          num_slides: a.content?.slides?.length || 0,
          metadata: { ...a.metadata, is_artifact: true }
        }))
        combined = [...combined, ...mapped]
      }

      if (cpData) {
        const mapped = cpData.map(cp => ({
          ...cp,
          provider: cp.source || 'gemini',
          num_slides: cp.slides?.length || 0,
          metadata: { ...cp.metadata, is_canvas_pres: true }
        }))
        combined = [...combined, ...mapped]
      }

      if (sData && sData.length > 0) {
        // Grouper par Contexte (le prompt original de l'utilisateur) 
        // ET par proximité temporelle (slides d'une même session de génération)
        const grouped = sData.reduce((acc: any, img: any) => {
          const key = img.batch_id || img.id;
          if (!acc[key]) acc[key] = []
          acc[key].push(img)
          return acc
        }, {})

        const mappedFromStudio = Object.entries(grouped).map(([groupId, images]: [string, any]) => {
          const sortedImages = images.sort((a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          return {
            id: groupId,
            user_id: user.id,
            title: extractTitle(sortedImages[0].prompt),
            prompt: sortedImages[0].prompt,
            provider: 'gemini',
            num_slides: sortedImages.length,
            created_at: sortedImages[0].created_at,
            thumbnail: sortedImages[0].image_url,
            metadata: { is_studio_canvas: true, images: sortedImages }
          };
        })
        combined = [...combined, ...mappedFromStudio]
      }

      // Sort by created_at desc
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setPresentations(combined)
    } catch (err) {
      console.error('[Presentations] Error fetching all sources:', err)
    }
  }, [supabase])

  const handleSendToGamma = React.useCallback(async () => {
    const lastAssistantMessage = chatMessages
      .filter(m => m.role === 'assistant')
      .pop()

    if (!lastAssistantMessage) return

    setIsGeneratingGamma(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.functions.invoke('studio-presentation-generate', {
        body: JSON.stringify({
          prompt: lastAssistantMessage.content,
          provider: 'gamma',
          num_slides: config.numSlides,
          theme: config.theme,
          tone: config.tone,
          language: config.language,
          format: config.format,
          dimensions: config.dimensions,
          image_model: config.imageModel,
          image_style: config.imageStyle,
          user_id: user.id,
          text_mode: 'generate',
          additional_instructions: config.instructions,
          audience: config.audience,
          image_source: config.imageSource,
          art_style: config.artStyle,
          visual_keywords: config.visualKeywords,
          conversation_id: activeConversationId
        })
      })

      if (!error && data) {
        if (data.gamma_url) {
          window.open(data.gamma_url, '_blank')
        }
        fetchPresentations()
        setPresentationView('library')
        setDirection('backward')
      }
    } catch (err) {
      console.error('Gamma send error:', err)
    } finally {
      setIsGeneratingGamma(false)
    }
  }, [chatMessages, config, fetchPresentations, activeConversationId])

  useEffect(() => {
    sendToGammaRef.current = handleSendToGamma
  }, [handleSendToGamma])

  useEffect(() => {
    fetchPresentations()

    let channelRef: any = null

    // Fix Bug 4: Setup realtime with user_id filter
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const channel = supabase
        .channel(`presentations-${user.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'presentations', filter: `user_id=eq.${user.id}` },
          () => fetchPresentations()
        )
        .subscribe()
      return channel
    }
    setupRealtime().then(ch => { channelRef = ch })

    // Fix Bug 7: Stable handler via ref (never changes)
    const stableGammaHandler = () => sendToGammaRef.current()
    window.addEventListener('send-to-gamma', stableGammaHandler)

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPresentation(null)
    }
    window.addEventListener('keydown', handleEsc)

    return () => {
      if (channelRef) supabase.removeChannel(channelRef)
      window.removeEventListener('send-to-gamma', stableGammaHandler)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [fetchPresentations]) // Fix Bug 7: Removed handleSendToGamma from deps

  useEffect(() => {
    if (!isPresentingMode) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setPresentingIndex(i => Math.min(i + 1, slides.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setPresentingIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Escape') {
        setIsPresentingMode(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPresentingMode, slides.length])

  const handleDownloadPptx = () => {
    if (selectedPresentation?.pptx_url) {
      window.open(selectedPresentation.pptx_url, '_blank')
    }
  }

  const handleDownloadPdf = () => {
    if (selectedPresentation?.pdf_url) {
      window.open(selectedPresentation.pdf_url, '_blank')
    }
  }

  const handleDelete = async (presentation: PresentationData) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('presentations')
      .delete()
      .eq('id', presentation.id)
      .eq('user_id', user.id)

    if (!error) {
      setPresentations(prev => prev.filter(p => p.id !== presentation.id))
      if (selectedPresentation?.id === presentation.id) {
        setSelectedPresentation(null)
      }
    }
  }

  const handleCreateSlides = () => {
    const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistantMsg) return

    const cards = parseAssistantToCards(lastAssistantMsg.content)
    const newSlides: SlideData[] = cards.map((card, i) => ({
      id: crypto.randomUUID(),
      title: card.title,
      content: card.content,
      notes: '',
      imageUrl: '',
      imagePrompt: card.title,
      backgroundColor: currentTheme.bgColor,
      textColor: currentTheme.textColor,
      layout: i === 0 ? 'title' : 'content'
    }))

    setSlides(newSlides)
    setSelectedSlideIndex(0)
    setEditorView('editor')
    setCenterView('chat') // Reset center view if it was shifted
  }

  const handleExportPptx = async () => {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'

    for (const slide of slides) {
      const pptxSlide = pptx.addSlide()
      pptxSlide.background = { color: slide.backgroundColor.replace('#', '') }

      // Title
      pptxSlide.addText(slide.title, {
        x: 0.5, y: 0.5, w: '90%', h: 1,
        fontSize: 28, bold: true,
        color: slide.textColor.replace('#', '')
      })

      // Content
      const bulletPoints = slide.content.split('\n').filter(l => l.trim()).map(l => ({
        text: l.replace(/^[•\-]\s*/, ''),
        options: { bullet: true, fontSize: 16, color: slide.textColor.replace('#', '') }
      }))

      if (bulletPoints.length > 0) {
        pptxSlide.addText(bulletPoints, {
          x: 0.5, y: 1.8, w: '90%', h: 3
        })
      }

      // Image
      if (slide.imageUrl) {
        pptxSlide.addImage({
          path: slide.imageUrl,
          x: slide.layout === 'image-left' ? 0.3 : 5.5,
          y: 1.5, w: 4, h: 3
        })
      }

      // Notes
      if (slide.notes) {
        pptxSlide.addNotes(slide.notes)
      }
    }

    await pptx.writeFile({ fileName: `${presentationTitle || 'presentation'}.pptx` })
  }

  const handleSaveGemini = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const slidesJson = JSON.stringify(slides)
    const presentationId = crypto.randomUUID()
    const fileName = `presentations/${user.id}/${presentationId}_slides.json`

    await supabase.storage.from('studio').upload(fileName, slidesJson, {
      contentType: 'application/json', upsert: true
    })

    const { data: urlData } = supabase.storage.from('studio').getPublicUrl(fileName)

    await supabase.from('presentations').upsert({
      id: presentationId,
      user_id: user.id,
      title: presentationTitle,
      prompt: chatMessages[0]?.content || '',
      provider: 'gemini',
      pptx_url: urlData.publicUrl,
      num_slides: slides.length,
      status: 'done',
      created_at: new Date().toISOString()
    })

    fetchPresentations()
    setDirection('backward')
    setPresentationView('library')
  }

  const handleDeleteSlide = (index: number) => {
    if (slides.length <= 1) return
    const newSlides = [...slides]
    newSlides.splice(index, 1)
    setSlides(newSlides)
    if (selectedSlideIndex >= newSlides.length) {
      setSelectedSlideIndex(newSlides.length - 1)
    }
  }

  const handleAddSlide = () => {
    const newSlide: SlideData = {
      id: crypto.randomUUID(),
      title: 'Nouveau Slide',
      content: '• Contenu à éditer',
      notes: '',
      imageUrl: '',
      imagePrompt: '',
      backgroundColor: currentTheme.bgColor,
      textColor: currentTheme.textColor,
      layout: 'content'
    }
    setSlides([...slides, newSlide])
    setSelectedSlideIndex(slides.length)
  }

  const handleGenerateImageForSlide = async (index: number) => {
    const slide = slides[index]
    if (!slide.imagePrompt) return

    setIsGeneratingImage(slide.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fusion-run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
          },
          body: JSON.stringify({
            prompt: `Professional presentation slide image: ${slide.imagePrompt}. Clean, modern, high quality, business appropriate.`,
            fusion_mode: 'image',
            master_model_slug: 'gemini-3-pro-image-preview',
            image_count: 1
          })
        }
      )

      const result = await response.json()
      if (result.error) throw new Error(result.error)

      const imgUrl = result.raw_responses?.[0]?.all_images?.[0]
        || result.raw_responses?.[0]?.image_url
        || null

      if (imgUrl) {
        const newSlides = [...slides]
        newSlides[index].imageUrl = imgUrl
        setSlides(newSlides)
      } else {
        throw new Error('Aucune image générée')
      }
    } catch (err: any) {
      console.error('Image generation error:', err)
      alert('Erreur lors de la génération d\'image: ' + (err?.message || 'Erreur inconnue'))
    } finally {
      setIsGeneratingImage(null)
    }
  }

  const initCreateView = async () => {
    setDirection('forward')
    setPresentationView('create')
    setCenterView('grid') // Initial internal view of "create"

    // Fix Bug 8: Reuse existing conversation
    if (activeConversationId) return

    // Create conversation
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: conv } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'Nouvelle Présentation',
          mode: 'solo'
        })
        .select()
        .single()

      if (conv) {
        setActiveConversationId(conv.id)
      }
    }
  }

  const openEditor = (presentation: any) => {
    console.log('[Editor] openEditor appelé avec:', presentation)

    // S'assurer qu'on travaille sur une version propre
    const presData = presentation || selectedPresentation
    if (!presData) {
      console.error('[Editor] Aucune présentation sélectionnée pour l\'édition')
      return
    }

    // DETECTION DE LA SOURCE DES ELEMENTS
    let items: any[] = []

    // Cas 1: Studio Canvas (metadata.images)
    if (presData.metadata?.images) items = presData.metadata.images
    // Cas 2: Artefact (content.slides)
    else if (presData.content?.slides) items = presData.content.slides
    // Cas 3: Canvas Presentation (slides direct)
    else if (presData.slides) items = Array.isArray(presData.slides) ? presData.slides : []
    // Cas 4: Cas direct (si item est déjà un tableau de slides)
    else if (Array.isArray(presData)) items = presData

    console.log('[Editor] Eléments source trouvés:', items.length)

    // Convertir en format Slide standard pour l'éditeur
    let slidesForEditor = items.map((item: any) => ({
      id: item.id || crypto.randomUUID(),
      background: item.background || item.backgroundColor || '#ffffff',
      backgroundImage: item.backgroundImage || item.image_url || item.imageUrl || undefined,
      elements: Array.isArray(item.elements) ? item.elements : []
    }))

    // FALLBACK: Si vide, créer une slide par défaut
    if (slidesForEditor.length === 0) {
      slidesForEditor = [{
        id: crypto.randomUUID(),
        background: '#ffffff',
        backgroundImage: undefined,
        elements: []
      }]
    }

    setEditorSlides(slidesForEditor)
    setSelectedPresentation(presData)
    setShowEditor(true)
    console.log('[Editor] showEditor = true (slides count:', slidesForEditor.length, ')')
  }

  const saveEditedPresentation = async (updatedSlides: any[]) => {
    if (!selectedPresentation || isSavingRef.current) return
    isSavingRef.current = true

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      isSavingRef.current = false
      return
    }

    const presentationId = selectedPresentation.id
    const isArtifact = selectedPresentation.metadata?.is_artifact
    const isCanvasPres = selectedPresentation.metadata?.is_canvas_pres

    try {
      if (isCanvasPres) {
        // Mettre à jour canvas_presentations existant
        await supabase
          .from('canvas_presentations')
          .update({
            slides: updatedSlides,
            updated_at: new Date().toISOString()
          })
          .eq('id', presentationId)
          .eq('user_id', user.id)
      } else if (isArtifact) {
        // Mettre à jour canvas_artifacts
        await supabase
          .from('canvas_artifacts')
          .update({
            content: { slides: updatedSlides },
            metadata: {
              ...selectedPresentation.metadata,
              is_edited: true,
              thumbnail: updatedSlides[0]?.backgroundImage
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', presentationId)
          .eq('user_id', user.id)
      } else {
        // Première sauvegarde : créer une entrée avec un ID stable
        // Sauvegardes suivantes : mettre à jour cette même entrée
        const stableId = selectedPresentation.metadata?.canvas_pres_id || crypto.randomUUID()

        const { data: newPres, error } = await supabase
          .from('canvas_presentations')
          .upsert({
            id: stableId,
            user_id: user.id,
            title: selectedPresentation.title || 'Présentation éditée',
            slides: updatedSlides,
            source: 'gemini',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
          .select()
          .single()

        if (newPres) {
          setSelectedPresentation({
            ...selectedPresentation,
            ...newPres,
            num_slides: updatedSlides.length,
            metadata: {
              ...selectedPresentation.metadata,
              is_canvas_pres: true,
              canvas_pres_id: stableId
            }
          })
        }
      }
    } catch (err) {
      console.error('[Editor] Erreur sauvegarde:', err)
    } finally {
      isSavingRef.current = false
    }
  }

  const handleModeSelect = (mode: 'generate' | 'paste' | 'template' | 'import') => {
    setChatMessages([])
    if (mode === 'generate') {
      setCenterView('chat')
      setChatMessages([
        {
          role: 'system',
          content: presentationSystemPrompt
        },
        {
          role: 'assistant',
          content: "Bonjour ! Je suis prêt à vous aider à concevoir une présentation percutante. Quel est le sujet ou l'objectif de votre présentation ?"
        }
      ])
    } else if (mode === 'template') {
      setCenterView('models')
    } else if (mode === 'import') {
      setCenterView('import')
    } else if (mode === 'paste') {
      setCenterView('paste')
    }
  }

  const handleChatSubmit = async (overridePrompt?: string) => {
    const messageContent = overridePrompt || chatPrompt
    if (!messageContent.trim()) return

    const newUserMsg = { role: 'user' as const, content: messageContent }
    const updatedMessages = [...chatMessages, newUserMsg]

    setChatMessages(updatedMessages)
    setChatPrompt('')
    setIsGenerating(true)

    try {
      // Use useFusionEngine.runSolo to mirror main chat behavior
      const data = await runSolo(
        messageContent,
        selectedModel,
        activeConversationId || undefined,
        undefined, // projectId
        chatMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      )

      if (data?.fusion) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.fusion }])
      }
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const templates = [
    { id: 'pitch', title: 'Pitch Startup', desc: 'Template pour lever des fonds et convaincre des investisseurs.', themeId: 'Iris' },
    { id: 'report', title: 'Rapport Trimestriel', desc: 'Structure corporate pour vos bilans et revues d activité.', themeId: 'Mercury' },
    { id: 'training', title: 'Formation', desc: 'Template éducatif structuré pour l apprentissage.', themeId: 'Stratos' },
    { id: 'sales', title: 'Proposition Commerciale', desc: 'Template optimisé pour la vente et la closing.', themeId: 'Alien' },
    { id: 'project', title: 'Revue de Projet', desc: 'Gestion de projet, timeline et livrables.', themeId: 'Stratos' },
    { id: 'personal', title: 'Personal Branding', desc: 'Présentation de profil et portfolio personnel.', themeId: 'Creme' },
  ]

  const handleTemplateSelect = (template: any) => {
    setCenterView('chat')
    setConfig(prev => ({ ...prev, theme: template.themeId }))
    setChatMessages([
      {
        role: 'system',
        content: `Tu es un expert en création de ${template.title}. ${presentationSystemPrompt}`
      },
      {
        role: 'assistant',
        content: `C'est parti pour votre ${template.title} ! J'ai déjà configuré le style visuel sur "${template.themeId}". Quel est le nom de votre projet ou le sujet principal ?`
      }
    ])
  }


  const renderOutlineEditor = () => {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#FDFCFB] overflow-hidden">
        {/* Header de l'éditeur */}
        <div className="flex items-center justify-between p-6 border-b border-[#5C4B40]/10 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditorView('chat')} className="p-2 hover:bg-[#5C4B40]/5 rounded-xl transition-all">
              <ArrowLeft size={20} className="text-[#5C4B40]" />
            </button>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#5C4B40]">Éditeur de Contour</h3>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{outlineCards.length} Cartes dans le plan</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#5C4B40]/5 rounded-xl p-1 border border-[#5C4B40]/10">
              <button
                onClick={() => setOutlineCards(prev => prev.length > 1 ? prev.slice(0, -1) : prev)}
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-[#5C4B40]"
              >-</button>
              <span className="px-3 text-[10px] font-black">{outlineCards.length}</span>
              <button
                onClick={() => {
                  const newCard: SlideCard = {
                    id: crypto.randomUUID(),
                    title: "Nouvelle Carte",
                    content: "• Point 1",
                    order: outlineCards.length + 1
                  }
                  setOutlineCards(prev => [...prev, newCard])
                }}
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-[#5C4B40]"
              >+</button>
            </div>
            <select className="bg-[#5C4B40]/5 border-none outline-none rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest text-[#5C4B40] cursor-pointer">
              <option>Classique</option>
              <option>Studio</option>
            </select>
            <button
              onClick={handleReParseWithAI}
              disabled={isGenerating}
              className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Redécouper
            </button>
          </div>
        </div>

        {/* Zone Centrale Scrollable */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-12 pb-32">
          {/* Warning Message if low card count */}
          {outlineCards.length <= 2 && (
            <div className="max-w-4xl mx-auto p-6 bg-amber-50 border border-amber-200 rounded-[24px] flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Le plan semble trop court</p>
                  <p className="text-[10px] font-bold text-amber-900/60">Le découpage automatique n'a produit que {outlineCards.length} cartes. Voulez-vous que l'IA reformate le plan ?</p>
                </div>
              </div>
              <button
                onClick={handleReParseWithAI}
                disabled={isGenerating}
                className="px-6 py-3 bg-white text-amber-600 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-amber-200"
              >
                {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                🔄 Redécouper avec l'IA
              </button>
            </div>
          )}

          {/* Liste de Cartes */}
          <div className="max-w-4xl mx-auto space-y-6">
            {outlineCards.map((card, idx) => (
              <div key={card.id} className="group relative flex gap-6 p-8 bg-white rounded-[32px] border border-[#5C4B40]/10 shadow-sm hover:shadow-xl transition-all">
                {/* Numéro */}
                <div className="shrink-0">
                  <div className="w-10 h-10 bg-[#5C4B40] text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg">
                    {idx + 1}
                  </div>
                </div>

                {/* Contenu */}
                <div className="flex-1 space-y-4">
                  <input
                    value={card.title}
                    onChange={(e) => {
                      const newCards = [...outlineCards]
                      newCards[idx].title = e.target.value
                      setOutlineCards(newCards)
                    }}
                    placeholder="Titre de la carte..."
                    className="w-full bg-transparent border-none text-lg font-black text-[#5C4B40] outline-none placeholder-[#5C4B40]/20"
                  />
                  <textarea
                    value={card.content}
                    onChange={(e) => {
                      const newCards = [...outlineCards]
                      newCards[idx].content = e.target.value
                      setOutlineCards(newCards)
                    }}
                    placeholder="Contenu de la carte (points à puces)..."
                    className="w-full bg-transparent border-none text-[11px] font-medium leading-relaxed text-[#5C4B40]/70 outline-none resize-none no-scrollbar h-32"
                  />
                </div>

                {/* Boutons d'Action Hover */}
                <div className="absolute top-6 right-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => {
                      if (idx === 0) return
                      const newCards = [...outlineCards]
                      const temp = newCards[idx]
                      newCards[idx] = newCards[idx - 1]
                      newCards[idx - 1] = temp
                      setOutlineCards(newCards)
                    }}
                    className="p-2 hover:bg-[#5C4B40]/5 text-[#5C4B40] rounded-lg transition-colors"
                  ><ArrowLeft className="rotate-90" size={14} /></button>
                  <button
                    onClick={() => {
                      if (idx === outlineCards.length - 1) return
                      const newCards = [...outlineCards]
                      const temp = newCards[idx]
                      newCards[idx] = newCards[idx + 1]
                      newCards[idx + 1] = temp
                      setOutlineCards(newCards)
                    }}
                    className="p-2 hover:bg-[#5C4B40]/5 text-[#5C4B40] rounded-lg transition-colors"
                  ><ArrowLeft className="-rotate-90" size={14} /></button>
                  <button
                    onClick={() => setOutlineCards(prev => prev.filter(c => c.id !== card.id))}
                    className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                  ><X size={14} /></button>
                </div>

                {/* Bouton Ajouter Entre */}
                <button
                  onClick={() => {
                    const newCard = { id: crypto.randomUUID(), title: "", content: "", order: idx + 2 }
                    const newCards = [...outlineCards]
                    newCards.splice(idx + 1, 0, newCard)
                    setOutlineCards(newCards)
                  }}
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-white border border-[#5C4B40]/10 rounded-full flex items-center justify-center text-[#5C4B40] opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all z-10 shadow-md"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="max-w-4xl mx-auto border-t border-[#5C4B40]/10 pt-12 space-y-16">
            <h3 className="text-xl font-black uppercase tracking-tighter text-[#5C4B40]">Personnalisez votre Gamma</h3>

            {/* Section 1 — Contenu du Texte */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-[#5C4B40]" />
                <span className="font-black uppercase tracking-widest text-xs">📝 Contenu du texte</span>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-bold opacity-40 uppercase">Quantité de texte par carte</p>
                <div className="flex bg-[#5C4B40]/5 p-1 rounded-2xl w-fit border border-[#5C4B40]/10">
                  {[
                    { id: 'brief', label: 'Minimaliste', sub: '2 lignes' },
                    { id: 'medium', label: 'Concis', sub: '3 lignes' },
                    { id: 'detailed', label: 'Détaillé', sub: '4 lignes' },
                    { id: 'extensive', label: 'Très détaillé', sub: '5 lignes' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setTextAmount(opt.id as any)}
                      className={`px-6 py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${textAmount === opt.id ? 'bg-[#5C4B40] text-white shadow-lg shadow-[#5C4B40]/20' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">{opt.label}</span>
                      <span className="text-[8px] font-bold opacity-60">({opt.sub})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 2 — Visuels */}
            <div className="space-y-12">
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-[#5C4B40]" />
                <span className="font-black uppercase tracking-widest text-xs">🖼️ Visuels</span>
              </div>

              {/* Thème */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold opacity-40 uppercase">Thème</p>
                  <button className="text-[9px] font-black uppercase tracking-widest text-[#5C4B40]/40 hover:text-[#5C4B40]">Voir plus</button>
                </div>
                <p className="text-[11px] opacity-40 font-medium -mt-4">Plusieurs thèmes populaires sont disponibles ci-dessous ou découvrez-en d'autres.</p>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {gammaThemes.length > 0 ? (
                    gammaThemes.map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => setConfig(prev => ({ ...prev, theme: theme.id }))}
                        className={`relative group h-40 rounded-[32px] overflow-hidden border-2 transition-all ${config.theme === theme.id ? 'border-primary ring-4 ring-primary/10' : 'border-transparent'}`}
                      >
                        <div
                          className="absolute inset-0 p-6 flex flex-col gap-2"
                          style={{
                            backgroundColor: theme.colors?.backgroundColor || '#FDFCFB',
                            color: theme.colors?.accentColor || '#5C4B40'
                          }}
                        >
                          <div className="w-12 h-2 bg-current opacity-20 rounded-full" />
                          <div className="w-full h-4 bg-current opacity-40 rounded-sm mt-2" />
                          <div className="w-3/4 h-2 bg-current opacity-20 rounded-full" />
                          <div className="w-1/2 h-2 bg-current opacity-20 rounded-full" />
                          <div className="mt-auto flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[80%]">{theme.name}</span>
                            {config.theme === theme.id && <div className="w-6 h-6 bg-white text-[#5C4B40] rounded-full flex items-center justify-center shadow-lg shrink-0"><Plus className="rotate-45" size={14} /></div>}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    // Fallback static themes during loading or error
                    [
                      { id: 'Nebulae', name: 'Nebulae', bg: 'bg-[#0f0c29]', text: 'text-white' },
                      { id: 'Bonan Hale', name: 'Bonan Hale', bg: 'bg-[#002b36]', text: 'text-[#859900]' },
                      { id: 'Iris', name: 'Iris', bg: 'bg-indigo-600', text: 'text-white' },
                      { id: 'Kraft', name: 'Kraft', bg: 'bg-[#1a1a1a]', text: 'text-white' },
                      { id: 'Lavender', name: 'Lavender', bg: 'bg-[#f3e5f5]', text: 'text-black' },
                      { id: 'Electric', name: 'Electric', bg: 'bg-blue-500', text: 'text-white' }
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => setConfig(prev => ({ ...prev, theme: theme.id }))}
                        className={`relative group h-40 rounded-[32px] overflow-hidden border-2 transition-all ${config.theme === theme.id ? 'border-primary ring-4 ring-primary/10' : 'border-transparent'}`}
                      >
                        <div className={`absolute inset-0 ${theme.bg} ${theme.text} p-6 flex flex-col gap-2`}>
                          <div className="w-12 h-2 bg-current opacity-20 rounded-full" />
                          <div className="w-full h-4 bg-current opacity-40 rounded-sm mt-2" />
                          <div className="w-3/4 h-2 bg-current opacity-20 rounded-full" />
                          <div className="w-1/2 h-2 bg-current opacity-20 rounded-full" />
                          <div className="mt-auto flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-tighter">{theme.name}</span>
                            {config.theme === theme.id && <div className="w-6 h-6 bg-white text-[#5C4B40] rounded-full flex items-center justify-center shadow-lg"><Plus className="rotate-45" size={14} /></div>}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Source Image */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold opacity-40 uppercase">Source de l'image</p>
                  <select
                    value={imageSource}
                    onChange={(e) => setImageSource(e.target.value as any)}
                    className="w-full bg-[#5C4B40]/5 border border-[#5C4B40]/10 rounded-2xl px-4 py-3 text-[11px] font-bold text-[#5C4B40] appearance-none"
                  >
                    <option value="aiGenerated">✨ Images générées par IA</option>
                    <option value="web">🌐 Images du web</option>
                    <option value="none">🚫 Pas d'images</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold opacity-40 uppercase">Modèle d'image par IA</p>
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value as any)}
                    className="w-full bg-[#5C4B40]/5 border border-[#5C4B40]/10 rounded-2xl px-4 py-3 text-[11px] font-bold text-[#5C4B40] appearance-none"
                  >
                    {[
                      { value: 'auto', label: '🎨 Sélection automatique' },
                      { value: 'nano-banana-pro', label: '🍌 Nano Banana Pro (Google)' },
                      { value: 'imagen-4-pro', label: '✨ Imagen 4 Pro (Google)' },
                      { value: 'flux-1.1-pro', label: '🚀 Flux 1.1 Pro (Black Forest)' }
                    ].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Style Artistique */}
              <div className="space-y-6">
                <p className="text-[10px] font-bold opacity-40 uppercase">Style artistique de l'image</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: 'photorealistic', label: 'Photo' },
                    { id: 'illustration', label: 'Illustration' },
                    { id: 'abstract', label: 'Abstract' },
                    { id: '3d', label: '3D' },
                    { id: 'lineart', label: 'Trait' }
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => setImageStyle(style.id as any)}
                      className={`group relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all ${imageStyle === style.id ? 'border-[#5C4B40]' : 'border-transparent'}`}
                    >
                      <div className="absolute inset-0 bg-[#5C4B40]/5 flex items-center justify-center">
                        <PresentationIcon size={24} className="opacity-10" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[8px] font-black text-white text-center uppercase">{style.label}</p>
                      </div>
                      {imageStyle === style.id && <div className="absolute top-1 right-1 w-4 h-4 bg-[#5C4B40] text-white rounded-full flex items-center justify-center"><Plus className="rotate-45" size={10} /></div>}
                    </button>
                  ))}
                  <button
                    onClick={() => setImageStyle('custom')}
                    className={`w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${imageStyle === 'custom' ? 'border-[#5C4B40] bg-[#5C4B40]/5' : 'border-[#5C4B40]/10 hover:border-[#5C4B40]/20'}`}
                  >
                    <History size={16} className="opacity-40" />
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Perso</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useThemeStyle}
                    onChange={(e) => setUseThemeStyle(e.target.checked)}
                    id="themeStyle"
                    className="w-4 h-4 rounded border-[#5C4B40]/20 text-[#5C4B40] focus:ring-[#5C4B40]"
                  />
                  <label htmlFor="themeStyle" className="text-[11px] font-bold text-[#5C4B40]/60 cursor-pointer">Utiliser le style pré-défini du thème</label>
                </div>
              </div>

              {/* Mots-clés */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold opacity-40 uppercase">Mots-clés supplémentaires</p>
                <p className="text-[11px] opacity-40 font-medium -mt-2">Ajoutez des mots-clés (ex. : minimalisme, coloré) pour aider l'IA à rester cohérente.</p>
                <div className="flex flex-wrap gap-2 p-2 bg-[#5C4B40]/5 border border-[#5C4B40]/10 rounded-2xl">
                  {imageKeywords.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setImageKeywords(prev => prev.filter(t => t !== tag))}
                      className="px-3 py-1.5 bg-white border border-[#5C4B40]/10 rounded-xl text-[10px] font-black text-[#5C4B40] hover:bg-red-50 hover:text-red-500 transition-all flex items-center gap-2"
                    >
                      <Plus className="rotate-45" size={12} /> {tag}
                    </button>
                  ))}
                  <input
                    placeholder="Ajouter un mot-clé..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim()
                        if (val && !imageKeywords.includes(val)) {
                          setImageKeywords(prev => [...prev, val])
                          e.currentTarget.value = ""
                        }
                      }
                    }}
                    className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-[10px] font-black text-[#5C4B40] px-3 py-1.5"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowAdvancedMode(!showAdvancedMode)}
                className="flex items-center gap-3 text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors"
              >
                <Settings size={16} className={`transition-transform duration-300 ${showAdvancedMode ? 'rotate-90' : ''}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">Mode Avancé</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barre du Bas Fixe */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-2xl border-t border-[#5C4B40]/10 flex items-center justify-between z-40">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]">{outlineCards.length} CARTES AU TOTAL</span>
          </div>
          <button
            onClick={handleGenerateFromOutline}
            disabled={isGeneratingGamma}
            className="px-12 py-4 bg-[#5C4B40] text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-[#5C4B40]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
          >
            {isGeneratingGamma ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                GÉNÉRATION EN COURS...
              </>
            ) : (
              <>
                <PresentationIcon size={16} />
                ✨ GÉNÉRER LA PRÉSENTATION
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  const geminiThemes = [
    { id: 'pro', name: 'Professionnel', bgColor: '#ffffff', textColor: '#5C4B40', accent: '#3b82f6' },
    { id: 'dark', name: 'Sombre', bgColor: '#1a1a2e', textColor: '#ffffff', accent: '#8b5cf6' },
    { id: 'nature', name: 'Nature', bgColor: '#f0f5e8', textColor: '#1e3a1e', accent: '#10b981' },
    { id: 'corporate', name: 'Corporate', bgColor: '#f5f5f5', textColor: '#333333', accent: '#0066cc' },
    { id: 'creative', name: 'Créatif', bgColor: '#667eea', textColor: '#ffffff', accent: '#ff0080', isGradient: true },
  ]

  const layouts = [
    { id: 'title', name: 'Titre', icon: <Type size={16} /> },
    { id: 'content', name: 'Contenu', icon: <FileText size={16} /> },
    { id: 'two-column', name: '2 Colonnes', icon: <LayoutTemplate size={16} /> },
    { id: 'image-left', name: 'Image Gauche', icon: <Monitor size={16} className="-rotate-90" /> },
    { id: 'image-right', name: 'Image Droite', icon: <Monitor size={16} className="rotate-90" /> },
    { id: 'blank', name: 'Vide', icon: <div className="w-4 h-4 border border-current opacity-40" /> }
  ]

  const renderGeminiEditor = () => {
    const selectedSlide = slides[selectedSlideIndex]
    if (!selectedSlide) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-[40px] m-8 border border-[#5C4B40]/10">
          <PresentationIcon size={64} className="opacity-10 mb-6" />
          <h3 className="text-xl font-black uppercase tracking-tighter">Éditeur Gemini</h3>
          <p className="text-xs opacity-40 font-bold uppercase tracking-widest mt-2">Générez du contenu ou importez un plan pour commencer</p>
          <button onClick={() => setEditorView('chat')} className="mt-8 px-8 py-3 bg-[#5C4B40] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
            <Sparkles size={16} /> Générer avec l'IA
          </button>
        </div>
      )
    }

    return (
      <div className="flex-1 flex overflow-hidden bg-[#F8F6F2] m-0">
        {/* Panneau Slides Gauche */}
        <div className="w-[250px] bg-[#EAE1D3]/30 border-r border-[#5C4B40]/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[#5C4B40]/5 bg-white/50">
            <p className="text-[10px] font-black uppercase tracking-widest">Aperçu Slides</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                onClick={() => setSelectedSlideIndex(idx)}
                className={`relative aspect-video rounded-xl border-2 transition-all cursor-pointer overflow-hidden group ${selectedSlideIndex === idx ? 'border-[#5C4B40] shadow-lg ring-2 ring-[#5C4B40]/10' : 'border-transparent bg-white/50 hover:bg-white'
                  }`}
              >
                <div className="absolute top-2 left-2 w-5 h-5 bg-black/10 rounded-full flex items-center justify-center text-[10px] font-bold z-10">{idx + 1}</div>
                <div className="p-3 transform scale-[0.4] origin-top-left w-[250%]" style={{ color: slide.textColor }}>
                  <h4 className="font-black uppercase text-xl line-clamp-1">{slide.title}</h4>
                  <p className="text-xs mt-2 line-clamp-3">{slide.content}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSlide(idx); }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={handleAddSlide}
              className="w-full aspect-video rounded-xl border-2 border-dashed border-[#5C4B40]/10 flex flex-col items-center justify-center gap-2 hover:bg-[#5C4B40]/5 transition-all group shrink-0"
            >
              <Plus size={24} className="opacity-20 group-hover:opacity-40" />
              <span className="text-[9px] font-black uppercase opacity-20 group-hover:opacity-40">Ajouter Slide</span>
            </button>
          </div>
          <div className="p-4 border-t border-[#5C4B40]/10 bg-white/50 space-y-2">
            <button
              onClick={() => setEditorView('chat')}
              className="w-full py-3 bg-[#5C4B40] text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#4A3C33] transition-all shadow-lg"
            >
              <Sparkles size={14} /> GÉNÉRER AVEC L'IA
            </button>
          </div>
        </div>

        {/* Éditeur Central */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Barre d'outils Editor */}
          <div className="px-8 py-3 bg-white border-b border-[#5C4B40]/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <input
                value={presentationTitle}
                onChange={(e) => setPresentationTitle(e.target.value)}
                className="bg-transparent font-black uppercase tracking-tighter text-[#5C4B40] outline-none text-sm border-b-2 border-transparent focus:border-[#d4a574] transition-all min-w-[200px]"
              />
              <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{slides.length} slides</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditorView('chat')} className="p-2 hover:bg-[#5C4B40]/5 rounded-xl text-[#5C4B40]/60 flex items-center gap-2 transition-all">
                <Sparkles size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">IA</span>
              </button>
              <div className="w-[1px] h-4 bg-[#5C4B40]/10 mx-2" />
              <button onClick={() => { setPresentingIndex(selectedSlideIndex); setIsPresentingMode(true); }} className="px-4 py-2 bg-white border border-[#5C4B40]/10 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#5C4B40]/5 transition-all active:scale-95">
                <Play size={12} fill="currentColor" /> Présenter
              </button>
              <button onClick={handleExportPptx} className="px-4 py-2 bg-white border border-[#5C4B40]/10 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#5C4B40]/5 transition-all">
                <Download size={12} /> PPTX
              </button>
              <button onClick={handleSaveGemini} className="px-6 py-2 bg-[#5C4B40] text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#4A3C33] transition-all shadow-lg active:scale-95">
                <Save size={12} /> Sauvegarder
              </button>
            </div>
          </div>

          {/* Zone Slide */}
          <div className="flex-1 overflow-y-auto p-12 flex items-center justify-center no-scrollbar">
            <div
              className="aspect-video w-full max-w-4xl bg-white rounded-[32px] shadow-2xl p-16 flex flex-col gap-8 relative overflow-hidden transition-all duration-500"
              style={{ backgroundColor: selectedSlide.backgroundColor, color: selectedSlide.textColor }}
            >
              {/* Contenu Slide - Adapté selon Layout */}
              <div className={`flex-1 flex gap-12 ${selectedSlide.layout === 'image-left' ? 'flex-row-reverse' :
                selectedSlide.layout === 'image-right' ? 'flex-row' :
                  'flex-col'
                }`}>
                <div className={`flex-1 flex flex-col ${selectedSlide.layout === 'title' ? 'items-center justify-center text-center' : ''}`}>
                  <textarea
                    value={selectedSlide.title}
                    onChange={(e) => {
                      const newSlides = [...slides]
                      newSlides[selectedSlideIndex].title = e.target.value
                      setSlides(newSlides)
                    }}
                    placeholder="Titre du slide..."
                    className="w-full bg-transparent border-none outline-none font-black uppercase tracking-tighter leading-tight resize-none no-scrollbar overflow-hidden"
                    style={{ fontSize: selectedSlide.layout === 'title' ? '48px' : '32px' }}
                    rows={2}
                  />

                  {selectedSlide.layout !== 'title' && (
                    <textarea
                      value={selectedSlide.content}
                      onChange={(e) => {
                        const newSlides = [...slides]
                        newSlides[selectedSlideIndex].content = e.target.value
                        setSlides(newSlides)
                      }}
                      placeholder="• Commencez par un point..."
                      className="w-full bg-transparent border-none outline-none mt-4 text-xl font-medium leading-relaxed resize-none no-scrollbar"
                      rows={10}
                    />
                  )}
                </div>

                {(selectedSlide.layout === 'image-left' || selectedSlide.layout === 'image-right') && (
                  <div className="w-[40%] aspect-[4/5] bg-black/5 rounded-[24px] overflow-hidden group/image relative">
                    {selectedSlide.imageUrl ? (
                      <img src={selectedSlide.imageUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center opacity-20">
                        <Monitor size={48} className="mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Image IA</span>
                      </div>
                    )}
                    <button className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-4 py-2 bg-white text-black rounded-xl text-[10px] font-black uppercase">Changer Image</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Zone Notes */}
          <div className="h-20 bg-white border-t border-[#5C4B40]/10 flex items-stretch shrink-0 group">
            <div className="w-20 flex items-center justify-center border-r border-[#5C4B40]/5 bg-[#5C4B40]/5">
              <MessageSquare size={20} className="opacity-20" />
            </div>
            <textarea
              value={selectedSlide.notes}
              onChange={(e) => {
                const newSlides = [...slides]
                newSlides[selectedSlideIndex].notes = e.target.value
                setSlides(newSlides)
              }}
              placeholder="Notes du présentateur (visibles uniquement en mode présentation)..."
              className="flex-1 p-4 text-[11px] font-medium outline-none resize-none bg-transparent"
            />
          </div>
        </div>

        {/* Panneau Propriétés Droite */}
        <div className="w-[300px] bg-[#EAE1D3]/30 border-l border-[#5C4B40]/10 overflow-y-auto no-scrollbar pb-20">
          <div className="p-6 space-y-10">
            {/* Layouts */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Mise en page</p>
              <div className="grid grid-cols-2 gap-3">
                {layouts.map(l => (
                  <button
                    key={l.id}
                    onClick={() => {
                      const newSlides = [...slides]
                      newSlides[selectedSlideIndex].layout = l.id as any
                      setSlides(newSlides)
                    }}
                    className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${selectedSlide.layout === l.id ? 'border-[#5C4B40] bg-white' : 'border-transparent bg-white/50 hover:bg-white'
                      }`}
                  >
                    <div className="p-2 bg-[#5C4B40]/5 rounded-xl">{l.icon}</div>
                    <span className="text-[9px] font-bold uppercase tracking-widest">{l.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Couleurs</p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl border border-[#5C4B40]/5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#5C4B40]/60">Fond du slide</span>
                  <input
                    type="color"
                    value={selectedSlide.backgroundColor}
                    onChange={(e) => {
                      const newSlides = [...slides]
                      newSlides[selectedSlideIndex].backgroundColor = e.target.value
                      setSlides(newSlides)
                    }}
                    className="w-10 h-8 rounded-lg overflow-hidden border-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-white/50 rounded-2xl border border-[#5C4B40]/5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#5C4B40]/60">Texte</span>
                  <input
                    type="color"
                    value={selectedSlide.textColor}
                    onChange={(e) => {
                      const newSlides = [...slides]
                      newSlides[selectedSlideIndex].textColor = e.target.value
                      setSlides(newSlides)
                    }}
                    className="w-10 h-8 rounded-lg overflow-hidden border-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Thèmes rapides */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Thèmes rapides</p>
              <div className="grid grid-cols-1 gap-2">
                {geminiThemes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      const newSlides = [...slides]
                      newSlides[selectedSlideIndex].backgroundColor = t.bgColor
                      newSlides[selectedSlideIndex].textColor = t.textColor
                      setSlides(newSlides)
                    }}
                    className="flex items-center gap-3 p-2.5 bg-white/50 rounded-2xl hover:bg-white transition-all border border-transparent hover:border-[#5C4B40]/10"
                  >
                    <div className="w-8 h-8 rounded-lg border border-black/5 flex-shrink-0" style={{ backgroundColor: t.isGradient ? '#667eea' : t.bgColor }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Properties */}
            {(selectedSlide.layout === 'image-left' || selectedSlide.layout === 'image-right') && (
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Image du slide</p>
                <div className="p-4 bg-white/50 rounded-2xl border border-[#5C4B40]/5 space-y-4">
                  <textarea
                    value={selectedSlide.imagePrompt}
                    onChange={(e) => {
                      const newSlides = [...slides]
                      newSlides[selectedSlideIndex].imagePrompt = e.target.value
                      setSlides(newSlides)
                    }}
                    placeholder="Prompt pour l'image..."
                    className="w-full h-20 p-3 bg-white/50 border border-[#5C4B40]/5 rounded-xl text-[10px] font-medium outline-none resize-none"
                  />
                  <button
                    onClick={() => handleGenerateImageForSlide(selectedSlideIndex)}
                    disabled={isGeneratingImage === selectedSlide.id}
                    className="w-full py-3 bg-[#5C4B40] text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isGeneratingImage === selectedSlide.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    🎨 Générer Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderModels = () => {
    return (
      <div className="p-12 h-full overflow-y-auto no-scrollbar">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <h2 className="text-3xl font-black text-[#5C4B40] uppercase tracking-tighter mb-2">Modèles de Présentation</h2>
            <p className="text-sm opacity-60 font-medium">Choisissez une structure de départ pour accélérer votre création.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(t => (
              <motion.button
                key={t.id}
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTemplateSelect(t)}
                className="group relative flex flex-col p-6 bg-white rounded-[32px] border border-[#5C4B40]/10 text-left hover:shadow-2xl hover:border-[#5C4B40]/20 transition-all overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowLeft className="rotate-180 text-[#d4a574]" size={20} />
                </div>
                <div className="w-12 h-12 rounded-2xl bg-[#5C4B40]/5 flex items-center justify-center mb-6 group-hover:bg-[#d4a574]/10 transition-colors">
                  <LayoutTemplate size={24} className="text-[#5C4B40] group-hover:text-[#d4a574]" />
                </div>
                <h3 className="text-sm font-black uppercase text-[#5C4B40] mb-2">{t.title}</h3>
                <p className="text-[10px] leading-relaxed opacity-60 font-medium">{t.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderImport = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-12">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="w-24 h-24 rounded-[40px] bg-[#5C4B40]/5 flex items-center justify-center mx-auto mb-8">
          <Upload size={40} className="text-[#5C4B40]" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Importer un fichier</h2>
          <p className="text-sm opacity-60 font-medium leading-relaxed">
            Glissez-déposez vos fichiers (PDF, PPTX, DOCX, TXT) ou cliquez pour parcourir.
            Le contenu sera extrait pour structurer votre présentation.
          </p>
        </div>
        <div className="p-12 border-2 border-dashed border-[#5C4B40]/10 rounded-[48px] bg-white/50 hover:bg-white hover:border-[#5C4B40]/20 transition-all cursor-pointer group">
          <div className="flex flex-col items-center gap-4">
            <FileUp size={32} className="opacity-20 group-hover:opacity-40 transition-opacity" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Parcourir les fichiers</span>
          </div>
        </div>
        <button onClick={() => setCenterView('grid')} className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
          Retour à la grille
        </button>
      </div>
    </div>
  )

  const renderPresentationPlayer = () => {
    if (!isPresentingMode) return null
    const slide = slides[presentingIndex]
    if (!slide) return null

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-12"
      >
        <button
          onClick={() => setIsPresentingMode(false)}
          className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all z-10"
        >
          <X size={24} />
        </button>

        <div
          className="aspect-video w-full max-w-6xl bg-white shadow-2xl relative overflow-hidden flex flex-col p-20"
          style={{ backgroundColor: slide.backgroundColor, color: slide.textColor }}
        >
          <div className={`flex-1 flex gap-16 ${slide.layout === 'image-left' ? 'flex-row-reverse' :
            slide.layout === 'image-right' ? 'flex-row' :
              'flex-col'
            }`}>
            <div className={`flex-1 flex flex-col ${slide.layout === 'title' ? 'items-center justify-center text-center' : ''}`}>
              <h2 className="font-black uppercase tracking-tighter leading-tight" style={{ fontSize: slide.layout === 'title' ? '64px' : '48px' }}>
                {slide.title}
              </h2>
              {slide.layout !== 'title' && (
                <div className="mt-8 text-2xl font-medium leading-relaxed whitespace-pre-wrap">
                  {slide.content}
                </div>
              )}
            </div>
            {(slide.layout === 'image-left' || slide.layout === 'image-right') && slide.imageUrl && (
              <div className="w-[40%] aspect-[4/5] rounded-[32px] overflow-hidden">
                <img src={slide.imageUrl} className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-black/40 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <button
            onClick={() => setPresentingIndex(i => Math.max(i - 1, 0))}
            className="text-white/60 hover:text-white transition-all disabled:opacity-20"
            disabled={presentingIndex === 0}
          >
            <ChevronLeft size={32} />
          </button>
          <span className="text-white font-black tracking-widest text-sm">
            {presentingIndex + 1} / {slides.length}
          </span>
          <button
            onClick={() => setPresentingIndex(i => Math.min(i + 1, slides.length - 1))}
            className="text-white/60 hover:text-white transition-all disabled:opacity-20"
            disabled={presentingIndex === slides.length - 1}
          >
            <ChevronRight size={32} />
          </button>
        </div>
      </motion.div>
    )
  }

  const handleOpenConversation = async (presentation: PresentationData) => {
    if (!presentation.conversation_id) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load existing messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', presentation.conversation_id)
      .order('created_at', { ascending: true })

    if (msgs) {
      setChatMessages(msgs.map(m => ({ role: m.role, content: m.content })))
      setActiveConversationId(presentation.conversation_id)
      setPresentationView('create')
      setCenterView('chat')
      setDirection('forward')
      setSelectedPresentation(null)
    }
  }

  return (
    <div className="flex h-full w-full bg-[#F8F6F2] text-[#5C4B40] overflow-hidden relative">
      <AnimatePresence mode="wait" custom={direction}>
        {presentationView === 'library' ? (
          <motion.div
            key="library"
            custom={direction}
            initial={{ opacity: 0, x: direction === 'forward' ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 'forward' ? -50 : 50 }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Library Header */}
            <div className="p-8 pb-4 flex items-center justify-between shrink-0">
              <div>
                <h1 className="text-2xl font-black text-[#5C4B40] uppercase tracking-tighter">Bibliothèque de Présentations</h1>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Gérez et accédez à vos créations IA</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={initCreateView}
                  className="px-6 py-3 bg-[#5C4B40] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#4A3C33] transition-all shadow-xl shadow-[#5C4B40]/20"
                >
                  <Plus size={16} /> Créer
                </button>
              </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-8">
              {presentations.length > 0 ? (
                <PresentationGrid
                  presentations={presentations}
                  onSelect={setSelectedPresentation}
                  onDelete={handleDelete}
                  onEdit={(p) => openEditor(p)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <Presentation size={48} />
                  <div>
                    <p className="text-sm font-black uppercase tracking-widest">Aucune présentation</p>
                    <p className="text-[10px] font-bold">Créez votre première présentation !</p>
                    <button onClick={initCreateView} className="mt-4 px-6 py-3 bg-[#5C4B40] text-white rounded-xl text-[8px] font-bold uppercase transition-all">Démarrer</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="create"
            custom={direction}
            initial={{ opacity: 0, x: direction === 'forward' ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === 'forward' ? 50 : -50 }}
            className="absolute inset-0 flex"
          >
            {/* Atelier View */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-[#5C4B40]/10">
              {/* Header with Back & Tabs */}
              <div className="p-8 pb-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => { setDirection('backward'); setPresentationView('library'); }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                  >
                    <ArrowLeft size={16} /> Bibliothèque
                  </button>
                  <div className="h-4 w-[1px] bg-[#5C4B40]/10" />
                  <div className="flex gap-6 relative">
                    <button
                      onClick={() => setActiveTab('gamma')}
                      className={`relative pb-2 text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${activeTab === 'gamma' ? 'text-[#5C4B40]' : 'text-[#5C4B40]/40'}`}
                    >
                      GAMMA
                      {activeTab === 'gamma' && <motion.div layoutId="tab-u" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5C4B40]" />}
                    </button>
                    <button
                      onClick={() => setActiveTab('gemini')}
                      className={`relative pb-2 text-[10px] font-black uppercase tracking-[0.3em] transition-colors ${activeTab === 'gemini' ? 'text-[#5C4B40]' : 'text-[#5C4B40]/40'}`}
                    >
                      GEMINI
                      {activeTab === 'gemini' && <motion.div layoutId="tab-u" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5C4B40]" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Center Content Area */}
              <div className="flex-1 overflow-hidden relative flex flex-col">
                <AnimatePresence mode="wait">
                  {activeTab === 'gemini' ? (
                    <motion.div
                      key="gemini-canvas"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0"
                    >
                      <CanvasView
                        initialMode="slides"
                      // onClose={() => setPresentationView('library')} // Removed close button
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="gamma-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      {centerView === 'chat' ? (
                        <div className="flex-1 flex flex-col bg-white/20 backdrop-blur-sm rounded-0 overflow-hidden m-6">
                          <div className="p-4 border-b border-[#5C4B40]/5 flex items-center justify-between bg-white/50">
                            <div className="flex items-center gap-3">
                              <button onClick={() => setCenterView('grid')} className="p-2 hover:bg-[#5C4B40]/5 rounded-xl"><ArrowLeft size={18} /></button>
                              <div>
                                <h3 className="text-xs font-black uppercase tracking-widest">Atelier Gamma</h3>
                                <p className="text-[8px] font-bold opacity-40 uppercase">Dialogue avec l'IA</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                            {chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#5C4B40] text-white' : 'bg-white border border-[#5C4B40]/10 text-[#5C4B40]'}`}>
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              </div>
                            ))}
                            {isGenerating && (
                              <div className="flex justify-start">
                                <div className="p-4 rounded-2xl bg-white border border-[#5C4B40]/10 flex items-center gap-3">
                                  <Loader2 size={14} className="animate-spin opacity-40" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Réflexion...</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-6 bg-white/50 border-t border-[#5C4B40]/5">
                            <div className="max-w-3xl mx-auto flex items-end gap-3">
                              <div className="flex-1 bg-white border border-[#5C4B40]/10 rounded-2xl p-2 shadow-sm">
                                <textarea
                                  value={chatPrompt}
                                  onChange={(e) => setChatPrompt(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChatSubmit())}
                                  placeholder="Répondez à l'assistant..."
                                  className="w-full h-20 p-2 bg-transparent text-[11px] outline-none resize-none"
                                />
                                <div className="flex items-center justify-between px-2 pb-1">
                                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="text-[9px] font-black uppercase tracking-wider bg-[#5C4B40]/5 px-2 py-1 rounded-lg border-none outline-none cursor-pointer">
                                    <option value="gpt-5.2">GPT-5.2</option>
                                    <option value="claude-opus-4.6">Claude Opus</option>
                                    <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                                  </select>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={isListening ? stopRecording : startRecording}
                                      className={`p-2.5 rounded-xl transition-all shadow-sm active:scale-95 ${isListening
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : isTranscribing
                                          ? 'bg-[#5C4B40]/10 text-[#5C4B40]/40'
                                          : 'bg-white text-[#5C4B40]/60 hover:bg-[#5C4B40]/5 border border-[#5C4B40]/10'
                                        }`}
                                    >
                                      {isTranscribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                                    </button>
                                    <button onClick={() => handleChatSubmit()} disabled={!chatPrompt.trim() || isGenerating} className="p-2.5 bg-[#5C4B40] text-white rounded-xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg active:scale-95"><Send size={16} /></button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : centerView === 'import' ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                          <div className="w-full max-w-2xl aspect-video bg-white border-2 border-dashed border-[#5C4B40]/10 rounded-[40px] flex flex-col items-center justify-center gap-6 group hover:border-[#5C4B40]/20 transition-all cursor-pointer">
                            <FileUp size={32} className="opacity-40" />
                            <p className="text-xs font-black uppercase tracking-widest">Importer un fichier</p>
                          </div>
                          <button onClick={() => setCenterView('grid')} className="mt-8 text-[10px] font-black uppercase opacity-40">Retour</button>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                          {/* Gamma grid or selection */}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Atelier Config Area (30%) - UNIQUEMENT POUR GAMMA */}
            {activeTab === 'gamma' && (
              <div className="relative shrink-0 flex items-start !overflow-visible">
                {/* Bouton flottant Configuration (uniquement icône) */}
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`absolute right-full mr-4 top-4 w-10 h-10 rounded-xl transition-all duration-500 shadow-2xl z-[150] active:scale-95 group flex items-center justify-center border border-[#5C4B40]/10 ${showConfig
                    ? 'bg-[#5C4B40] text-white hover:bg-[#4A3C33]'
                    : 'bg-white text-[#5C4B40] hover:bg-[#5C4B40]/5'
                    }`}
                  title={showConfig ? "Masquer la configuration" : "Afficher la configuration"}
                >
                  <Settings size={20} className={showConfig ? '' : 'animate-spin-slow'} />
                </button>

                <AnimatePresence>
                  {showConfig && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 400, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="shrink-0 bg-white/30 backdrop-blur-xl border-l border-[#5C4B40]/10 overflow-hidden"
                    >
                      <div className="w-[400px] h-full">
                        <PresentationConfigPanel
                          activeTab={activeTab}
                          isGenerating={isGenerating}
                          setIsGenerating={setIsGenerating}
                          onSuccess={fetchPresentations}
                          onModeSelect={handleModeSelect}
                          config={config}
                          setConfig={setConfig}
                          showDetails={centerView !== 'grid'}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div >
        )}
      </AnimatePresence >

      {/* Fullscreen Preview View */}
      <AnimatePresence>
        {
          selectedPresentation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-[#F8F6F2] flex flex-col"
            >
              {showEditor && (
                <div className="absolute inset-0 z-[60] bg-[#f0ede8]">
                  <SlideEditor
                    slides={editorSlides}
                    onSave={async (updatedSlides) => {
                      console.log('[Editor] Auto-save en cours...')
                      await saveEditedPresentation(updatedSlides)
                    }}
                    onClose={() => setShowEditor(false)}
                  />
                </div>
              )}
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#5C4B40]/10 bg-white shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSelectedPresentation(null)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#5C4B40] hover:opacity-70 transition-opacity"
                  >
                    <ArrowLeft size={16} /> BIBLIOTHÈQUE
                  </button>
                  <div className="h-4 w-[1px] bg-[#5C4B40]/10" />
                  <div className="flex flex-col">
                    <h2 className="text-sm font-black text-[#5C4B40] uppercase tracking-tighter truncate max-w-[400px]">
                      {selectedPresentation.title}
                    </h2>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-[#5C4B40]/40">
                      {selectedPresentation.num_slides} slides générés par IA
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setShowEditMenu(!showEditMenu)}
                      className="px-6 py-3 bg-[#5C4B40] text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#4A3C33] transition-all shadow-lg active:scale-95"
                    >
                      ✏️ Éditer <ChevronDown size={14} className={`transition-transform ${showEditMenu ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showEditMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-2 w-48 bg-white border border-[#5C4B40]/10 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              openEditor(selectedPresentation)
                              setShowEditMenu(false)
                            }}
                            className="w-full px-4 py-3 text-left text-[10px] font-bold text-[#5C4B40] hover:bg-[#5C4B40]/5 transition-all flex items-center gap-3 border-b border-[#5C4B40]/5"
                          >
                            🎨 Dans le Studio
                          </button>
                          <button
                            onClick={() => {
                              window.open(selectedPresentation.gamma_url, '_blank')
                              setShowEditMenu(false)
                            }}
                            className="w-full px-4 py-3 text-left text-[10px] font-bold text-[#5C4B40] hover:bg-[#5C4B40]/5 transition-all flex items-center gap-3"
                          >
                            ✨ Dans Gamma
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="h-6 w-[1px] bg-[#5C4B40]/10 mx-1" />
                  <button
                    onClick={handleDownloadPptx}
                    disabled={!selectedPresentation.pptx_url}
                    className="px-4 py-3 border border-[#5C4B40]/20 rounded-xl text-[9px] font-black text-[#5C4B40] uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all disabled:opacity-30 flex items-center gap-2"
                  >
                    <Download size={14} /> PPTX
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!selectedPresentation.pdf_url}
                    className="px-4 py-3 border border-[#5C4B40]/20 rounded-xl text-[9px] font-black text-[#5C4B40] uppercase tracking-widest hover:bg-[#5C4B40]/5 transition-all disabled:opacity-30 flex items-center gap-2"
                  >
                    <FileText size={14} /> PDF
                  </button>
                  <button
                    onClick={() => { if (confirm('Supprimer définitivement ?')) handleDelete(selectedPresentation); }}
                    className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all ml-2"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    onClick={() => setSelectedPresentation(null)}
                    className="p-3 text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Fullscreen Iframe */}
              <div className="flex-1 p-6 flex flex-col overflow-hidden">
                <div className="flex-1 bg-white rounded-[40px] border border-[#5C4B40]/10 shadow-2xl overflow-hidden relative group">
                  {selectedPresentation.gamma_url ? (
                    <iframe
                      src={selectedPresentation.gamma_url.replace('/docs/', '/embed/')}
                      className="w-full h-full border-none"
                      allowFullScreen
                      title={selectedPresentation.title}
                    />
                  ) : selectedPresentation.metadata?.is_studio_canvas ? (
                    <div className="w-full h-full bg-[#f5f3ee] flex flex-col items-center justify-center p-8 overflow-y-auto no-scrollbar relative">
                      <div className="flex flex-col gap-12 max-w-5xl w-full">
                        {selectedPresentation.metadata.images.map((img: any, idx: number) => (
                          <div key={img.id} className="flex flex-col gap-4">
                            <div className="flex items-center gap-4 text-[#5C4B40]/40">
                              <span className="text-[10px] font-black uppercase tracking-widest bg-[#5C4B40]/5 px-3 py-1 rounded-full">PAGE {idx + 1}</span>
                            </div>
                            <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border border-[#5C4B40]/10">
                              <img
                                src={img.image_url}
                                alt={`Slide ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#EAE1D3]/30 to-[#F8F6F2]/30 p-12 text-center">
                      <PresentationIcon size={64} className="text-[#5C4B40]/20 mb-6" />
                      <p className="text-[12px] font-black uppercase tracking-[0.3em] max-w-[300px] leading-relaxed opacity-40">
                        Génération en cours ou lien indisponible
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        }
      </AnimatePresence >

      <AnimatePresence>
        {renderPresentationPlayer()}
      </AnimatePresence>
    </div >
  )
}
