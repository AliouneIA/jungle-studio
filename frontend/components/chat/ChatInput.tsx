// cspell:disable
'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Send, Image as ImageIcon, Sparkles, Brain, Search, X, ChevronDown, ChevronUp, Zap, ZapOff, Sparkle, Command, Plus, SquarePen, Briefcase, Star, Heart, Cloud, Code, Settings, Search as SearchIcon, Volume2, Loader2, Flame, Crown, FileText, FileUp, Video, Mail, Calendar, HardDrive, Globe, MoreVertical } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { FusionMode } from '@/hooks/useFusionEngine'
import { ResearchConfigPanel } from '../research/ResearchConfigPanel'

import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea'

// Types
export type ModelOption = {
    id: string
    name: string
    provider: 'openai' | 'anthropic' | 'google' | 'xai'
    icon: React.ReactNode
    variants?: ModelOption[]
}

const ModelIcon = ({ src, fallback, className }: { src?: string, fallback: string, className?: string }) => {
    const [error, setError] = useState(false)

    if (src && !error) {
        return (
            <img
                src={src}
                alt=""
                className={`w-5 h-5 object-contain rounded-md transition-opacity ${className || ''}`}
                onError={() => setError(true)}
            />
        )
    }

    return <span className="text-sm">{fallback}</span>
}

export const AVAILABLE_MODELS: ModelOption[] = [
    {
        id: 'nano-banana-pro',
        name: 'Nano Banana Pro',
        provider: 'google',
        icon: <ModelIcon src="/banana.png" fallback="🍌" className="scale-110" />,
    },
    {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        provider: 'openai',
        icon: <ModelIcon src="/gpt 1.png" fallback="🟢" />,
        variants: [
            { id: 'gpt-5.2-pro', name: 'GPT 5.2 Pro', provider: 'openai', icon: <ModelIcon src="/gpt 1.png" fallback="💎" /> },
            { id: 'gpt-5.2-instant', name: 'GPT 5.2 Instant', provider: 'openai', icon: <ModelIcon src="/gpt 1.png" fallback="⚡" /> }
        ]
    },
    {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        provider: 'anthropic',
        icon: <ModelIcon src="/claude 2.jpg" fallback="🟣" />,
        variants: [
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', icon: <ModelIcon src="/claude 2.jpg" fallback="🎭" /> },
            { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', icon: <ModelIcon src="/claude 2.jpg" fallback="⚡" /> }
        ]
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        provider: 'google',
        icon: <ModelIcon src="/gemini.png" fallback="🔵" className="scale-125" />,
        variants: [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'google', icon: <ModelIcon src="/gemini.png" fallback="⚡" className="scale-125" /> }
        ]
    },
    {
        id: 'grok-4-2',
        name: 'Grok 4.2',
        provider: 'xai',
        icon: <ModelIcon src="/logos/Grok-Logo-PNG.png" fallback="🦊" className="scale-125" />,
        variants: [
            { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast (Code)', provider: 'xai', icon: <ModelIcon src="/logos/Grok-Logo-PNG.png" fallback="💻" className="scale-125" /> }
        ]
    },
]

export const MASTER_MODELS = [
    { id: 'gpt-5.2', name: 'GPT-5.2', icon: <ModelIcon src="/gpt 1.png" fallback="🧠" /> },
    { id: 'claude-opus-4-6', name: 'Claude Opus', icon: <ModelIcon src="/claude 2.jpg" fallback="🎭" /> },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', icon: <ModelIcon src="/gemini.png" fallback="✨" /> },
]

interface ChatInputProps {
    prompt: string
    setPrompt: React.Dispatch<React.SetStateAction<string>>
    onSubmit: (files?: File[]) => void
    disabled?: boolean
    fusionEnabled: boolean
    onFusionToggle: () => void
    fusionMode: FusionMode
    onFusionModeChange: (mode: FusionMode) => void
    masterModel: string
    onMasterModelChange: (modelId: string) => void
    selectedModel: string
    onModelChange: (modelId: string) => void
    onToolSelect?: (tool: string) => void
    onVoiceStart?: () => void
    searchQuery?: string
    onSearchChange?: (value: string) => void
    isSearchOpen?: boolean
    onToggleSearch?: () => void
    isImageMode?: boolean
    isManusMode?: boolean
    imageCount?: number
    onImageCountChange?: (count: number) => void
    isThinking?: boolean
    onStop?: () => void
    statusText?: string
    onHoverModeChange?: (mode: FusionMode | null) => void
    webVerifyEnabled?: boolean
    onToggleWebVerify?: () => void
    isResearchMode?: boolean
    researchConfig?: any
    onResearchConfigChange?: (config: any) => void
}

export const IMAGE_MODELS: ModelOption[] = [
    { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', provider: 'google', icon: <ModelIcon src="/gemini.png" fallback="🍌" className="scale-125" /> },
    { id: 'grok-imagine-pro', name: 'Grok Imagine Pro', provider: 'xai', icon: <ModelIcon src="/logos/Grok-Logo-PNG.png" fallback="🦊" className="scale-125" /> },
]

export default function ChatInput({
    prompt,
    setPrompt,
    onSubmit,
    disabled = false,
    fusionEnabled,
    onFusionToggle,
    fusionMode,
    onFusionModeChange,
    masterModel,
    onMasterModelChange,
    selectedModel,
    onModelChange,
    onToolSelect,
    onVoiceStart,
    searchQuery = '',
    onSearchChange,
    isSearchOpen = false,
    onToggleSearch,
    isImageMode = false,
    isManusMode = false,
    imageCount = 1,
    onImageCountChange,
    isThinking = false,
    onStop,
    statusText = 'Raisonnement en cours...',
    onHoverModeChange,
    webVerifyEnabled = false,
    onToggleWebVerify,
    isResearchMode = false,
    researchConfig,
    onResearchConfigChange
}: ChatInputProps) {
    const [hoveredMode, setHoveredMode] = useState<string | null>(null)
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [showToolsMenu, setShowToolsMenu] = useState(false)
    const [showResearchConfig, setShowResearchConfig] = useState(false)
    const [showMasterDropdown, setShowMasterDropdown] = useState(false)
    const [showPlusMenu, setShowPlusMenu] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [connectingService, setConnectingService] = useState<string | null>(null)
    const [isListening, setIsListening] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [speechError, setSpeechError] = useState<string | null>(null)
    const [expandedModel, setExpandedModel] = useState<string | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const streamRef = useRef<MediaStream | null>(null)
    const supabase = createClient()
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

    useAutoResizeTextarea(textareaRef, prompt)

    // Fix Bug 1: Mémoriser les preview URLs et les révoquer au cleanup
    const filePreviewUrls = useMemo(() => {
        return selectedFiles.map((file: File) =>
            file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        )
    }, [selectedFiles])

    useEffect(() => {
        return () => {
            filePreviewUrls.forEach((url: string | null) => { if (url) URL.revokeObjectURL(url) })
        }
    }, [filePreviewUrls])

    const currentModels = isImageMode ? IMAGE_MODELS : AVAILABLE_MODELS
    const allSoloModels = isImageMode ? IMAGE_MODELS : [...AVAILABLE_MODELS, ...AVAILABLE_MODELS.flatMap(m => m.variants || [])]
    const currentModel = allSoloModels.find(m => m.id === selectedModel) ||
        AVAILABLE_MODELS.find(m => m.variants?.some(v => v.id === selectedModel))?.variants?.find(v => v.id === selectedModel) ||
        currentModels[0]
    const currentMaster = MASTER_MODELS.find(m => m.id === masterModel) || MASTER_MODELS[0]

    const modelMenuRef = useRef<HTMLDivElement>(null)
    const masterMenuRef = useRef<HTMLDivElement>(null)
    const toolsMenuRef = useRef<HTMLDivElement>(null)
    const plusMenuRef = useRef<HTMLDivElement>(null)

    // Fix Bug 2: Stream cleanup on error + ref tracking
    const startRecording = async () => {
        let stream: MediaStream | null = null
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data)
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop())
                streamRef.current = null
                await handleTranscription(audioBlob)
            }

            mediaRecorder.start()
            setIsListening(true)
            setSpeechError(null)
        } catch (err: any) {
            console.error('Mic error:', err)
            stream?.getTracks().forEach(track => track.stop())
            streamRef.current = null
            setSpeechError("Impossible d'accéder au micro.")
        }
    }

    // Fix Bug 3: Vérifier state avant stop
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop()
        }
        setIsListening(false)
    }

    // Cleanup stream on unmount
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        }
    }, [])

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
                setPrompt((prev: string) => prev ? `${prev} ${data.text}` : data.text)
            }
        } catch (err: any) {
            console.error('Transcription error:', err)
            setSpeechError("Erreur de transcription.")
        } finally {
            setIsTranscribing(false)
        }
    }

    const toggleListening = () => {
        if (isListening) {
            stopRecording()
        } else {
            startRecording()
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files)
            setSelectedFiles((prev: File[]) => [...prev, ...files])
            setShowPlusMenu(false)
        }
        // Reset input pour permettre de re-sélectionner le même fichier
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeFile = (index: number) => {
        setSelectedFiles((prev: File[]) => prev.filter((_: File, i: number) => i !== index))
    }

    // Fix Bug 6: OAuth redirige la page, pas de finally
    const handleConnectService = async (service: string, scopes: string[]) => {
        setConnectingService(service)
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    scopes: scopes.join(' '),
                    redirectTo: window.location.origin
                }
            })
            if (error) {
                console.error(`Error connecting to ${service}:`, error)
                alert(`Erreur de connexion à ${service}: ${error.message}`)
                setConnectingService(null)
                setShowPlusMenu(false)
            }
            // Si pas d'erreur, la page va être redirigée — pas besoin de cleanup
        } catch (err: any) {
            console.error(`Error connecting to ${service}:`, err)
            alert(`Erreur de connexion à ${service}: ${err.message}`)
            setConnectingService(null)
            setShowPlusMenu(false)
        }
    }

    // Fix Bug 4: Vérifier disabled avant d'envoyer
    const handleFormSubmit = () => {
        if (disabled || (!prompt.trim() && selectedFiles.length === 0)) return
        onSubmit(selectedFiles)
        setSelectedFiles([])
        if (textareaRef.current) {
            textareaRef.current.style.height = '48px'
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (showModelDropdown || showMasterDropdown || showToolsMenu || showPlusMenu) {
                const isOutsideModel = !modelMenuRef.current?.contains(target)
                const isOutsideMaster = !masterMenuRef.current?.contains(target)
                const isOutsideTools = !toolsMenuRef.current?.contains(target)
                const isOutsidePlus = !plusMenuRef.current?.contains(target)

                if (isOutsideModel && isOutsideMaster && isOutsideTools && isOutsidePlus) {
                    setShowModelDropdown(false)
                    setShowMasterDropdown(false)
                    setShowToolsMenu(false)
                    setShowPlusMenu(false)
                    setExpandedModel(null)
                }
            }
        }

        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [showModelDropdown, showMasterDropdown, showToolsMenu, showPlusMenu])

    // Fix Bug 4: Vérifier disabled dans handleKeyDown
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!disabled && (prompt.trim() || selectedFiles.length > 0)) {
                handleFormSubmit()
            }
        }
    }

    return (
        <div className="w-full max-w-3xl mx-auto z-40 px-4 pb-6">

            <div className="p-3 bg-white/60 border border-white/40 backdrop-blur-2xl shadow-2xl rounded-2xl flex flex-col gap-2 relative">

                {/* Top Row: Fusion Controls & Search */}
                <div className="flex items-center gap-2 px-1 flex-wrap min-h-[32px] relative z-20">

                    {/* Thinking Mode UI */}
                    {isThinking ? (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full flex items-center justify-between bg-gradient-to-r from-white/40 to-white/60 backdrop-blur-md rounded-full px-1.5 py-1.5 border border-white/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]"
                        >
                            <div className="flex items-center gap-3 px-2">
                                <div className="relative flex items-center justify-center">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        className="w-4 h-4 border-2 border-foreground/5 border-t-foreground rounded-full"
                                    />
                                    <div className="absolute w-1 h-1 bg-foreground rounded-full" />
                                </div>
                                <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest animate-pulse">{statusText}</span>
                            </div>

                            {onStop && !isManusMode && !(fusionEnabled && (fusionMode === 'fusion' || fusionMode === 'supernova')) && (
                                <button
                                    onClick={onStop}
                                    className="px-4 py-1.5 bg-foreground hover:bg-black text-white text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg shadow-black/10 transition-all active:scale-95 flex items-center gap-2 group"
                                >
                                    <span>Répondre maintenant</span>
                                    <Zap size={10} className="text-amber-300 group-hover:scale-125 transition-transform" />
                                </button>
                            )}
                        </motion.div>
                    ) : (
                        isSearchOpen && onSearchChange ? (
                            <motion.div
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: '100%' }}
                                className="flex-1 flex items-center gap-2 bg-white/50 rounded-full px-3 py-1 border border-white/40"
                            >
                                <Search size={14} className="text-secondary" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
                                    className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder-secondary/50"
                                    placeholder="Rechercher une discussion..."
                                    autoFocus
                                />
                                <button onClick={onToggleSearch} className="text-secondary/50 hover:text-foreground">
                                    <ZapOff size={12} className="rotate-45" />
                                </button>
                            </motion.div>
                        ) : (
                            <>
                                {/* Fusion Toggle */}
                                {!isImageMode && (
                                    <div className="flex items-center gap-2">
                                        {/* Fusion Button */}
                                        <div className="relative group">
                                            <AnimatePresence>
                                                {hoveredMode === 'fusion' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: -25 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        className="absolute left-1/2 -translate-x-1/2 bg-[#EAE1D3] text-[#5C4B40] text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-[#5C4B40]/10 z-[60] whitespace-nowrap pointer-events-none"
                                                    >
                                                        FUSION
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div className={`p-[2px] rounded-full ${(fusionEnabled && fusionMode !== 'supernova') ? 'rotating-border-container border-fusion shadow-lg' : ''}`}>
                                                <button
                                                    onClick={onFusionToggle}
                                                    onMouseEnter={() => {
                                                        setHoveredMode('fusion')
                                                        onHoverModeChange?.('fusion')
                                                    }}
                                                    onMouseLeave={() => {
                                                        setHoveredMode(null)
                                                        onHoverModeChange?.(null)
                                                    }}
                                                    className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${fusionEnabled
                                                        ? 'bg-gradient-to-r from-[#EAE1D3] to-[#c1b2a2] text-[#5C4B40] border border-white/20'
                                                        : 'bg-[#D3CBC1] text-foreground/60 hover:bg-[#C5BDB3] shadow-md border border-transparent'
                                                        }`}
                                                    title={fusionEnabled ? 'Mode Fusion activé' : 'Mode Solo'}
                                                >
                                                    <img
                                                        src="/fusion.png"
                                                        alt="Fusion"
                                                        className={`w-6 h-6 object-contain transition-all drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${fusionEnabled ? 'brightness-[10] contrast-[10]' : 'opacity-70 grayscale-[1] brightness-[5]'}`}
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Supernova Button */}
                                        {fusionEnabled && (
                                            <div className="relative group">
                                                <AnimatePresence>
                                                    {hoveredMode === 'supernova' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: -25 }}
                                                            exit={{ opacity: 0, y: 10 }}
                                                            className="absolute left-1/2 -translate-x-1/2 bg-[#4a0404] text-[#EAE1D3] text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-[#EAE1D3]/10 z-[60] whitespace-nowrap pointer-events-none"
                                                        >
                                                            SUPERNOVA 🔥 7 API
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div className={`p-[2px] rounded-full ${fusionMode === 'supernova' ? 'rotating-border-container border-supernova shadow-lg' : ''}`}>
                                                    <button
                                                        onClick={() => onFusionModeChange(fusionMode === 'supernova' ? 'fusion' : 'supernova')}
                                                        onMouseEnter={() => {
                                                            setHoveredMode('supernova')
                                                            onHoverModeChange?.('supernova')
                                                        }}
                                                        onMouseLeave={() => {
                                                            setHoveredMode(null)
                                                            onHoverModeChange?.(null)
                                                        }}
                                                        className={`relative z-10 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${fusionMode === 'supernova'
                                                            ? 'bg-gradient-to-r from-[#4a0404] to-[#800000] text-[#EAE1D3] border border-white/20'
                                                            : 'bg-[#EAE1D3]/50 text-[#5C4B40]/60 hover:bg-[#EAE1D3] border border-[#5C4B40]/10'
                                                            }`}
                                                        title={fusionMode === 'supernova' ? 'Mode Supernova (7 appels)' : 'Mode Fusion (4 appels)'}
                                                    >
                                                        <img
                                                            src="/fusion.png"
                                                            alt="Supernova"
                                                            className="w-6 h-6 object-contain transition-transform group-hover:scale-110 sepia saturate-[5] brightness-125 hue-rotate-[10deg] drop-shadow-[0_2px_10px_rgba(255,215,0,0.4)]"
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Planète Web Verify Toggle */}
                                {onToggleWebVerify && (
                                    <div className="relative group">
                                        <AnimatePresence>
                                            {hoveredMode === 'webverify' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: -25 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className={`absolute left-1/2 -translate-x-1/2 text-[10px] font-black px-2 py-0.5 rounded shadow-lg z-[60] whitespace-nowrap pointer-events-none uppercase tracking-widest ${webVerifyEnabled ? 'bg-[#EAE1D3] text-[#5C4B40] border border-[#5C4B40]/10' : 'bg-white text-[#5C4B40]/60 border border-[#5C4B40]/10'}`}
                                                >
                                                    {webVerifyEnabled ? 'FACT-CHECK ON' : 'FACT-CHECK OFF'}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <button
                                            onClick={onToggleWebVerify}
                                            onMouseEnter={() => setHoveredMode('webverify')}
                                            onMouseLeave={() => setHoveredMode(null)}
                                            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all border shadow-md active:scale-95 ${webVerifyEnabled
                                                ? 'bg-gradient-to-br from-[#F0EBE4] to-[#E0D6CA] border-[#5C4B40]/15 text-[#5C4B40] ring-2 ring-[#5C4B40]/10 shadow-[#5C4B40]/15'
                                                : 'bg-[#EDE8E2] border-white/40 text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#E5DED6] hover:shadow-lg'
                                                }`}
                                            title={webVerifyEnabled ? 'Fact-Check Web activé' : 'Activer le Fact-Check Web'}
                                        >
                                            <Globe size={16} className={`transition-all drop-shadow-[0_1px_2px_rgba(92,75,64,0.3)] ${webVerifyEnabled ? 'scale-110' : 'opacity-70'}`} />
                                        </button>
                                    </div>
                                )}

                                {/* Master LLM Selector */}
                                {fusionEnabled && !isImageMode && (
                                    <div className="relative group" ref={masterMenuRef}>
                                        <AnimatePresence>
                                            {hoveredMode === 'master' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: -25 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute left-1/2 -translate-x-1/2 bg-white text-foreground text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-foreground/10 z-50 whitespace-nowrap pointer-events-none"
                                                >
                                                    MASTER IA : {currentMaster.name}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <button
                                            onClick={() => setShowMasterDropdown(!showMasterDropdown)}
                                            onMouseEnter={() => setHoveredMode('master')}
                                            onMouseLeave={() => setHoveredMode(null)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-white rounded-full transition-all border border-white/40 shadow-sm cursor-pointer"
                                            title={`Master: ${currentMaster.name}`}
                                        >
                                            {currentMaster.icon}
                                            <ChevronDown size={12} className={`transition-transform text-secondary/60 ${showMasterDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showMasterDropdown && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-white/50 rounded-xl shadow-xl z-[100] p-1"
                                                >
                                                    {MASTER_MODELS.map(model => (
                                                        <button
                                                            key={model.id}
                                                            onClick={() => {
                                                                onMasterModelChange(model.id)
                                                                setShowMasterDropdown(false)
                                                            }}
                                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg transition-colors ${model.id === masterModel ? 'bg-amber-100 text-foreground font-semibold' : 'text-foreground hover:bg-secondary/10'}`}
                                                        >
                                                            <span>{model.icon}</span>
                                                            <span>{model.name}</span>
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Model Selector (Solo OR Image Mode) */}
                                {(!fusionEnabled || isImageMode) && (
                                    <div className="relative group" ref={modelMenuRef}>
                                        <AnimatePresence>
                                            {hoveredMode === 'solo' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: -25 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute left-1/2 -translate-x-1/2 bg-white text-foreground text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-foreground/10 z-50 whitespace-nowrap pointer-events-none"
                                                >
                                                    {isImageMode ? 'GÉNÉRATEUR' : 'MODÈLE SOLO'} : {currentModel.name}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <button
                                            onClick={() => {
                                                setShowModelDropdown(!showModelDropdown)
                                                setExpandedModel(null)
                                            }}
                                            onMouseEnter={() => setHoveredMode('solo')}
                                            onMouseLeave={() => setHoveredMode(null)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white/80 hover:bg-white rounded-full transition-all border border-white/40 shadow-sm cursor-pointer"
                                            title={currentModel.name}
                                        >
                                            <div className="flex items-center gap-2">
                                                {currentModel.icon}
                                            </div>
                                            <ChevronDown size={12} className={`text-secondary/60 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {showModelDropdown && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute bottom-full left-0 mb-2 w-64 bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-[100] p-1.5"
                                                >
                                                    {currentModels.map(model => {
                                                        const isExpanded = expandedModel === model.id
                                                        const isSelected = model.id === selectedModel
                                                        const hasVariantSelected = model.variants?.some(v => v.id === selectedModel)

                                                        return (
                                                            <div key={model.id}>
                                                                <div className={`w-full flex items-center justify-between rounded-lg transition-colors ${isSelected || hasVariantSelected ? 'bg-secondary/15' : 'hover:bg-secondary/10'}`}>
                                                                    <button
                                                                        onClick={() => {
                                                                            onModelChange(model.id)
                                                                            setShowModelDropdown(false)
                                                                            setExpandedModel(null)
                                                                        }}
                                                                        className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-xs text-left"
                                                                    >
                                                                        <span>{model.icon}</span>
                                                                        <span className={isSelected ? 'font-semibold' : ''}>{model.name}</span>
                                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-foreground ml-auto" />}
                                                                    </button>

                                                                    {model.variants && model.variants.length > 0 && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setExpandedModel(isExpanded ? null : model.id)
                                                                            }}
                                                                            className="px-2.5 py-2.5 text-secondary/40 hover:text-foreground hover:bg-secondary/20 rounded-r-lg border-l border-secondary/10 transition-all"
                                                                        >
                                                                            <ChevronDown
                                                                                size={12}
                                                                                className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-foreground' : ''}`}
                                                                            />
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <AnimatePresence>
                                                                    {isExpanded && model.variants && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, height: 0 }}
                                                                            animate={{ opacity: 1, height: 'auto' }}
                                                                            exit={{ opacity: 0, height: 0 }}
                                                                            transition={{ duration: 0.15 }}
                                                                            className="overflow-hidden"
                                                                        >
                                                                            <div className="ml-4 pl-3 border-l-2 border-secondary/15 py-1 space-y-0.5">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        onModelChange(model.id)
                                                                                        setShowModelDropdown(false)
                                                                                        setExpandedModel(null)
                                                                                    }}
                                                                                    className={`w-full flex items-center justify-between px-3 py-2 text-[11px] text-left rounded-lg transition-colors ${isSelected ? 'bg-secondary/15 font-bold' : 'hover:bg-secondary/10'}`}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span>{model.icon}</span>
                                                                                        <div>
                                                                                            <span className="uppercase tracking-tight text-[10px] font-medium">Max</span>
                                                                                            <span className="text-secondary/60 text-[9px] ml-1.5">Intelligence Maximale</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />}
                                                                                </button>

                                                                                {model.variants.map(variant => {
                                                                                    const isVariantSelected = variant.id === selectedModel
                                                                                    return (
                                                                                        <button
                                                                                            key={variant.id}
                                                                                            onClick={() => {
                                                                                                onModelChange(variant.id)
                                                                                                setShowModelDropdown(false)
                                                                                                setExpandedModel(null)
                                                                                            }}
                                                                                            className={`w-full flex items-center justify-between px-3 py-2 text-[11px] text-left rounded-lg transition-colors ${isVariantSelected ? 'bg-secondary/15 font-bold' : 'hover:bg-secondary/10'}`}
                                                                                        >
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span>{variant.icon}</span>
                                                                                                <div>
                                                                                                    <span className="tracking-tight">{variant.name}</span>
                                                                                                    <span className="text-secondary/60 text-[9px] ml-1.5">⚡ Rapide</span>
                                                                                                </div>
                                                                                            </div>
                                                                                            {isVariantSelected && <div className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />}
                                                                                        </button>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        )
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Right Actions: Search & Tools */}
                                <div className="ml-auto flex items-center gap-2">
                                    {onToggleSearch && (
                                        <button
                                            onClick={onToggleSearch}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all border shadow-sm ${isSearchOpen
                                                ? 'bg-white text-foreground border-secondary/50'
                                                : 'bg-white text-foreground/60 border-white/40 hover:bg-white'
                                                }`}
                                            title="Rechercher une discussion"
                                        >
                                            <Search size={14} />
                                        </button>
                                    )}

                                    <AnimatePresence mode="wait">
                                        {(isResearchMode || isImageMode) && (
                                            <motion.div
                                                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                                                className="flex items-center gap-2"
                                            >
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm bg-[#800000]/5 border-[#800000]/20 text-[#800000]">
                                                    <div className="flex items-center gap-1.5 translate-y-[0.5px]">
                                                        {isImageMode && <ImageIcon size={12} />}
                                                        <span>
                                                            {isResearchMode ? 'Research' : 'Image Gen'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (isResearchMode) onToolSelect?.('deep-research')
                                                            else if (isImageMode) onToolSelect?.('image')
                                                        }}
                                                        className="p-1.5 hover:bg-black/10 rounded-full transition-all ml-0.5 -mr-1"
                                                        title="Quitter"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>

                                                {isImageMode && onImageCountChange && (
                                                    <button
                                                        onClick={() => onImageCountChange(imageCount >= 4 ? 1 : imageCount + 1)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all border ${imageCount > 1
                                                            ? 'bg-[#800000]/10 text-[#800000] border-[#800000]/20'
                                                            : 'bg-white text-black border-[#5C4B40]/10 hover:bg-white/80'
                                                            }`}
                                                        title={`Générer ${imageCount} image(s)`}
                                                    >
                                                        {imageCount > 1 && <Crown size={12} className="text-[#800000]" />}
                                                        <span>{imageCount}X</span>
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Manus Agent Button */}
                                    <div className="relative group">
                                        <AnimatePresence>
                                            {hoveredMode === 'manus' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: -25 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute left-1/2 -translate-x-1/2 bg-[#EAE1D3] text-[#5C4B40] text-[10px] font-black px-2 py-0.5 rounded shadow-lg border border-[#5C4B40]/10 z-50 whitespace-nowrap pointer-events-none uppercase tracking-widest"
                                                >
                                                    agent ia
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        <div className={`p-[2px] rounded-full ${isManusMode ? 'rotating-border-container border-fusion shadow-lg' : ''}`}>
                                            <button
                                                onClick={() => onToolSelect?.('manus')}
                                                onMouseEnter={() => setHoveredMode('manus')}
                                                onMouseLeave={() => setHoveredMode(null)}
                                                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all border shadow-md ${isManusMode ? 'bg-[#1a1a1a] border-[#1a1a1a] ring-2 ring-[#1a1a1a]/20' : 'bg-white border-[#5C4B40]/10'} hover:shadow-lg active:scale-95 group`}
                                            >
                                                <img
                                                    src="/Manus1.png"
                                                    alt="Manus Agent"
                                                    className={`w-5 h-5 object-contain transition-transform group-hover:scale-110 ${isManusMode ? 'brightness-0 invert' : ''}`}
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none'
                                                        const parent = e.currentTarget.parentElement
                                                        if (parent && !parent.querySelector('.fallback-icon')) {
                                                            const span = document.createElement('span')
                                                            span.className = 'fallback-icon text-sm'
                                                            span.innerHTML = '👋'
                                                            parent.appendChild(span)
                                                        }
                                                    }}
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Tools Menu Button */}
                                    <div className="relative" ref={toolsMenuRef}>
                                        <button
                                            onClick={() => setShowToolsMenu(!showToolsMenu)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all border shadow-md bg-gradient-to-r from-[#EAE1D3] to-[#c1b2a2] text-[#5C4B40] border-[#5C4B40]/20 hover:shadow-lg hover:border-[#5C4B40]/30 active:scale-95 group"
                                        >
                                            <Sparkles size={14} className="text-[#5C4B40] group-hover:text-[#800000] transition-colors" />
                                            <span>Outils</span>
                                        </button>

                                        <AnimatePresence>
                                            {showToolsMenu && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute bottom-full right-0 mb-2 w-44 bg-white/90 backdrop-blur-xl border border-white/50 rounded-xl shadow-xl z-50 p-1"
                                                >
                                                    <div className="relative group/research flex items-center w-full">
                                                        <button
                                                            onClick={() => { onToolSelect?.('deep-research'); setShowToolsMenu(false) }}
                                                            className="flex-1 flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#5C4B40] hover:bg-[#800000]/5 hover:text-[#800000] rounded-l-lg transition-colors group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Search size={14} className="text-[#800000]" />
                                                                <span>Recherche approfondie</span>
                                                            </div>
                                                        </button>

                                                        {researchConfig && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    setShowResearchConfig(!showResearchConfig)
                                                                }}
                                                                className={`relative z-30 px-3 py-2.5 flex items-center justify-center transition-all border-l border-[#5C4B40]/5 cursor-pointer pointer-events-auto ${showResearchConfig ? 'bg-[#800000]/10 text-[#800000] rounded-r-lg' : 'text-[#5C4B40]/40 hover:text-[#800000] hover:bg-[#800000]/5 rounded-r-lg'}`}
                                                                title="Configurer la recherche"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>
                                                        )}

                                                        <AnimatePresence>
                                                            {showResearchConfig && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                                                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                                                                    className="absolute right-full top-0 mr-2 bg-white/95 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                                                                >
                                                                    <ResearchConfigPanel
                                                                        config={researchConfig}
                                                                        onChange={(config: any) => onResearchConfigChange?.(config)}
                                                                        onClose={() => setShowResearchConfig(false)}
                                                                    />
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                    <div className="h-px bg-[#5C4B40]/5 my-1" />
                                                    <button
                                                        onClick={() => { onToolSelect?.('canvas'); setShowToolsMenu(false) }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 hover:bg-[#800000]/5 hover:text-[#800000] rounded-lg transition-colors"
                                                    >
                                                        <FileText size={14} /> Canevas
                                                    </button>
                                                    <button
                                                        onClick={() => { onToolSelect?.('image'); setShowToolsMenu(false) }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/60 hover:bg-[#800000]/5 hover:text-[#800000] rounded-lg transition-colors"
                                                    >
                                                        <ImageIcon size={14} className="text-[#800000]" /> Image Gen
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </>
                        )
                    )}
                </div>

                {/* File Previews Above Input */}
                <AnimatePresence>
                    {selectedFiles.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, scale: 0.95 }}
                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: 0.95 }}
                            className="flex flex-wrap gap-2 px-2 pb-2 overflow-hidden"
                        >
                            {selectedFiles.map((file: File, idx: number) => {
                                const isImage = file.type.startsWith('image/')
                                const isVideo = file.type.startsWith('video/')
                                return (
                                    <div
                                        key={idx}
                                        className="relative flex items-center gap-2 bg-white/40 border border-[#5C4B40]/10 rounded-xl p-1.5 pr-3 group/file min-w-[120px]"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#5C4B40]/5 overflow-hidden flex items-center justify-center">
                                            {isImage ? (
                                                <img
                                                    src={filePreviewUrls[idx] || ''}
                                                    alt="preview"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : isVideo ? (
                                                <Video size={14} className="text-[#5C4B40]" />
                                            ) : (
                                                <FileText size={14} className="text-[#5C4B40]" />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-[#5C4B40]/70 truncate max-w-[80px]">
                                            {file.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#5C4B40] text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/file:opacity-100 transition-all scale-75 hover:scale-110"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Row */}
                <div className={`relative w-full flex items-end gap-2 bg-white rounded-xl border border-white/30 focus-within:shadow-inner transition-all ${isImageMode ? 'bg-purple-500/5 border-purple-500/20' : ''}`}>
                    {/* Plus Button & Menu */}
                    <div className="relative mb-1.5 ml-2" ref={plusMenuRef}>
                        <button
                            onClick={() => setShowPlusMenu(!showPlusMenu)}
                            className={`p-2 rounded-lg transition-all ${showPlusMenu ? 'bg-secondary/10 text-foreground' : 'text-foreground/40 hover:text-foreground hover:bg-secondary/5'}`}
                            title="Ajouter un document ou connecter un service"
                        >
                            <Plus size={20} className={`transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showPlusMenu && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute bottom-full left-0 mb-2 w-64 bg-white/95 backdrop-blur-xl border border-white/50 rounded-2xl shadow-2xl z-50 p-1.5 overflow-hidden"
                                >
                                    <div className="text-[10px] font-bold text-[#5C4B40] px-3 py-1 uppercase tracking-widest opacity-60">Ajouter</div>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left text-foreground hover:bg-secondary/10 rounded-lg transition-colors group"
                                    >
                                        <div className="p-1.5 bg-[#5C4B40]/10 text-[#5C4B40] rounded-md group-hover:bg-[#5C4B40] group-hover:text-white transition-colors">
                                            <FileUp size={14} />
                                        </div>
                                        <span>Fichier, Image ou Vidéo</span>
                                    </button>

                                    <div className="h-px bg-secondary/5 my-1.5 mx-2" />
                                    <div className="text-[10px] font-bold text-[#5C4B40] px-3 py-1 uppercase tracking-widest opacity-60">Connecter</div>
                                    <button
                                        disabled={connectingService !== null}
                                        onClick={() => handleConnectService('Gmail', ['https://www.googleapis.com/auth/gmail.readonly'])}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left text-foreground hover:bg-secondary/10 rounded-lg transition-colors group"
                                    >
                                        <div className="p-1.5 bg-[#5C4B40]/10 text-[#5C4B40] rounded-md group-hover:bg-[#5C4B40] group-hover:text-white transition-colors">
                                            {connectingService === 'Gmail' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                        </div>
                                        <span>{connectingService === 'Gmail' ? 'Connexion...' : 'Gmail'}</span>
                                    </button>
                                    <button
                                        disabled={connectingService !== null}
                                        onClick={() => handleConnectService('Google Drive', ['https://www.googleapis.com/auth/drive.readonly'])}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left text-foreground hover:bg-secondary/10 rounded-lg transition-colors group"
                                    >
                                        <div className="p-1.5 bg-[#5C4B40]/10 text-[#5C4B40] rounded-md group-hover:bg-[#5C4B40] group-hover:text-white transition-colors">
                                            {connectingService === 'Google Drive' ? <Loader2 size={14} className="animate-spin" /> : <HardDrive size={14} />}
                                        </div>
                                        <span>{connectingService === 'Google Drive' ? 'Connexion...' : 'Google Drive'}</span>
                                    </button>
                                    <button
                                        disabled={connectingService !== null}
                                        onClick={() => handleConnectService('Google Agenda', ['https://www.googleapis.com/auth/calendar.readonly'])}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-left text-foreground hover:bg-secondary/10 rounded-lg transition-colors group"
                                    >
                                        <div className="p-1.5 bg-[#5C4B40]/10 text-[#5C4B40] rounded-md group-hover:bg-[#5C4B40] group-hover:text-white transition-colors">
                                            {connectingService === 'Google Agenda' ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                                        </div>
                                        <span>{connectingService === 'Google Agenda' ? 'Connexion...' : 'Google Agenda'}</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <textarea
                        ref={textareaRef}
                        className={`flex-1 bg-transparent border-none rounded-xl p-3 pr-12 focus:ring-0 resize-none font-mono text-sm leading-6 min-h-[48px] max-h-[200px] no-scrollbar ${isManusMode
                            ? 'text-black placeholder-black/40 font-black'
                            : (fusionEnabled && fusionMode === 'fusion')
                                ? 'text-[#5C4B40] placeholder-[#5C4B40]/80 font-bold'
                                : (fusionEnabled && fusionMode === 'supernova')
                                    ? 'text-[#800020] placeholder-[#800020]/80 font-bold'
                                    : 'text-foreground placeholder-foreground/40'
                            }`}
                        rows={1}
                        placeholder={isManusMode
                            ? "Message pour Manus..."
                            : isResearchMode
                                ? "Quelle recherche approfondie souhaitez-vous lancer ? 🔎"
                                : isImageMode
                                    ? `Décrivez l'image à générer avec ${currentModel.name}...`
                                    : (fusionEnabled
                                        ? (fusionMode === 'supernova' ? "Requête Supernova... 🔥" : "Message pour Fusion...")
                                        : `Message pour ${currentModel.name}...`)}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                    />

                    {/* Voice Button */}
                    {!isImageMode && (
                        <button
                            onClick={toggleListening}
                            className={`p-2 transition-all rounded-lg ${isListening ? 'text-red-500 bg-red-50 animate-pulse scale-110 shadow-lg shadow-red-200' : 'text-foreground/40 hover:text-foreground'}`}
                            title={isListening ? "Arrêter l'écoute" : "Transcription Vocale"}
                        >
                            <Mic size={18} />
                        </button>
                    )}

                    {/* Send Button */}
                    <button
                        onClick={handleFormSubmit}
                        disabled={disabled || (!prompt.trim() && selectedFiles.length === 0)}
                        className={`m-1 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md ${isManusMode
                            ? 'bg-black text-white hover:bg-gray-900'
                            : isImageMode
                                ? 'bg-[#800000] text-white hover:bg-[#600000]'
                                : isResearchMode
                                    ? 'bg-[#800000] text-white hover:bg-[#600000]'
                                    : (fusionEnabled)
                                        ? (fusionMode === 'supernova'
                                            ? 'bg-[#800020] text-white hover:bg-[#600018]'
                                            : 'bg-[#5C4B40] text-white hover:bg-[#4A3C33]')
                                        : 'bg-foreground text-background hover:bg-secondary'
                            }`}
                    >
                        <Send size={16} />
                    </button>
                </div>
                {speechError && (
                    <div className="px-3 py-1 text-[10px] text-red-500 font-bold uppercase tracking-tighter">
                        Erreur micro: {speechError}
                    </div>
                )}
                {/* Fix Bug 9: Ajouter accept pour filtrer les types de fichiers */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.json,.pptx,.md"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>
        </div>
    )
}
