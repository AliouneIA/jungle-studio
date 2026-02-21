'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Image as ImageIcon, Search, FileText, Globe, Code, ChevronRight, Zap, RefreshCw, Target, Check, MessageSquare, Settings, Play, Send, Mic, Paperclip, ChevronLeft, Trash2, Maximize2, Bot } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea'

interface GPTConfig {
  name: string
  description: string
  instructions: string
  idea: string
  objective: string
  constraints: string
  aiModel: string
  llmModel: 'gpt' | 'claude-opus' | 'claude-sonnet' | 'gemini' | 'grok'
  imageModel: 'nano-banana-pro' | 'grok'
  photo: string | null
  photoScale: number
  photoOffset: { x: number, y: number }
  files: File[]
  capabilities: {
    webSearch: boolean
    canvas: boolean
    imageGen: boolean
    codeInterpreter: boolean
  }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  suggestion?: {
    name?: string
    description?: string
    instructions?: string
    content?: string
    options?: string[]
  }
  status?: 'pending' | 'accepted'
}

interface GPTsCreatorProps {
  onBack?: () => void
  onDeploy?: () => void
  botId?: string
}

export default function GPTsCreator({ onBack, onDeploy, botId }: GPTsCreatorProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'create' | 'configure'>('create')

  // Unified State
  const [config, setConfig] = useState<GPTConfig>({
    name: '',
    description: '',
    instructions: '',
    idea: '',
    objective: '',
    constraints: '',
    aiModel: 'Gemini 3.0 Pro',
    llmModel: 'gemini',
    imageModel: 'nano-banana-pro',
    photo: null,
    photoScale: 1,
    photoOffset: { x: 0, y: 0 },
    files: [],
    capabilities: {
      webSearch: true,
      canvas: true,
      imageGen: true,
      codeInterpreter: false
    }
  })
  const [isEditMode, setIsEditMode] = useState(false)

  // Fix Bug 1: Tracker les Object URLs pour les révoquer
  const photoObjectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Cleanup Object URL au unmount
    return () => {
      if (photoObjectUrlRef.current) {
        URL.revokeObjectURL(photoObjectUrlRef.current)
        photoObjectUrlRef.current = null
      }
    }
  }, [])

  // Fetch bot data if botId is provided
  useEffect(() => {
    if (botId) {
      setIsEditMode(true)
      fetchBotData(botId)
    }
  }, [botId])

  // Fix Bug 7: Ajouter user_id au fetch
  const fetchBotData = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('gpts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Fix Bug 7
      .single()

    if (data && !error) {
      setConfig({
        name: data.name || '',
        description: data.description || '',
        instructions: data.instructions || '',
        idea: data.idea || '',
        objective: data.objective || '',
        constraints: data.constraints || '',
        aiModel: data.ai_model || 'Gemini 3.0 Pro',
        llmModel: (data.llm_model as any) || 'gemini',
        imageModel: (data.image_model as any) || 'nano-banana-pro',
        photo: data.photo_url || data.photo || null,
        photoScale: data.photo_zoom || 1,
        photoOffset: { x: data.photo_offset_x || 0, y: data.photo_offset_y || 0 },
        files: [],
        capabilities: data.capabilities || {
          webSearch: true,
          canvas: true,
          imageGen: true,
          codeInterpreter: false
        }
      })
      // Switch to configure tab if editing
      setActiveTab('configure')
    }
  }

  // Chat with Builder (Left Side)
  const [currentStep, setCurrentStep] = useState(0)
  const [builderPrompt, setBuilderPrompt] = useState('')
  const [builderChat, setBuilderChat] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Bonjour ! Je suis l'assistant de conception de Jungle Studio. Ensemble, nous allons créer votre GPT sur mesure.\n\nCommençons par le début : quel nom souhaitez-vous donner à votre GPT ?" }
  ])
  const [isBuilderTyping, setIsBuilderTyping] = useState(false)
  // Fix Bug 10: Ref pour auto-scroll builder chat
  const builderChatEndRef = useRef<HTMLDivElement>(null)

  // Chat with Preview (Right Side)
  const [previewPrompt, setPreviewPrompt] = useState('')
  const [previewChat, setPreviewChat] = useState<{ role: 'user' | 'assistant', content: string }[]>([])
  const [isPreviewTyping, setIsPreviewTyping] = useState(false)
  // Fix Bug 9: State pour fichiers attachés au preview chat
  const [previewFiles, setPreviewFiles] = useState<File[]>([])
  const previewFileInputRef = useRef<HTMLInputElement>(null)

  // Image Handling
  const [isResizing, setIsResizing] = useState(false)
  const [showGenMenu, setShowGenMenu] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const photoRef = useRef<HTMLDivElement>(null)

  // Voice Controls
  const [isListeningBuilder, setIsListeningBuilder] = useState(false)
  const [isListeningPreview, setIsListeningPreview] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const builderTextareaRef = useRef<HTMLTextAreaElement>(null)
  const previewTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isInstructionsExpanded, setIsInstructionsExpanded] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null) // Fix Bug 2: Track stream
  const audioChunksRef = useRef<Blob[]>([])
  const [sttModel, setSttModel] = useState<'whisper-1' | 'gpt-4o-transcribe'>('whisper-1')

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

  useAutoResizeTextarea(builderTextareaRef, builderPrompt)
  useAutoResizeTextarea(previewTextareaRef, previewPrompt)

  // Fix Bug 10: Auto-scroll builder chat quand de nouveaux messages arrivent
  useEffect(() => {
    builderChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [builderChat, isBuilderTyping])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setConfig(prev => ({ ...prev, files: [...prev.files, ...newFiles] }))
    }
  }

  // Fix Bug 9: Handler séparé pour les fichiers du preview
  const handlePreviewFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setPreviewFiles(prev => [...prev, ...newFiles])
    }
    // Reset l'input pour pouvoir re-sélectionner le même fichier
    if (e.target) e.target.value = ''
  }

  // Fix Bug 4: Stopper tout enregistrement en cours avant d'en démarrer un nouveau
  const cleanupRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }

  const startRecording = async (target: 'builder' | 'preview') => {
    // Fix Bug 4: Stopper l'enregistrement en cours s'il y en a un
    cleanupRecording()
    setIsListeningBuilder(false)
    setIsListeningPreview(false)

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream // Fix Bug 2: Tracker le stream

      // Fix Bug 2: Wrap dans try/catch séparé pour le constructeur
      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream)
      } catch (constructErr) {
        // Fix Bug 2: Si le constructeur échoue, cleanup le stream
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
        await handleTranscription(audioBlob, target)
        // Cleanup stream après stop
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      if (target === 'builder') setIsListeningBuilder(true)
      else setIsListeningPreview(true)
      setSpeechError(null)
    } catch (err: any) {
      console.error('Mic error:', err)
      // Fix Bug 2: Cleanup en cas d'erreur
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      streamRef.current = null
      setSpeechError("Impossible d'accéder au micro.")
    }
  }

  // Fix Bug 3: Vérifier le state avant d'appeler .stop()
  const stopRecording = (target: 'builder' | 'preview') => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (target === 'builder') setIsListeningBuilder(false)
    else setIsListeningPreview(false)
  }

  const handleTranscription = async (blob: Blob, target: 'builder' | 'preview') => {
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
        if (target === 'builder') {
          setBuilderPrompt(prev => prev ? `${prev} ${data.text}` : data.text)
        } else {
          setPreviewPrompt(prev => prev ? `${prev} ${data.text}` : data.text)
        }
      }
    } catch (err: any) {
      console.error('Transcription error:', err)
      setSpeechError("Erreur de transcription Whisper.")
    } finally {
      setIsTranscribing(false)
    }
  }

  const toggleListening = (target: 'builder' | 'preview') => {
    const isListening = target === 'builder' ? isListeningBuilder : isListeningPreview
    if (isListening) {
      stopRecording(target)
    } else {
      startRecording(target)
    }
  }

  const handleBuilderSubmit = (e?: React.FormEvent, directMsg?: string) => {
    e?.preventDefault()
    const msgToSubmit = directMsg || builderPrompt.trim()
    if (!msgToSubmit) return

    const userMsg = msgToSubmit
    const newChat = [...builderChat, { role: 'user' as const, content: userMsg }]
    setBuilderChat(newChat)
    setBuilderPrompt('')
    setIsBuilderTyping(true)

    setTimeout(() => {
      setIsBuilderTyping(false)
      let nextQuestion = ""
      let suggestion = null

      switch (currentStep) {
        case 0: // Name
          setConfig(prev => ({ ...prev, name: userMsg }))
          nextQuestion = `Parfait, "${userMsg}" est un excellent nom ! Quelle est l'idée principale de votre projet ?`
          setCurrentStep(1)
          break
        case 1: // Idea
          setConfig(prev => ({ ...prev, idea: userMsg }))
          nextQuestion = "C'est noté. Quel est l'objectif principal que vous souhaitez atteindre avec ce bot ?"
          setCurrentStep(2)
          break
        case 2: // Objective
          setConfig(prev => ({ ...prev, objective: userMsg }))
          nextQuestion = "Très bien. Pour l'image de profil, souhaitez-vous en charger une ou préférez-vous que j'en génère une avec Nano Banana Pro ?"
          suggestion = {
            content: "Choisissez une option :",
            options: ["En charger une", "En générer une"]
          }
          setCurrentStep(3)
          break
        case 3: // Image Choice
          if (userMsg.toLowerCase().includes('générer') || userMsg.toLowerCase().includes('créer')) {
            nextQuestion = "Entendu, je vais préparer une image avec Nano Banana Pro dès que nous aurons fini la configuration. Quelles sont les contraintes à respecter pour ce bot ?"
          } else {
            nextQuestion = "D'accord, vous pourrez en charger une dans l'onglet Configurer. Quelles sont les contraintes à respecter (style, ton, interdits, etc.) ?"
          }
          setCurrentStep(4)
          break
        case 4: // Constraints
          setConfig(prev => ({ ...prev, constraints: userMsg }))
          nextQuestion = "Nous y sommes presque ! Quel modèle d'IA souhaitez-vous comme base ? Gemini 3.0 Pro (Documents), GPT 5.2 (Rédaction), Claude 4.6 Opus (Créativité) ou Grok-3 Ultra (Puissance) ?"
          suggestion = {
            content: "Modèles disponibles :",
            options: ["Gemini 3.0 Pro", "GPT 5.2 Precision", "Claude 4.6 Opus", "Claude 4.5 Sonnet", "Grok-3 Ultra"]
          }
          setCurrentStep(5)
          break
        case 5: // AI Model
          let model = 'GPT 5.2'
          let llmKey: any = 'gpt'

          if (userMsg.toLowerCase().includes('gemini')) {
            model = 'Gemini 3.0 Pro'
            llmKey = 'gemini'
          } else if (userMsg.toLowerCase().includes('opus')) {
            model = 'Claude 4.6 Opus'
            llmKey = 'claude-opus'
          } else if (userMsg.toLowerCase().includes('sonnet')) {
            model = 'Claude 4.5 Sonnet'
            llmKey = 'claude-sonnet'
          } else if (userMsg.toLowerCase().includes('grok')) {
            model = 'Grok-3 Ultra'
            llmKey = 'grok'
          }

          // Fix Bug 6: Utiliser `prev` au lieu de `config` (stale closure)
          setConfig(prev => ({
            ...prev,
            aiModel: model,
            llmModel: llmKey,
            instructions: `Tu es ${prev.name}. Ton idée est : ${prev.idea}.\nObjectif : ${prev.objective}.\nContraintes à respecter : ${prev.constraints}.\nUtilise le modèle : ${model}`
          }))
          // Fix Bug 6: Pour le message, on utilise aussi prev via un callback
          setConfig(prev => {
            nextQuestion = `Génial ! Votre GPT "${prev.name}" est maintenant prêt. Vous pouvez passer à l'onglet "Configurer" pour affiner les détails ou le tester directement dans l'aperçu.`
            return prev
          })
          setCurrentStep(6)
          break
        default:
          nextQuestion = "Votre GPT est prêt ! Souhaitez-vous modifier quelque chose ou passer au déploiement ?"
      }

      setBuilderChat([...newChat, {
        role: 'assistant',
        content: nextQuestion,
        suggestion: suggestion as any
      }])
      if (builderTextareaRef.current) {
        builderTextareaRef.current.style.height = '44px';
      }
    }, 1000)
  }

  const handleAcceptSuggestion = (idx: number, suggestion: any) => {
    setConfig(prev => ({
      ...prev,
      name: suggestion.name || prev.name,
      description: suggestion.description || prev.description,
      instructions: suggestion.instructions || prev.instructions
    }))

    setBuilderChat(prev => prev.map((msg, i) =>
      i === idx ? { ...msg, status: 'accepted' as const } : msg
    ))
  }

  // Fix Bug 5: Ajouter user_id au update
  const handleDeploy = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error("Utilisateur non authentifié")

      const botData = {
        user_id: user.id,
        name: config.name,
        description: config.description,
        instructions: config.instructions,
        llm_model: config.llmModel,
        image_model: config.imageModel,
        photo: config.photo,
        photo_url: config.photo,
        photo_zoom: config.photoScale,
        photo_offset_x: config.photoOffset.x,
        photo_offset_y: config.photoOffset.y,
        model_slug: config.llmModel === 'gpt' ? 'gpt-5.2-precision' : config.llmModel === 'gemini' ? 'gemini-3.0-pro' : config.llmModel === 'claude-opus' ? 'claude-4.6-opus' : config.llmModel === 'claude-sonnet' ? 'claude-4.5-sonnet' : 'grok-3-ultra',
        idea: config.idea,
        objective: config.objective,
        constraints: config.constraints,
        capabilities: config.capabilities,
        updated_at: new Date().toISOString()
      }

      if (isEditMode && botId) {
        const { error } = await supabase
          .from('gpts')
          .update(botData)
          .eq('id', botId)
          .eq('user_id', user.id) // Fix Bug 5
        if (error) throw error
        alert("GPT mis à jour avec succès !")
      } else {
        const { error } = await supabase
          .from('gpts')
          .insert(botData)
        if (error) throw error
        alert("GPT déployé avec succès !")
      }

      if (onDeploy) onDeploy()
    } catch (err: any) {
      console.error('Deployment error:', err)
      alert('Erreur lors du déploiement : ' + err.message)
    }
  }

  // Fix Bug 8: Extraire la logique de génération d'image dans une fonction
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return
    setIsGeneratingImage(true)
    setShowGenMenu(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const modelSlug = config.imageModel === 'grok'
        ? 'grok-imagine-pro'
        : 'gemini-3-pro-image-preview'

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fusion-run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            prompt: imagePrompt,
            fusion_mode: 'image',
            master_model_slug: modelSlug,
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
        setConfig(p => ({ ...p, photo: imgUrl, photoScale: 1, photoOffset: { x: 0, y: 0 } }))
      } else {
        throw new Error('Aucune image générée')
      }
    } catch (err) {
      console.error('Image generation error:', err)
      alert('Erreur lors de la génération : ' + (err as Error).message)
    } finally {
      setIsGeneratingImage(false)
      setImagePrompt('')
    }
  }

  // Fix Bug 9: Preview submit avec support fichiers réel
  const handlePreviewSubmit = async () => {
    if ((!previewPrompt.trim() && previewFiles.length === 0) || isPreviewTyping) return

    let userContent = previewPrompt.trim()
    const filesToSend = [...previewFiles]

    // Upload les fichiers et ajouter les liens au message
    if (filesToSend.length > 0) {
      try {
        const uploadPromises = filesToSend.map(async (file) => {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `gpts-preview/${fileName}`

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
        userContent += fileLinks
      } catch (err: any) {
        console.error("Upload error:", err)
        alert("Erreur lors de l'upload : " + err.message)
        return
      }
    }

    if (!userContent) return

    const currentChat: { role: 'user' | 'assistant', content: string }[] = [...previewChat, { role: 'user' as const, content: userContent }]
    setPreviewChat(currentChat)
    setPreviewPrompt('')
    setPreviewFiles([]) // Clear les fichiers après envoi
    setIsPreviewTyping(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const modelMap: Record<string, string> = {
        'gpt': 'gpt-5.2-pro',
        'claude-opus': 'claude-opus-4.6',
        'claude-sonnet': 'claude-sonnet-4.5',
        'gemini': 'gemini-3.0-pro',
        'grok': 'grok-3-ultra'
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/fusion-run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            prompt: userContent,
            fusion_mode: 'solo',
            master_model_slug: modelMap[config.llmModel] || 'gpt-5.2-pro',
            custom_instructions: config.instructions || `Tu es ${config.name}. Agis selon les contraintes : ${config.constraints}`,
          })
        }
      )

      const result = await response.json()
      if (result.error) throw new Error(result.error)

      setPreviewChat([...currentChat, {
        role: 'assistant' as const,
        content: result.fusion || "Désolé, je n'ai pas pu générer de réponse."
      }])
    } catch (err) {
      console.error('Preview chat error:', err)
      setPreviewChat([...currentChat, {
        role: 'assistant' as const,
        content: "⚠️ Connexion interrompue. Vérifiez vos réglages ou votre session."
      }])
    } finally {
      setIsPreviewTyping(false)
      if (previewTextareaRef.current) {
        previewTextareaRef.current.style.height = '48px';
      }
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#EAE1D3] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#5C4B40]/10 bg-white/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-[#5C4B40] hover:opacity-60 transition-all group"
              >
                <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Retour</span>
              </button>
              <span className="w-1 h-3 rounded-full bg-slate-300/50" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                  {config.name || "Nouveau GPT"}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Brouillon</span>
              </div>
            </div>
            <p className="text-[9px] text-[#5C4B40]/40 font-bold uppercase tracking-tight mt-1 ml-1">
              {config.llmModel === 'gpt' ? 'GPT-5.2 Precision' : config.llmModel === 'gemini' ? 'Gemini 3.0 Pro' : config.llmModel === 'claude-opus' ? 'Claude 4.6 Opus' : config.llmModel === 'claude-sonnet' ? 'Claude 4.5 Sonnet' : 'Grok-3 Ultra'}
            </p>
          </div>
        </div>
        <button
          onClick={handleDeploy}
          className="px-6 py-2 bg-[#5C4B40] text-[#F8F6F2] rounded-full text-xs font-bold hover:scale-105 transition-all shadow-lg"
        >
          Déployer
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Builder & Config */}
        <div className="w-1/2 flex flex-col border-r border-[#5C4B40]/10 bg-white/40 overflow-hidden relative">
          {/* Internal Tabs */}
          <div className="flex justify-center py-4 bg-transparent">
            <div className="flex bg-[#EAE1D3]/50 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('create')}
                className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-white shadow-md text-[#5C4B40]' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
              >
                Créer
              </button>
              <button
                onClick={() => setActiveTab('configure')}
                className={`px-8 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'configure' ? 'bg-white shadow-md text-[#5C4B40]' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
              >
                Configurer
              </button>
            </div>
          </div>

          {activeTab === 'create' ? (
            /* Builder Chat View */
            <div className="flex-1 flex flex-col overflow-hidden px-8">
              <div className="flex-1 overflow-y-auto pt-4 pb-32 no-scrollbar space-y-6">
                {builderChat.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] text-sm rounded-2xl p-4 ${msg.role === 'user' ? 'bg-[#5C4B40] text-white' : 'bg-white border border-[#5C4B40]/5 text-[#5C4B40]/80 shadow-sm'}`}>
                      {msg.content}

                      {msg.suggestion && (
                        <div className="mt-4 pt-4 border-t border-[#5C4B40]/10 space-y-3">
                          {msg.suggestion.content && (
                            <p className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest mb-1">{msg.suggestion.content}</p>
                          )}

                          {msg.suggestion.options && (
                            <div className="flex flex-wrap gap-2">
                              {msg.suggestion.options.map((option, oIdx) => (
                                <button
                                  key={oIdx}
                                  onClick={() => handleBuilderSubmit(undefined, option)}
                                  className="px-3 py-1.5 bg-[#F8F6F2] hover:bg-[#EAE1D3] border border-[#5C4B40]/10 rounded-lg text-[10px] font-bold text-[#5C4B40] transition-colors"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}

                          {msg.suggestion.name && (
                            <div className="bg-[#F8F6F2] p-3 rounded-xl border border-[#5C4B40]/5">
                              <p className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest mb-1">Proposition Configuration</p>
                              <div className="space-y-1">
                                <p className="font-bold text-[#5C4B40]">{msg.suggestion.name}</p>
                                <p className="text-[10px] text-[#5C4B40]/60 italic line-clamp-2">{msg.suggestion.description}</p>
                              </div>
                            </div>
                          )}

                          {msg.status === 'pending' && msg.suggestion.name && (
                            <button
                              onClick={() => handleAcceptSuggestion(idx, msg.suggestion)}
                              className="w-full py-2 bg-[#5C4B40] text-white rounded-xl text-xs font-bold hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                              <Check size={14} />
                              Valider & Configurer
                            </button>
                          )}
                          {msg.status === 'accepted' && (
                            <div className="w-full py-2 bg-green-500/10 text-green-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-green-500/20">
                              <Check size={14} />
                              Configuré avec succès
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isBuilderTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-[#5C4B40]/5 p-4 rounded-2xl shadow-sm flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#5C4B40]/20 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-[#5C4B40]/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-[#5C4B40]/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                {/* Fix Bug 10: Ref pour auto-scroll */}
                <div ref={builderChatEndRef} />
              </div>
              {/* Chat Input Left */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white to-transparent">
                <form onSubmit={handleBuilderSubmit} className="relative group">
                  <div className="relative group w-full flex items-end gap-2 bg-[#EAE1D3]/5 border border-[#5C4B40]/10 rounded-2xl p-1.5 focus-within:bg-[#EAE1D3]/5 focus-within:border-[#5C4B40]/20 transition-all">
                    <button
                      type="button"
                      className="p-3 text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-xl transition-all"
                      title="Attacher un fichier"
                    >
                      <Plus size={18} />
                    </button>
                    <textarea
                      ref={builderTextareaRef}
                      placeholder="Décrivez votre projet..."
                      rows={1}
                      className="flex-1 bg-transparent border-none focus:ring-0 p-3 text-sm text-[#5C4B40] placeholder-[#5C4B40]/30 resize-none font-mono min-h-[44px] max-h-[200px] no-scrollbar"
                      value={builderPrompt}
                      onChange={(e) => setBuilderPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleBuilderSubmit()
                        }
                      }}
                    />
                    <div className="flex items-center gap-1.5 p-1">
                      <button
                        type="button"
                        onClick={() => toggleListening('builder')}
                        className={`p-2 transition-all rounded-lg ${isListeningBuilder ? 'text-red-500 bg-red-50 animate-pulse scale-110 shadow-lg' : 'text-[#5C4B40]/30 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5'}`}
                        title={isListeningBuilder ? "Arrêter l'écoute" : "Transcription Vocale"}
                      >
                        <Mic size={18} />
                      </button>
                      <button
                        type="submit"
                        disabled={!builderPrompt.trim() || isBuilderTyping}
                        className="p-2.5 bg-[#5C4B40] text-[#EAE1D3] rounded-xl hover:bg-[#4A3D34] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5C4B40]/10 active:scale-95"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </form>
                {speechError && (
                  <div className="mt-2 px-3 py-1 text-[10px] text-red-500 font-bold uppercase tracking-tighter bg-red-50 rounded-lg border border-red-100 italic">
                    ⚠️ Erreur micro: {speechError}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Manual Configuration View */
            <div className="flex-1 overflow-y-auto p-8 no-scrollbar pb-20">
              <div className="max-w-xl mx-auto space-y-8">
                {/* Photo & Cropper */}
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="w-32 h-32 rounded-3xl bg-white shadow-xl border border-[#5C4B40]/5 overflow-hidden relative group"
                  >
                    {config.photo ? (
                      <div className="w-full h-full relative overflow-hidden">
                        <img
                          src={config.photo}
                          alt=""
                          onError={() => setConfig(p => ({ ...p, photo: null }))}
                          className="absolute transition-transform duration-75 cursor-move"
                          style={{
                            transform: `translate(${config.photoOffset.x}px, ${config.photoOffset.y}px) scale(${config.photoScale})`,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        {/* Controls */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/5 pointer-events-none">
                          <div className="flex gap-1 pointer-events-auto mt-auto mb-2">
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoScale: p.photoScale + 0.1 })) }} className="p-1.5 bg-white shadow-lg rounded-full text-[#5C4B40] hover:scale-110 transition-transform"><Plus size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoScale: Math.max(0.1, p.photoScale - 0.1) })) }} className="p-1.5 bg-white shadow-lg rounded-full text-[#5C4B40] hover:scale-110 transition-transform"><X size={12} /></button>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pointer-events-auto scale-75 mb-4">
                            <div />
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoOffset: { ...p.photoOffset, y: p.photoOffset.y - 10 } })) }} className="p-1.5 bg-white/90 shadow-sm rounded-lg text-[#5C4B40] flex items-center justify-center"><ChevronRight size={12} className="-rotate-90" /></button>
                            <div />
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoOffset: { ...p.photoOffset, x: p.photoOffset.x - 10 } })) }} className="p-1.5 bg-white/90 shadow-sm rounded-lg text-[#5C4B40] flex items-center justify-center"><ChevronLeft size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoOffset: { x: 0, y: 0 } })) }} className="p-1.5 bg-white/90 shadow-sm rounded-lg text-[#5C4B40] flex items-center justify-center text-[8px] font-bold">R</button>
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoOffset: { ...p.photoOffset, x: p.photoOffset.x + 10 } })) }} className="p-1.5 bg-white/90 shadow-sm rounded-lg text-[#5C4B40] flex items-center justify-center"><ChevronRight size={12} /></button>
                            <div />
                            <button onClick={(e) => { e.stopPropagation(); setConfig(p => ({ ...p, photoOffset: { ...p.photoOffset, y: p.photoOffset.y + 10 } })) }} className="p-1.5 bg-white/90 shadow-sm rounded-lg text-[#5C4B40] flex items-center justify-center"><ChevronRight size={12} className="rotate-90" /></button>
                            <div />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              // Fix Bug 1: Révoquer l'Object URL si c'en est un
                              if (photoObjectUrlRef.current) {
                                URL.revokeObjectURL(photoObjectUrlRef.current)
                                photoObjectUrlRef.current = null
                              }
                              setConfig(p => ({ ...p, photo: null }))
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white shadow-lg rounded-full hover:scale-110 transition-transform pointer-events-auto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ) : isGeneratingImage ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#EAE1D3]/20 animate-pulse">
                        <RefreshCw size={24} className="text-[#5C4B40]/30 animate-spin" />
                        <span className="text-[8px] font-bold mt-2 text-[#5C4B40]/40 uppercase tracking-widest">IA en création...</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#5C4B40]/20 bg-gradient-to-br from-white to-[#EAE1D3]/20">
                        <ImageIcon size={32} />
                        <span className="text-[10px] font-bold mt-2 text-center px-4 uppercase tracking-tighter">Icône du Bot</span>
                        <span className="text-[8px] font-medium opacity-50">Cliquer ou Générer</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      disabled={!!config.photo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        if (file.size > 2 * 1024 * 1024) { alert('Image trop lourde (max 2 Mo)'); return }

                        // Fix Bug 1: Révoquer l'ancienne URL avant d'en créer une nouvelle
                        if (photoObjectUrlRef.current) {
                          URL.revokeObjectURL(photoObjectUrlRef.current)
                        }
                        const objectUrl = URL.createObjectURL(file)
                        photoObjectUrlRef.current = objectUrl

                        setConfig(prev => ({ ...prev, photo: objectUrl, photoScale: 1, photoOffset: { x: 0, y: 0 } }))
                      }}
                    />
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowGenMenu(!showGenMenu)}
                      className="px-4 py-2 bg-[#5C4B40] text-[#F8F6F2] rounded-full text-[10px] font-bold uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-2 shadow-md"
                    >
                      <Bot size={14} />
                      Générer avec l'IA
                      <ChevronRight size={14} className={`transition-transform ${showGenMenu ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showGenMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[#5C4B40]/10 p-4 z-[100]"
                        >
                          <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest text-center">Inspiration Conceptuelle</p>
                            <input
                              type="text"
                              autoFocus
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              placeholder="Ex: Un lion en costume..."
                              className="w-full bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#5C4B40]/30 transition-all font-medium text-[#5C4B40]"
                              onKeyDown={(e) => {
                                // Fix Bug 8: Appeler directement la fonction au lieu de document.getElementById
                                if (e.key === 'Enter' && imagePrompt.trim()) {
                                  e.preventDefault()
                                  handleGenerateImage()
                                }
                              }}
                            />
                            <button
                              onClick={handleGenerateImage}
                              className="w-full py-2 bg-[#5C4B40] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                            >
                              <Zap size={10} />
                              Créer avec {config.imageModel === 'nano-banana-pro' ? 'Nano Banana Pro' : 'Grok'}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-[10px] font-bold text-[#5C4B40]/40 uppercase tracking-widest">Icône & Recadrage</span>
                </div>

                {/* Forms */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Nom</label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => setConfig(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none"
                      placeholder="Nom de votre bot..."
                    />
                  </div>
                  {/* Modèles Selection */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#5C4B40]/5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Modèle de Réponse (LLM)</label>
                      <select
                        value={config.llmModel}
                        onChange={(e) => setConfig(p => ({ ...p, llmModel: e.target.value as any }))}
                        className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none appearance-none cursor-pointer"
                      >
                        <option value="gemini">Gemini 3.0 Pro</option>
                        <option value="gpt">GPT-5.2 Precision</option>
                        <option value="claude-opus">Claude 4.6 Opus</option>
                        <option value="claude-sonnet">Claude 4.5 Sonnet</option>
                        <option value="grok">Grok-3 Ultra (Dernière version)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Générateur d'Images</label>
                      <select
                        value={config.imageModel}
                        onChange={(e) => setConfig(p => ({ ...p, imageModel: e.target.value as any }))}
                        className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none appearance-none cursor-pointer"
                      >
                        <option value="nano-banana-pro">Nano Banana Pro</option>
                        <option value="grok">Grok Image</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Idée du Projet</label>
                    <input
                      type="text"
                      value={config.idea}
                      onChange={(e) => setConfig(p => ({ ...p, idea: e.target.value }))}
                      className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none"
                      placeholder="L'idée principale..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Objectif</label>
                    <input
                      type="text"
                      value={config.objective}
                      onChange={(e) => setConfig(p => ({ ...p, objective: e.target.value }))}
                      className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none"
                      placeholder="L'objectif à atteindre..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Description</label>
                    <input
                      type="text"
                      value={config.description}
                      onChange={(e) => setConfig(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none"
                      placeholder="Résumé court..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Instructions Personnalisées</label>
                    <div className="relative group/instr">
                      <textarea
                        rows={5}
                        value={config.instructions}
                        onChange={(e) => setConfig(p => ({ ...p, instructions: e.target.value }))}
                        className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-2xl px-4 py-4 text-sm focus:bg-white transition-all outline-none resize-none leading-relaxed no-scrollbar"
                        placeholder="Comment ce bot doit-il se comporter ?"
                      />
                      <button
                        type="button"
                        onClick={() => setIsInstructionsExpanded(true)}
                        className="absolute bottom-3 right-3 p-2.5 bg-white/80 backdrop-blur-md rounded-xl text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-white shadow-sm border border-[#5C4B40]/5 transition-all opacity-0 group-hover/instr:opacity-100 active:scale-95"
                        title="Agrandir les instructions"
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Contraintes</label>
                    <textarea
                      rows={3}
                      value={config.constraints}
                      onChange={(e) => setConfig(p => ({ ...p, constraints: e.target.value }))}
                      className="w-full bg-white/50 border border-[#5C4B40]/10 rounded-xl px-4 py-3 text-sm focus:bg-white transition-all outline-none resize-none"
                      placeholder="Style, ton, limites..."
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-[#5C4B40]/5">
                    <label className="text-[10px] font-black uppercase text-[#5C4B40]/40 tracking-widest">Base de Connaissances</label>
                    <div className="flex flex-wrap gap-2">
                      {config.files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#5C4B40]/5 text-xs text-[#5C4B40]">
                          <FileText size={14} />
                          <span className="truncate max-w-[120px]">{file.name}</span>
                          <button onClick={() => setConfig(p => ({ ...p, files: p.files.filter((_, i) => i !== idx) }))}><X size={12} /></button>
                        </div>
                      ))}
                      <label className="flex items-center gap-2 px-4 py-2 bg-[#EAE1D3]/30 hover:bg-[#EAE1D3] border border-[#5C4B40]/5 rounded-lg text-xs font-bold text-[#5C4B40] transition-colors cursor-pointer">
                        <Paperclip size={14} />
                        Charger des fichiers
                        <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Preview Chat */}
        <div className="w-1/2 flex flex-col bg-[#F8F6F2] relative overflow-hidden">
          {/* Preview Navigation */}
          <div className="flex items-center justify-between px-8 py-4 bg-transparent shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#5C4B40]">Aperçu</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setPreviewChat([])
                  setPreviewPrompt('')
                  setPreviewFiles([])
                  setIsPreviewTyping(false)
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#EAE1D3]/50 hover:bg-[#EAE1D3] text-[#5C4B40]/60 hover:text-[#5C4B40] rounded-full transition-all text-[10px] font-bold border border-[#5C4B40]/5 group"
                title="Réinitialiser la conversation pour tester les nouvelles instructions"
              >
                <RefreshCw size={10} className="group-hover:rotate-180 transition-transform duration-500" />
                Actualiser l'aperçu
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white/80 p-1 px-3 rounded-lg border border-[#5C4B40]/5">
              <span className="text-[10px] font-black text-[#5C4B40]/60 uppercase tracking-tighter">{config.llmModel === 'gpt' ? 'GPT-5.2' : config.llmModel === 'gemini' ? 'Gemini 3.0' : config.llmModel === 'claude-opus' ? 'Claude 4.6' : config.llmModel === 'claude-sonnet' ? 'Claude 4.5' : 'Grok-3'}</span>
              <ChevronRight size={12} className="text-[#5C4B40]/30" />
            </div>
          </div>

          <div className={`flex-1 flex flex-col items-center ${previewChat.length === 0 ? 'justify-center' : 'justify-start'} px-12 pb-32 overflow-y-auto no-scrollbar`}>
            {previewChat.length === 0 ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mx-auto border border-[#5C4B40]/10 overflow-hidden">
                  {config.photo ? <img src={config.photo} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} className="w-full h-full object-cover" /> : <Bot size={40} className="text-[#5C4B40]/10" />}
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[#5C4B40]">{config.name || 'Nouveau Bot'}</h2>
                  <p className="text-sm text-[#5C4B40]/40">{config.description || 'Démarrez l\'aperçu pour tester vos instructions.'}</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-xl space-y-6 pt-10">
                {previewChat.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl ${msg.role === 'user' ? 'bg-[#5C4B40] text-white shadow-[0_10px_20px_-5px_rgba(92,75,64,0.3)]' : 'bg-white border border-[#5C4B40]/10 text-[#5C4B40]/80 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)]'}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {isPreviewTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-[#5C4B40]/5 p-3 rounded-2xl shadow-sm flex gap-1 items-center">
                      <span className="w-1 h-1 bg-[#5C4B40]/20 rounded-full animate-bounce" />
                      <span className="w-1 h-1 bg-[#5C4B40]/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1 h-1 bg-[#5C4B40]/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                      <span className="text-[8px] font-bold text-[#5C4B40]/40 uppercase ml-1">En réflexion...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preview Input Right */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#F8F6F2] to-transparent">
            <div className="relative max-w-xl mx-auto">
              {/* Fix Bug 9: Afficher les fichiers en attente d'envoi */}
              {previewFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5 px-3">
                  {previewFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-[#5C4B40]/10 text-[10px] font-bold text-[#5C4B40]">
                      <FileText size={10} />
                      <span className="truncate max-w-[100px]">{file.name}</span>
                      <button
                        onClick={() => setPreviewFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 flex items-end gap-2 bg-white/80 backdrop-blur-md rounded-2xl border border-[#5C4B40]/10 shadow-2xl focus-within:border-[#5C4B40]/20 transition-all">
                {/* Fix Bug 9: Input fichier séparé pour le preview */}
                <input
                  ref={previewFileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.json,.md"
                  onChange={handlePreviewFileUpload}
                />
                <button
                  type="button"
                  onClick={() => previewFileInputRef.current?.click()}
                  className="p-2.5 text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-xl transition-all"
                  title="Attacher un fichier au message"
                >
                  <Paperclip size={18} />
                </button>
                <textarea
                  ref={previewTextareaRef}
                  rows={1}
                  value={previewPrompt}
                  onChange={(e) => setPreviewPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handlePreviewSubmit()
                    }
                  }}
                  placeholder="Tester le bot en direct..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-[#5C4B40] placeholder-[#5C4B40]/30 resize-none py-2.5 font-mono no-scrollbar min-h-[48px] max-h-[200px]"
                />
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => toggleListening('preview')}
                    className={`p-2 transition-all rounded-lg ${isListeningPreview ? 'text-red-500 bg-red-50 animate-pulse scale-110 shadow-lg' : 'text-[#5C4B40]/30 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5'}`}
                    title={isListeningPreview ? "Arrêter l'écoute" : "Transcription Vocale"}
                  >
                    <Mic size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewSubmit}
                    disabled={(!previewPrompt.trim() && previewFiles.length === 0) || isPreviewTyping}
                    className="p-2.5 bg-[#5C4B40] text-white rounded-xl hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#5C4B40]/10 active:scale-95"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
              {speechError && (
                <div className="mt-2 px-3 py-1 text-[10px] text-red-500 font-bold uppercase tracking-tighter bg-red-50/50 backdrop-blur-sm rounded-lg border border-red-100 italic">
                  ⚠️ Erreur micro: {speechError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isInstructionsExpanded && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInstructionsExpanded(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-[32px] w-full max-w-5xl h-[85vh] shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-10 py-8 border-b border-[#5C4B40]/5 bg-white/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#5C4B40] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#5C4B40]/20">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#5C4B40]">Instructions Personnalisées</h2>
                    <p className="text-xs text-[#5C4B40]/40 font-medium uppercase tracking-widest mt-1">Édition Avancée Studio</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInstructionsExpanded(false)}
                  className="p-3 bg-white border border-[#5C4B40]/10 rounded-2xl text-[#5C4B40]/40 hover:text-[#5C4B40] transition-all shadow-sm hover:shadow-md active:scale-95"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Text Area */}
              <div className="flex-1 p-10 bg-gradient-to-b from-white/30 to-transparent overflow-hidden">
                <textarea
                  value={config.instructions}
                  onChange={(e) => setConfig(p => ({ ...p, instructions: e.target.value }))}
                  className="w-full h-full bg-transparent text-xl text-[#5C4B40] placeholder-[#5C4B40]/20 outline-none resize-none leading-relaxed font-light no-scrollbar"
                  placeholder="Détaillez ici le comportement, le ton et les connaissances spécifiques de votre bot..."
                  autoFocus
                />
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-6 bg-[#EAE1D3]/20 border-t border-[#5C4B40]/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-[#5C4B40]/40 uppercase tracking-widest">Enregistrement automatique activé</span>
                </div>
                <button
                  onClick={() => setIsInstructionsExpanded(false)}
                  className="px-10 py-4 bg-[#5C4B40] text-[#EAE1D3] rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Terminer l'édition
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
