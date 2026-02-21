'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Video,
  Plus,
  Image as ImageIcon,
  Trash2,
  Download,
  Clock,
  HelpCircle,
  ChevronDown,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  X,
  Play,
  Settings,
  AlertTriangle,
  User
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

const VIDEO_STYLE_PROMPTS: Record<string, string> = {
  'none': '',
  'cinematique': 'cinematic style, dramatic lighting, shallow depth of field, film grain, anamorphic lens, movie-like color grading, professional cinematography',
  'photorealiste': 'photorealistic style, hyperrealistic, natural lighting, real-world textures, 8K quality, lifelike details, shot on RED camera',
  'illustration-digitale': 'digital illustration style, vibrant colors, detailed digital painting, concept art quality, stylized artistic rendering',
  'pixar': 'Pixar 3D animation style, colorful, expressive characters, smooth rendering, playful lighting, family-friendly aesthetic, high-quality CGI',
  'anime': 'anime style, Japanese animation, cel-shaded, vibrant colors, dynamic poses, manga-inspired, Studio Ghibli quality',
  'aquarelle': 'watercolor painting style, soft edges, flowing colors, artistic brush strokes, delicate washes, painterly aesthetic',
  'noir': 'film noir style, high contrast black and white, dramatic shadows, moody atmosphere, 1940s detective aesthetic, expressionist lighting',
  'retro': 'retro vintage style, VHS aesthetic, 80s nostalgia, warm tones, film grain, analog look, synthwave colors',
  'fantasy': 'epic fantasy style, magical atmosphere, ethereal lighting, mystical environment, enchanted world, Lord of the Rings quality'
}

const MODEL_CONFIGS: Record<string, { durations: number[], qualities: string[], aspectRatios: string[] }> = {
  'grok-video': {
    durations: [5, 8, 10, 15],
    qualities: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1']
  },
  'veo-3.1': {
    durations: [4, 6, 8],
    qualities: ['720p', '1080p', '4k'],
    aspectRatios: ['16:9', '9:16']
  },
  'runway': {
    durations: [5, 10],
    qualities: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1']
  },
  'kling-3.0-standard': {
    durations: [5, 10],
    qualities: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1']
  },
  'kling-3.0-pro': {
    durations: [5, 10],
    qualities: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1']
  }
}

interface VideoStudioLayoutProps {
  user: any
}

export default function VideoStudioLayout({ user }: VideoStudioLayoutProps) {
  const supabase = createClient()

  // States principaux du module vidéo
  const [activeVideoTab, setActiveVideoTab] = useState<'create' | 'edit' | 'motion'>('create')

  // Fix Bug 5: Guard SSR pour localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedTab = localStorage.getItem('studio_active_tab')
      if (savedTab === 'create' || savedTab === 'edit' || savedTab === 'motion') {
        setActiveVideoTab(savedTab)
      }
    } catch { /* localStorage peut être bloqué */ }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('studio_active_tab', activeVideoTab)
    } catch { /* silencieux */ }
  }, [activeVideoTab])

  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoModel, setVideoModel] = useState('grok-video')
  const [videoDuration, setVideoDuration] = useState(5)
  const [videoRatio, setVideoRatio] = useState('16:9')
  const [videoQuality, setVideoQuality] = useState('720p')
  const [selectedVideoStyle, setSelectedVideoStyle] = useState('none')
  const [customStyles, setCustomStyles] = useState<any[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [multiShot, setMultiShot] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'processing' | 'done' | 'failed'>('idle')
  const [videos, setVideos] = useState<any[]>([])
  const [selectedVideo, setSelectedVideo] = useState<any>(null)

  // Fix Bug 6: States pour les paramètres avancés
  const [temperature, setTemperature] = useState(0.7)
  const [styleStrength, setStyleStrength] = useState(0.5)

  // Progress Bar States
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fix Bug 2: Refs pour cleanup des intervals/timeouts au unmount
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fix Bug 3: Ref pour isGenerating (éviter stale closure)
  const isGeneratingRef = useRef(false)

  // Fix Bug 7: Ref pour selectedVideo (éviter re-subscribe)
  const selectedVideoRef = useRef<any>(null)

  // Sync refs avec states
  useEffect(() => { isGeneratingRef.current = isGenerating }, [isGenerating])
  useEffect(() => { selectedVideoRef.current = selectedVideo }, [selectedVideo])

  // Advanced Settings Accordion
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  // Pour les uploads (images source, vidéo source)
  const [startFrame, setStartFrame] = useState<File | null>(null)
  const [startFramePreview, setStartFramePreview] = useState<string | null>(null)
  const [endFrame, setEndFrame] = useState<File | null>(null)
  const [endFramePreview, setEndFramePreview] = useState<string | null>(null)
  const [sourceVideo, setSourceVideo] = useState<File | null>(null)
  const [sourceVideoPreview, setSourceVideoPreview] = useState<string | null>(null)
  const [characterImage, setCharacterImage] = useState<File | null>(null)
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null)

  const [sceneControlMode, setSceneControlMode] = useState<'video' | 'image'>('video')

  // Refs pour les inputs file
  const startFrameRef = useRef<HTMLInputElement>(null)
  const endFrameRef = useRef<HTMLInputElement>(null)
  const sourceVideoRef = useRef<HTMLInputElement>(null)
  const characterImageRef = useRef<HTMLInputElement>(null)

  // Fix Bug 1: Cleanup Object URLs au unmount
  useEffect(() => {
    return () => {
      if (startFramePreview) URL.revokeObjectURL(startFramePreview)
      if (endFramePreview) URL.revokeObjectURL(endFramePreview)
      if (sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview)
      if (characterImagePreview) URL.revokeObjectURL(characterImagePreview)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fix Bug 2: Cleanup intervals/timeouts au unmount
  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)
    }
  }, [])

  // Chargement des vidéos existantes
  const fetchVideos = async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setVideos(data)
    if (error) console.error("Error fetching videos:", error)
  }

  // Charger au mount
  useEffect(() => {
    fetchVideos()
    fetchCustomStyles()
  }, [user?.id])

  // Mettre à jour les options disponibles quand le modèle change
  useEffect(() => {
    const config = MODEL_CONFIGS[videoModel] || MODEL_CONFIGS['grok-video']

    if (!config.durations.includes(videoDuration)) {
      setVideoDuration(config.durations[0])
    }
    if (!config.qualities.includes(videoQuality)) {
      setVideoQuality(config.qualities[0])
    }
    if (!config.aspectRatios.includes(videoRatio)) {
      setVideoRatio(config.aspectRatios[0])
    }
  }, [videoModel])

  const fetchCustomStyles = async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('studio_styles')
      .select('*')
      .eq('user_id', user.id)
    if (data) setCustomStyles(data)
  }

  // Fix Bug 7: Retirer selectedVideo?.id des deps, utiliser ref dans le handler
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`studio-videos-${user.id}`) // Fix Bug 7: Nom unique par user
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'studio_videos',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setVideos(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setVideos(prev => prev.map(v =>
            v.id === payload.new.id ? payload.new : v
          ))
          // Fix Bug 7: Utiliser la ref au lieu du state
          if (selectedVideoRef.current?.id === payload.new.id) {
            setSelectedVideo(payload.new)
          }
        } else if (payload.eventType === 'DELETE') {
          setVideos(prev => prev.filter(v => v.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id]) // Fix Bug 7: Seulement user?.id

  // Fonctions de progression
  const startFakeProgress = (estimatedSeconds: number) => {
    setProgress(0)
    const start = Date.now()
    progressRef.current = setInterval(() => {
      const ratio = (Date.now() - start) / (estimatedSeconds * 1000)
      setProgress(Math.min(95, Math.round(100 * (1 - Math.exp(-2.5 * ratio)))))
    }, 400)
  }

  const stopFakeProgress = (success: boolean) => {
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = null
    setProgress(success ? 100 : 0)
  }

  const getEstimatedDuration = () => {
    let base = videoDuration === 5 ? 45 : videoDuration === 8 ? 70 : 90
    if (videoQuality === '1080p') base *= 1.5
    if (videoModel === 'veo-3.1') base *= 1.2
    return base
  }

  // Fonction de génération
  const handleVideoGenerate = async () => {
    if (!videoPrompt.trim() || isGenerating) return

    if (!user || !user.id) {
      alert('Vous devez être connecté pour générer des vidéos')
      return
    }

    setIsGenerating(true)
    setGenerationStatus('processing')

    // Fix Bug 2: Cleanup précédent poll si encore en cours
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current)

    try {
      const styleKey = selectedVideoStyle || 'none'
      const customStyle = customStyles.find(s => s.id === styleKey)
      const styleDesc = customStyle?.description || VIDEO_STYLE_PROMPTS[styleKey] || ''
      const styleName = customStyle?.name || styleKey

      let startFrameUrl = null
      let endFrameUrl = null
      let sourceVideoUrl = null
      let characterImageUrl = null

      const uploadFile = async (file: File, prefix: string) => {
        const fileName = `video-frames/${user.id}/${Date.now()}_${prefix}_${file.name}`
        const { data, error } = await supabase.storage
          .from('studio')
          .upload(fileName, file)

        if (error) throw error

        const { data: urlData } = supabase.storage.from('studio').getPublicUrl(fileName)
        return urlData.publicUrl
      }

      if (startFrame) startFrameUrl = await uploadFile(startFrame, 'start')
      if (endFrame) endFrameUrl = await uploadFile(endFrame, 'end')
      if (sourceVideo) sourceVideoUrl = await uploadFile(sourceVideo, 'source')
      if (characterImage) characterImageUrl = await uploadFile(characterImage, 'character')

      console.log('📡 Calling studio-video-generate...')
      const { data, error } = await supabase.functions.invoke('studio-video-generate', {
        body: {
          prompt: videoPrompt.trim(),
          model: videoModel,
          mode: videoModel.includes('pro') ? 'pro' : 'standard',
          duration: videoDuration,
          aspect_ratio: videoRatio,
          quality: videoQuality,
          style: styleName,
          style_description: styleDesc,
          sound_enabled: soundEnabled,
          temperature, // Fix Bug 6: Envoyer les paramètres avancés
          style_strength: styleStrength, // Fix Bug 6
          start_frame_url: startFrameUrl,
          end_frame_url: endFrameUrl,
          source_video_url: sourceVideoUrl,
          character_image_url: characterImageUrl,
          user_id: user.id
        }
      })

      if (error) {
        console.error('❌ Function invocation error:', error)

        let errorMsg = 'Erreur inconnue'
        try {
          const context = (error as any).context
          if (context && typeof context.json === 'function') {
            const errorData = await context.json()
            errorMsg = errorData?.error || errorData?.message || error.message
          } else {
            errorMsg = (data as any)?.error || error.message
          }
        } catch (e) {
          errorMsg = error.message
        }

        throw new Error(errorMsg)
      }

      if (!data) {
        throw new Error('Aucune données retournées par la fonction')
      }

      const videoId = data.id
      const taskId = data.provider_task_id || data.request_id

      console.log('🎞️ Generation submitted:', { videoId, taskId, fullResponse: data })

      if (!videoId || !taskId) {
        console.error('❌ Missing videoId or taskId from response:', data)
        setGenerationStatus('failed')
        setIsGenerating(false)
        stopFakeProgress(false)
        return
      }

      startFakeProgress(getEstimatedDuration())

      // Fix Bug 2: Stocker la ref du poll interval
      const pollInterval = setInterval(async () => {
        try {
          console.log('📡 Polling video status...', { videoId, taskId, model: videoModel })
          const { data: pollData, error: pollError } = await supabase.functions.invoke('studio-video-poll', {
            body: { video_id: videoId, provider_task_id: taskId, model: videoModel }
          })

          if (pollError) {
            let errorMsg = 'Erreur de polling inconnue'
            try {
              const context = (pollError as any).context
              if (context && typeof context.json === 'function') {
                const errorData = await context.json()
                errorMsg = errorData?.error || errorData?.message || pollError.message
              }
            } catch (e) {
              errorMsg = pollError.message
            }
            console.error('❌ Poll error:', errorMsg)
            return
          }

          console.log('🔄 Poll response:', pollData)
          if (pollData?.status === 'done') {
            clearInterval(pollInterval)
            pollIntervalRef.current = null
            if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null }
            stopFakeProgress(true)
            setTimeout(() => {
              setGenerationStatus('done')
              setIsGenerating(false)
              setProgress(0)
            }, 1000)
            fetchVideos()
            setVideoPrompt('')
            // Clear previews avec revoke
            clearAllPreviews()
          } else if (pollData?.status === 'failed') {
            clearInterval(pollInterval)
            pollIntervalRef.current = null
            if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null }
            stopFakeProgress(false)
            setGenerationStatus('failed')
            setIsGenerating(false)
          }
        } catch (e) {
          console.error('Poll error:', e)
        }
      }, 5000)

      pollIntervalRef.current = pollInterval // Fix Bug 2

      // Fix Bug 3: Utiliser isGeneratingRef au lieu de isGenerating (stale closure)
      const timeout = setTimeout(() => {
        clearInterval(pollInterval)
        pollIntervalRef.current = null
        pollTimeoutRef.current = null
        if (isGeneratingRef.current) {
          stopFakeProgress(false)
          setGenerationStatus('failed')
          setIsGenerating(false)
        }
      }, 180000)

      pollTimeoutRef.current = timeout // Fix Bug 2

    } catch (err: any) {
      console.error('Video generation failed:', err)

      const errorMsg = err?.message || err?.toString() || 'Erreur inconnue'
      alert(`Échec de la génération vidéo: ${errorMsg}\n\nVérifiez les logs Supabase pour plus de détails.`)

      stopFakeProgress(false)
      setGenerationStatus('failed')
      setIsGenerating(false)
    }
  }

  // Fix Bug 4: Ajouter user_id au delete
  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Supprimer cette vidéo ?')) return
    if (!user?.id) return

    try {
      const filePath = `generated/${id}.mp4`
      await supabase.storage.from('studio').remove([filePath])

      const { error } = await supabase
        .from('studio_videos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id) // Fix Bug 4

      if (error) {
        console.error("Error deleting video from DB:", error)
        fetchVideos()
        return
      }

      setVideos(prev => prev.filter(v => v.id !== id))
      if (selectedVideo?.id === id) setSelectedVideo(null)

      console.log('✅ Video deleted successfully:', id)
    } catch (err) {
      console.error("Critical delete error:", err)
      fetchVideos()
    }
  }

  // Fix Bug 1: Révoquer l'ancien Object URL avant d'en créer un nouveau
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end' | 'video' | 'character') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Fix Bug 1: Révoquer l'ancienne preview
    if (type === 'start' && startFramePreview) URL.revokeObjectURL(startFramePreview)
    else if (type === 'end' && endFramePreview) URL.revokeObjectURL(endFramePreview)
    else if (type === 'video' && sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview)
    else if (type === 'character' && characterImagePreview) URL.revokeObjectURL(characterImagePreview)

    const previewUrl = URL.createObjectURL(file)

    if (type === 'start') {
      setStartFrame(file); setStartFramePreview(previewUrl)
    } else if (type === 'end') {
      setEndFrame(file); setEndFramePreview(previewUrl)
    } else if (type === 'video') {
      setSourceVideo(file); setSourceVideoPreview(previewUrl)
    } else if (type === 'character') {
      setCharacterImage(file); setCharacterImagePreview(previewUrl)
    }

    e.target.value = ''
  }

  // Fix Bug 1: Révoquer l'Object URL au clear
  const clearFile = (e: React.MouseEvent, type: 'start' | 'end' | 'video' | 'character') => {
    e.stopPropagation()
    if (type === 'start') {
      if (startFramePreview) URL.revokeObjectURL(startFramePreview)
      setStartFrame(null); setStartFramePreview(null)
    } else if (type === 'end') {
      if (endFramePreview) URL.revokeObjectURL(endFramePreview)
      setEndFrame(null); setEndFramePreview(null)
    } else if (type === 'video') {
      if (sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview)
      setSourceVideo(null); setSourceVideoPreview(null)
    } else if (type === 'character') {
      if (characterImagePreview) URL.revokeObjectURL(characterImagePreview)
      setCharacterImage(null); setCharacterImagePreview(null)
    }
  }

  // Helper pour clear toutes les previews avec revoke
  const clearAllPreviews = () => {
    if (startFramePreview) URL.revokeObjectURL(startFramePreview)
    if (endFramePreview) URL.revokeObjectURL(endFramePreview)
    if (sourceVideoPreview) URL.revokeObjectURL(sourceVideoPreview)
    if (characterImagePreview) URL.revokeObjectURL(characterImagePreview)
    setStartFrame(null); setStartFramePreview(null)
    setEndFrame(null); setEndFramePreview(null)
    setSourceVideo(null); setSourceVideoPreview(null)
    setCharacterImage(null); setCharacterImagePreview(null)
  }

  // Fix Bug 8: Téléchargement réel via fetch + blob pour les URLs cross-origin
  const handleDownloadVideo = async (videoUrl: string, videoId: string) => {
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jungle-studio-${videoId}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
      // Fallback: ouvrir dans un nouvel onglet
      window.open(videoUrl, '_blank')
    }
  }

  return (
    <div className="w-full flex h-full p-6 gap-6 relative overflow-hidden bg-transparent">
      {/* Colonne GAUCHE : Galerie */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sous-onglets internes */}
        <div className="flex items-center gap-8 mb-6 border-b border-[#5C4B40]/10 px-2 relative">
          {(['create', 'edit', 'motion'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveVideoTab(tab)}
              className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeVideoTab === tab ? 'text-[#5C4B40]/70' : 'text-[#5C4B40]/30 hover:text-[#5C4B40]/50'
                }`}
            >
              {tab === 'create' ? 'Créer Vidéo' : tab === 'edit' ? 'Éditer Vidéo' : 'Motion Control'}
              {activeVideoTab === tab && (
                <motion.div
                  layoutId="video-tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5C4B40]/40"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Grille de vidéos */}
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          {videos.length > 0 ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {videos.map((video) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setSelectedVideo(video)}
                    className={`group relative aspect-[16/9] rounded-2xl overflow-hidden border border-[#5C4B40]/10 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer ${selectedVideo?.id === video.id ? 'ring-2 ring-[#5C4B40]/20 shadow-lg' : ''
                      }`}
                  >
                    {video.status === 'done' ? (
                      <>
                        <video
                          src={video.video_url}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          onMouseOver={e => (e.target as HTMLVideoElement).play()}
                          onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <Play size={32} className="text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100" />
                        </div>
                      </>
                    ) : video.status === 'failed' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-red-50/50">
                        <AlertTriangle size={24} className="text-red-400/50" />
                        <span className="text-[10px] font-black uppercase text-red-300">Échec Génération</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#EAE1D3]/10">
                        <div className="relative">
                          <Loader2 size={24} className="text-[#5C4B40]/20 animate-spin" />
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-[#5C4B40]/10 border-t-[#5C4B40]/40 animate-spin"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/30 animate-pulse">Génération en cours...</span>
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(video.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-md rounded-lg text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white z-10 shadow-sm"
                      title="Supprimer la vidéo"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] text-white font-bold uppercase tracking-wider truncate max-w-[70%]">
                        {video.prompt}
                      </div>
                      <div className="bg-white/90 backdrop-blur-md px-1.5 py-1 rounded-lg text-[9px] text-[#5C4B40] font-black uppercase tracking-wider">
                        {video.model === 'grok-video' ? 'Grok' : video.model === 'veo-3.1' ? 'Veo' : video.model?.includes('kling') ? 'Kling' : video.model === 'runway' ? 'Runway' : video.model}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-30">
              <div className="w-20 h-20 rounded-full bg-[#5C4B40]/5 flex items-center justify-center">
                <Video size={40} strokeWidth={1} />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest">Aucune vidéo</p>
                <p className="text-[11px]">Utilisez le panneau à droite pour créer votre première scène.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Colonne DROITE : Configuration */}
      <div className="w-[400px] shrink-0 flex flex-col">
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-[#5C4B40]/10 shadow-sm p-6 overflow-y-auto no-scrollbar space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#5C4B40]">Configuration</h2>
            <div className="px-2 py-1 rounded-lg bg-[#EAE1D3]/30 text-[9px] font-black uppercase tracking-wider text-[#5C4B40]/40">
              {activeVideoTab} mode
            </div>
          </div>

          {/* 1. Sélecteur Modèle */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/30 block px-1">MODÈLE</label>
            <div className="relative group">
              <select
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
                disabled={activeVideoTab !== 'create'}
                className="w-full bg-white border border-[#5C4B40]/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-[#5C4B40] appearance-none outline-none focus:border-[#5C4B40]/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="grok-video">Grok Imagine Video (xAI)</option>
                <option value="kling-3.0-standard">Kling 3.0 Standard (Fal.ai)</option>
                <option value="kling-3.0-pro">Kling 3.0 Pro (Fal.ai)</option>
                <option value="veo-3.1">Veo 3.1 (Google)</option>
                <option value="runway">Runway Gen-4 (RunwayML)</option>
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/20 pointer-events-none group-hover:text-[#5C4B40]/40 transition-colors" />
            </div>
          </div>

          {/* 2. Zones d'upload spécifiques au tab */}
          {activeVideoTab === 'create' && (
            <div className="flex gap-4">
              <div
                className={`flex-1 aspect-square rounded-2xl border border-dashed border-[#5C4B40]/15 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#5C4B40]/30 transition-all relative overflow-hidden bg-[#EAE1D3]/5 ${startFramePreview ? 'border-solid border-2 border-[#5C4B40]/20' : ''}`}
                onClick={() => startFrameRef.current?.click()}
              >
                {startFramePreview ? (
                  <>
                    <img src={startFramePreview} className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => clearFile(e, 'start')}
                      className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all backdrop-blur-sm"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon size={20} className="text-[#5C4B40]/20" />
                    <span className="text-[10px] font-bold text-[#5C4B40]/40 uppercase text-center px-2">Image Début</span>
                    <span className="text-[8px] font-black text-[#5C4B40]/20 uppercase">Optionnel</span>
                  </>
                )}
                <input type="file" ref={startFrameRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'start')} />
              </div>
              <div
                className={`flex-1 aspect-square rounded-2xl border border-dashed border-[#5C4B40]/15 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#5C4B40]/30 transition-all relative overflow-hidden bg-[#EAE1D3]/5 ${endFramePreview ? 'border-solid border-2 border-[#5C4B40]/20' : ''}`}
                onClick={() => endFrameRef.current?.click()}
              >
                {endFramePreview ? (
                  <>
                    <img src={endFramePreview} className="w-full h-full object-cover" />
                    <button
                      onClick={(e) => clearFile(e, 'end')}
                      className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all backdrop-blur-sm"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon size={20} className="text-[#5C4B40]/20" />
                    <span className="text-[10px] font-bold text-[#5C4B40]/40 uppercase text-center px-2">Image Fin</span>
                    <span className="text-[8px] font-black text-[#5C4B40]/20 uppercase">Optionnel</span>
                  </>
                )}
                <input type="file" ref={endFrameRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'end')} />
              </div>
            </div>
          )}

          {activeVideoTab === 'edit' && (
            <div
              className={`w-full aspect-video rounded-2xl border border-dashed border-[#5C4B40]/15 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#5C4B40]/30 transition-all relative overflow-hidden bg-[#EAE1D3]/5 ${sourceVideoPreview ? 'border-solid border-2 border-[#5C4B40]/20' : ''}`}
              onClick={() => sourceVideoRef.current?.click()}
            >
              {sourceVideoPreview ? (
                <video src={sourceVideoPreview} className="w-full h-full object-cover" controls />
              ) : (
                <>
                  <Video size={32} className="text-[#5C4B40]/20" />
                  <div className="text-center">
                    <p className="text-[11px] font-black text-[#5C4B40]/50 uppercase tracking-widest">Uploader vidéo à éditer</p>
                    <p className="text-[9px] text-[#5C4B40]/25 font-bold mt-1 uppercase">3–10 secondes recommandées</p>
                  </div>
                </>
              )}
              <input type="file" ref={sourceVideoRef} className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />
            </div>
          )}

          {activeVideoTab === 'motion' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div
                  className={`flex-1 aspect-square rounded-2xl border border-dashed border-[#5C4B40]/15 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#5C4B40]/30 transition-all relative overflow-hidden bg-[#EAE1D3]/5 ${sourceVideoPreview ? 'border-solid' : ''}`}
                  onClick={() => sourceVideoRef.current?.click()}
                >
                  {sourceVideoPreview ? (
                    <video src={sourceVideoPreview} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Video size={20} className="text-[#5C4B40]/20" />
                      <span className="text-[9px] font-black text-[#5C4B40]/40 uppercase text-center px-2">Mouvement</span>
                    </>
                  )}
                  <input type="file" ref={sourceVideoRef} className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />
                </div>
                <div
                  className={`flex-1 aspect-square rounded-2xl border border-dashed border-[#5C4B40]/15 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#5C4B40]/30 transition-all relative overflow-hidden bg-[#EAE1D3]/5 ${characterImagePreview ? 'border-solid' : ''}`}
                  onClick={() => characterImageRef.current?.click()}
                >
                  {characterImagePreview ? (
                    <img src={characterImagePreview} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <User size={20} className="text-[#5C4B40]/20" />
                      <span className="text-[9px] font-black text-[#5C4B40]/40 uppercase text-center px-2">Personnage</span>
                    </>
                  )}
                  <input type="file" ref={characterImageRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'character')} />
                </div>
              </div>

              <div className="bg-[#EAE1D3]/10 p-4 rounded-2xl border border-[#5C4B40]/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-[#5C4B40]/50 uppercase">Origine scène</span>
                  <div className="flex p-1 bg-white/50 rounded-xl border border-[#5C4B40]/10">
                    <button
                      onClick={() => setSceneControlMode('video')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${sceneControlMode === 'video' ? 'bg-[#5C4B40] text-white shadow-md' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
                    >Vidéo</button>
                    <button
                      onClick={() => setSceneControlMode('image')}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${sceneControlMode === 'image' ? 'bg-[#5C4B40] text-white shadow-md' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
                    >Image</button>
                  </div>
                </div>
                <p className="text-[9px] text-[#5C4B40]/30 italic leading-tight uppercase font-bold tracking-tighter">Choisissez d'où provient l'arrière-plan de votre scène finale.</p>
              </div>
            </div>
          )}

          {/* 3. Champ Prompt */}
          <div className="space-y-4">
            <div className="relative">
              <textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                placeholder={activeVideoTab === 'create' ? "Décrivez votre vidéo..." : activeVideoTab === 'edit' ? "Décrivez les changements..." : "Décrivez la scène..."}
                className="w-full bg-white border border-[#5C4B40]/10 rounded-2xl px-5 py-4 text-sm font-light text-[#5C4B40] placeholder:text-[#5C4B40]/30 outline-none focus:border-[#5C4B40]/40 transition-all resize-none h-32 no-scrollbar shadow-inner"
              />

              <div className="absolute bottom-4 left-4 flex gap-2">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${soundEnabled ? 'bg-[#5C4B40]/10 text-[#5C4B40]' : 'bg-transparent text-[#5C4B40]/20'}`}
                >
                  {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />} Son
                </button>
                <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-transparent text-[#5C4B40]/20 hover:text-[#5C4B40]/40 transition-all">
                  <Sparkles size={12} /> Éléments
                </button>
              </div>

              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#5C4B40]/20">Multi-shot</span>
                <button
                  onClick={() => setMultiShot(!multiShot)}
                  className={`w-8 h-4.5 rounded-full relative transition-all duration-300 ${multiShot ? 'bg-[#5C4B40]/40' : 'bg-[#EAE1D3]'}`}
                >
                  <motion.div
                    animate={{ x: multiShot ? 14 : 2 }}
                    className="absolute top-1 left-0 w-2.5 h-2.5 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Style Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5C4B40]/30 block px-1">Style Visuel</label>
            <div className="relative group">
              <select
                value={selectedVideoStyle}
                onChange={(e) => setSelectedVideoStyle(e.target.value)}
                className="w-full bg-white border border-[#5C4B40]/10 rounded-2xl px-4 py-3.5 text-xs font-bold text-[#5C4B40] appearance-none outline-none focus:border-[#5C4B40]/30 transition-all cursor-pointer shadow-sm"
              >
                <optgroup label="Styles Prédéfinis">
                  <option value="none">Aucun (Naturel)</option>
                  <option value="cinematique">🎬 Cinématique</option>
                  <option value="photorealiste">📸 Photoréaliste</option>
                  <option value="pixar">✨ Pixar 3D</option>
                  <option value="illustration-digitale">🎨 Illustration</option>
                  <option value="anime">🎌 Anime / Manga</option>
                  <option value="noir">🌑 Film Noir</option>
                  <option value="retro">📽️ Rétro / VHS</option>
                  <option value="fantasy">🧙 Fantasy</option>
                  <option value="aquarelle">🖌️ Aquarelle</option>
                </optgroup>
                {customStyles.length > 0 && (
                  <optgroup label="Mes Styles">
                    {customStyles.map(s => (
                      <option key={s.id} value={s.id}>⭐ {s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/20 pointer-events-none group-hover:text-[#5C4B40]/40 transition-colors" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="relative group">
              <select
                value={videoDuration}
                onChange={(e) => setVideoDuration(Number(e.target.value))}
                className="w-full bg-white border border-[#5C4B40]/10 rounded-xl px-2 py-2 text-[10px] font-black text-[#5C4B40]/60 uppercase tracking-widest appearance-none outline-none hover:bg-[#EAE1D3]/5 transition-all text-center cursor-pointer"
              >
                {(MODEL_CONFIGS[videoModel]?.durations || MODEL_CONFIGS['grok-video'].durations).map(duration => (
                  <option key={duration} value={duration}>{duration} Sec</option>
                ))}
              </select>
            </div>
            <div className="relative group">
              <select
                value={videoRatio}
                onChange={(e) => setVideoRatio(e.target.value)}
                className="w-full bg-white border border-[#5C4B40]/10 rounded-xl px-2 py-2 text-[10px] font-black text-[#5C4B40]/60 uppercase tracking-widest appearance-none outline-none hover:bg-[#EAE1D3]/5 transition-all text-center cursor-pointer"
              >
                {(MODEL_CONFIGS[videoModel]?.aspectRatios || MODEL_CONFIGS['grok-video'].aspectRatios).map(ratio => (
                  <option key={ratio} value={ratio}>{ratio}</option>
                ))}
              </select>
            </div>
            <div className="relative group">
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value)}
                className="w-full bg-white border border-[#5C4B40]/10 rounded-xl px-2 py-2 text-[10px] font-black text-[#5C4B40]/60 uppercase tracking-widest appearance-none outline-none hover:bg-[#EAE1D3]/5 transition-all text-center cursor-pointer"
              >
                {(MODEL_CONFIGS[videoModel]?.qualities || MODEL_CONFIGS['grok-video'].qualities).map(quality => (
                  <option key={quality} value={quality}>{quality.toUpperCase()} HD</option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Paramètres Avancés Accordion — Fix Bug 6: Connectés à un state */}
          <div className="border-t border-[#5C4B40]/10 pt-4">
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-[#5C4B40]/40 hover:text-[#5C4B40]/60 transition-all"
            >
              <span>Paramètres Avancés</span>
              <motion.div animate={{ rotate: isAdvancedOpen ? 180 : 0 }}>
                <ChevronDown size={14} />
              </motion.div>
            </button>
            <AnimatePresence>
              {isAdvancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-4 space-y-4"
                >
                  {/* Fix Bug 6: Sliders connectés à des states réels */}
                  <div className="flex items-center justify-between px-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#5C4B40]/50 uppercase">Température</span>
                      <span className="text-[9px] text-[#5C4B40]/30">{temperature.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-1/2 accent-[#5C4B40]/40"
                    />
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#5C4B40]/50 uppercase">Style Strength</span>
                      <span className="text-[9px] text-[#5C4B40]/30">{Math.round(styleStrength * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={styleStrength}
                      onChange={(e) => setStyleStrength(parseFloat(e.target.value))}
                      className="w-1/2 accent-[#5C4B40]/40"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 6. Bouton Générer avec Progression */}
          <AnimatePresence mode="wait">
            {!isGenerating ? (
              <motion.button
                key="generate-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                disabled={!videoPrompt.trim() || isGenerating}
                onClick={handleVideoGenerate}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all tracking-[0.2em] font-black uppercase text-xs shadow-lg shadow-[#5C4B40]/10 ${!videoPrompt.trim()
                  ? 'bg-[#EAE1D3] text-[#5C4B40]/20 cursor-not-allowed shadow-none'
                  : 'bg-[#5C4B40]/60 hover:bg-[#5C4B40]/80 text-white hover:scale-[1.02] active:scale-[0.98]'
                  }`}
              >
                GÉNÉRER
                <Plus size={16} />
              </motion.button>
            ) : (
              <motion.div
                key="progress-block"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="w-full space-y-2"
              >
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-medium tracking-widest uppercase text-[#5C4B40]/30">
                    {progress < 30 ? "Initialisation..." :
                      progress < 70 ? "Rendu en cours..." :
                        progress < 95 ? "Finalisation..." : "Presque prêt..."}
                  </span>
                  <span className="text-[10px] font-medium tracking-wider text-[#5C4B40]/35">
                    {progress}%
                  </span>
                </div>

                <div className="w-full h-[3px] bg-[#5C4B40]/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${progress}%`,
                      backgroundColor: progress === 100 ? 'rgba(92, 75, 64, 0.5)' : 'rgba(92, 75, 64, 0.25)'
                    }}
                    transition={{ duration: 0.7, ease: "linear" }}
                    className="h-full rounded-full bg-gradient-to-r from-[#5C4B40]/25 via-[#5C4B40]/40 to-[#5C4B40]/25"
                  />
                </div>

                <button
                  disabled
                  className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-[#5C4B40]/10 text-[#5C4B40]/30 cursor-not-allowed flex items-center justify-center gap-3"
                >
                  <div className="w-3 h-3 border border-[#5C4B40]/20 border-t-[#5C4B40]/50 rounded-full animate-spin" />
                  <span>Génération... {progress}%</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Détail Overlay */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ x: 500, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 500, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 w-[450px] h-full bg-white border-l border-[#5C4B40]/10 shadow-2xl z-[100] p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-[#5C4B40]">Vue Détail</h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-10 h-10 rounded-full hover:bg-[#EAE1D3]/30 flex items-center justify-center transition-all text-[#5C4B40]/40"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
              {selectedVideo.status === 'done' ? (
                <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-[#5C4B40]/10 bg-black shadow-inner">
                  <video src={selectedVideo.video_url} className="w-full h-full" controls autoPlay loop />
                </div>
              ) : (
                <div className="aspect-[16/9] rounded-2xl bg-[#EAE1D3]/10 flex items-center justify-center border border-[#5C4B40]/5">
                  <Loader2 size={32} className="text-[#5C4B40]/20 animate-spin" />
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/20 mb-2 block">Prompt</label>
                  <p className="text-sm font-light text-[#5C4B40] italic leading-relaxed bg-[#EAE1D3]/5 p-4 rounded-2xl">
                    "{selectedVideo.prompt}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#EAE1D3]/5 rounded-2xl space-y-1 border border-[#5C4B40]/5">
                    <span className="text-[9px] font-black uppercase text-[#5C4B40]/20">Modèle</span>
                    <p className="text-xs font-bold text-[#5C4B40] uppercase tracking-wider">{selectedVideo.model}</p>
                  </div>
                  <div className="p-4 bg-[#EAE1D3]/5 rounded-2xl space-y-1 border border-[#5C4B40]/5">
                    <span className="text-[9px] font-black uppercase text-[#5C4B40]/20">Durée</span>
                    <p className="text-xs font-bold text-[#5C4B40] uppercase tracking-wider">{selectedVideo.duration}s</p>
                  </div>
                  <div className="p-4 bg-[#EAE1D3]/5 rounded-2xl space-y-1 border border-[#5C4B40]/5">
                    <span className="text-[9px] font-black uppercase text-[#5C4B40]/20">Ratio</span>
                    <p className="text-xs font-bold text-[#5C4B40] uppercase tracking-wider">{selectedVideo.aspect_ratio}</p>
                  </div>
                  <div className="p-4 bg-[#EAE1D3]/5 rounded-2xl space-y-1 border border-[#5C4B40]/5">
                    <span className="text-[9px] font-black uppercase text-[#5C4B40]/20">Qualité</span>
                    <p className="text-xs font-bold text-[#5C4B40] uppercase tracking-wider">{selectedVideo.quality}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#5C4B40]/10 flex justify-center gap-6">
              {/* Fix Bug 8: Téléchargement réel via fetch + blob */}
              <button
                onClick={() => {
                  if (selectedVideo.status === 'done' && selectedVideo.video_url) {
                    handleDownloadVideo(selectedVideo.video_url, selectedVideo.id)
                  }
                }}
                disabled={selectedVideo.status !== 'done'}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${selectedVideo.status === 'done' ? 'bg-[#5C4B40]/10 text-[#5C4B40] hover:bg-[#5C4B40] hover:text-white shadow-sm cursor-pointer' : 'bg-[#EAE1D3] text-[#5C4B40]/20 cursor-not-allowed'
                  }`}
                title="Télécharger"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => handleDeleteVideo(selectedVideo.id)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl border border-red-400/20 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                title="Supprimer"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
