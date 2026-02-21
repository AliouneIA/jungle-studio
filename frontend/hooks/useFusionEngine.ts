// frontend/hooks/useFusionEngine.ts
import { useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'


export type FusionStatus = 'idle' | 'analyzing' | 'fusing' | 'cross-analysis' | 'refining' | 'synthesizing' | 'complete' | 'error'
export type FusionMode = 'fusion' | 'supernova' | 'image' | 'manus'

export interface RawResponse {
    slug: string
    content: string
    status: 'success' | 'failed'
    error?: string
    tokens?: number
    image_url?: string
}

export interface Exchange {
    from: string
    to: string
    type: 'analysis'
}

export interface FusionPhases {
    initial: { slug: string, content: string, tokens?: number }[]
    crossAnalysis: { slug: string, content: string, tokens?: number, analyzedBy: string[] }[]
    refinement: { slug: string, content: string, tokens?: number }[]
    synthesis: { masterSlug: string, content: string, tokens?: number, fact_check_report?: any } | null
}

export interface FusionResult {
    run_id?: string
    fusion_mode: FusionMode
    fusion: string
    raw_responses: RawResponse[]
    phases: FusionPhases
    exchanges: Exchange[]
    token_usage: { total: number }
    conversation_id?: string
    api_calls: number
}

// Type pour les messages d'historique
// On envoie l'historique au backend pour que le LLM ait le contexte
// de toute la conversation, pas juste le dernier message
export interface HistoryMessage {
    role: 'user' | 'assistant'
    content: string
}

export function useFusionEngine() {
    const supabase = createClient()

    const [status, setStatus] = useState<FusionStatus>('idle')
    const [fusionMode, setFusionMode] = useState<FusionMode>('fusion')
    const [result, setResult] = useState<string | null>(null)
    const [rawResponses, setRawResponses] = useState<RawResponse[]>([])
    const [phases, setPhases] = useState<FusionPhases | null>(null)
    const [exchanges, setExchanges] = useState<Exchange[]>([])
    const [tokenUsage, setTokenUsage] = useState<number>(0)
    const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0)
    const [error, setError] = useState<string | null>(null)
    const currentRequestId = useRef(0)

    const stop = () => {
        currentRequestId.current += 1
        setStatus('idle')
        setFusionMode('fusion')
    }

    // Mode Fusion / Supernova
    // history = les messages précédents de la conversation
    // On les envoie au backend pour que le LLM ait le contexte complet
    const runFusion = async (
        prompt: string,
        modelSlugs: string[],
        masterModel: string = 'gpt-5.2',
        mode: FusionMode = 'fusion',
        conversationId?: string,
        projectId?: string,
        history: HistoryMessage[] = [],
        webVerify: boolean = false,
        forceJson: boolean = false
    ): Promise<FusionResult> => {
        const requestId = ++currentRequestId.current
        setStatus('analyzing')
        setError(null)
        setResult(null)
        setRawResponses([])
        setPhases(null)
        setExchanges([])
        setFusionMode(mode)

        // Fallback: Si le prompt est vide, essayer de le récupérer depuis l'historique
        let effectivePrompt = prompt
        if (!effectivePrompt || effectivePrompt.trim() === '') {
            console.warn('⚠️ runFusion: prompt vide, tentative de récupération depuis l\'historique')
            effectivePrompt = history.filter(m => m.role === 'user').pop()?.content || ''
        }

        if (!effectivePrompt || effectivePrompt.trim() === '') {
            const errorMsg = 'runFusion: Prompt manquant (vide après fallback)'
            console.error('❌', errorMsg)
            setError(errorMsg)
            setStatus('complete')
            throw new Error(errorMsg)
        }

        try {
            if (mode === 'supernova') {
                setTimeout(() => { if (currentRequestId.current === requestId) setStatus('cross-analysis') }, 1500)
                setTimeout(() => { if (currentRequestId.current === requestId) setStatus('refining') }, 4000)
                setTimeout(() => { if (currentRequestId.current === requestId) setStatus('synthesizing') }, 7000)
            } else {
                setStatus('fusing')
            }

            const { data, error } = await supabase.functions.invoke('fusion-run', {
                body: {
                    prompt: effectivePrompt,
                    model_slugs: modelSlugs,
                    master_model_slug: masterModel,
                    fusion_mode: mode,
                    conversation_id: conversationId,
                    project_id: projectId,
                    history: history,
                    web_verify: webVerify,
                    forceJson: forceJson
                }
            })

            if (currentRequestId.current !== requestId) return { fusion: '', raw_responses: [], phases: null as any, exchanges: [], token_usage: { total: 0 }, api_calls: 0, fusion_mode: mode }

            if (error) throw error

            console.log('🔍 Réponse fusion-run:', JSON.stringify(data, null, 2))

            setRawResponses(data.raw_responses || [])
            setPhases(data.phases || null)
            setExchanges(data.exchanges || [])
            setTokenUsage(data.token_usage?.total || 0)
            setTotalTokensUsed(prev => prev + (data.token_usage?.total || 0))
            setResult(data.fusion)
            setStatus('complete')

            setTimeout(() => { if (currentRequestId.current === requestId) setStatus('idle') }, 5000)

            return data as FusionResult

        } catch (err: any) {
            console.error("Fusion Error:", err)
            setError(err.message)
            setStatus('complete')
            setTimeout(() => setStatus('idle'), 3000)
            throw err
        }
    }

    // Mode Image Generation (pas besoin d'historique pour les images)
    const runImageGen = async (prompt: string, modelSlug: string, conversationId?: string, projectId?: string, imageCount: number = 1) => {
        const requestId = ++currentRequestId.current
        setStatus('analyzing')
        setError(null)
        setResult(null)
        setRawResponses([])
        setFusionMode('image')

        // Validation du prompt
        if (!prompt || prompt.trim() === '') {
            const errorMsg = 'runImageGen: Prompt vide'
            console.error('❌', errorMsg)
            setError(errorMsg)
            setStatus('complete')
            throw new Error(errorMsg)
        }

        try {
            const { data, error } = await supabase.functions.invoke('fusion-run', {
                body: {
                    prompt,
                    model_slugs: [modelSlug],
                    master_model_slug: modelSlug,
                    fusion_mode: 'image',
                    conversation_id: conversationId,
                    project_id: projectId,
                    image_count: imageCount
                }
            })

            if (currentRequestId.current !== requestId) return data

            if (error) throw error

            setResult(data.fusion)
            setRawResponses([{ slug: modelSlug, content: data.fusion, status: 'success', image_url: data.image_url }])
            setTokenUsage(data.token_usage?.total || 0)
            setTotalTokensUsed(prev => prev + (data.token_usage?.total || 0))
            setStatus('complete')

            setTimeout(() => { if (currentRequestId.current === requestId) setStatus('idle') }, 3000)
            return data

        } catch (err: any) {
            if (currentRequestId.current === requestId) {
                console.error("Image Gen Error:", err)
                setError(err.message)
                setStatus('complete')
                setTimeout(() => setStatus('idle'), 3000)
            }
            throw err
        }
    }

    const runSolo = async (
        prompt: string,
        modelSlug: string,
        conversationId?: string,
        projectId?: string,
        history: HistoryMessage[] = [],
        webVerify: boolean = false,
        forceJson: boolean = false
    ) => {
        const requestId = ++currentRequestId.current
        setStatus('analyzing')
        setError(null)
        setResult(null)
        setRawResponses([])
        setFusionMode('fusion')

        // Fallback: Si le prompt est vide, essayer de le récupérer depuis l'historique
        let effectivePrompt = prompt
        if (!effectivePrompt || effectivePrompt.trim() === '') {
            console.warn('⚠️ runSolo: prompt vide, tentative de récupération depuis l\'historique')
            effectivePrompt = history.filter(m => m.role === 'user').pop()?.content || ''
        }

        if (!effectivePrompt || effectivePrompt.trim() === '') {
            const errorMsg = 'runSolo: Prompt manquant (vide après fallback)'
            console.error('❌', errorMsg)
            setError(errorMsg)
            setStatus('complete')
            throw new Error(errorMsg)
        }

        try {
            const { data, error } = await supabase.functions.invoke('fusion-run', {
                body: {
                    prompt: effectivePrompt,
                    model_slugs: [modelSlug],
                    master_model_slug: modelSlug,
                    fusion_mode: 'fusion',
                    conversation_id: conversationId,
                    project_id: projectId,
                    history: history,
                    web_verify: webVerify,
                    forceJson: forceJson
                }
            })

            if (currentRequestId.current !== requestId) return data

            if (error) throw error

            setResult(data.fusion)
            setRawResponses([{ slug: modelSlug, content: data.fusion, status: 'success' }])
            setTokenUsage(data.token_usage?.total || 0)
            setTotalTokensUsed(prev => prev + (data.token_usage?.total || 0))
            setStatus('complete')

            setTimeout(() => { if (currentRequestId.current === requestId) setStatus('idle') }, 3000)
            return data

        } catch (err: any) {
            if (currentRequestId.current === requestId) {
                console.error("Solo Error:", err)
                setError(err.message)
                setStatus('complete')
                setTimeout(() => setStatus('idle'), 3000)
            }
            throw err
        }
    }

    // Mode Agent Manus avec polling robuste (contourne le timeout Edge Functions)
    const runManus = async (
        prompt: string,
        conversationId?: string,
        projectId?: string,
        history: HistoryMessage[] = [],
        manusMessageId?: string // ← ID du message placeholder à mettre à jour
    ) => {
        const requestId = ++currentRequestId.current
        setStatus('analyzing')
        setError(null)
        setResult(null)
        setRawResponses([])
        setFusionMode('manus')

        // Fallback: Si le prompt est vide, essayer de le récupérer depuis l'historique
        let effectivePrompt = prompt
        if (!effectivePrompt || effectivePrompt.trim() === '') {
            console.warn('⚠️ runManus: prompt vide, tentative de récupération depuis l\'historique')
            effectivePrompt = history.filter(m => m.role === 'user').pop()?.content || ''
        }

        if (!effectivePrompt || effectivePrompt.trim() === '') {
            const errorMsg = 'runManus: Prompt manquant (vide après fallback)'
            console.error('❌', errorMsg)
            setError(errorMsg)
            setStatus('complete')
            throw new Error(errorMsg)
        }

        try {
            // Nettoyer l'historique : garder uniquement les 10 derniers messages
            // et ne conserver que role et content (exclure les champs Manus)
            const cleanHistory = history.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content
            }))

            // 1. Créer la tâche via l'Edge Function fusion-run
            const { data, error } = await supabase.functions.invoke('fusion-run', {
                body: {
                    prompt: effectivePrompt,
                    fusion_mode: 'manus',
                    conversation_id: conversationId,
                    project_id: projectId,
                    history: cleanHistory  // Utiliser l'historique nettoyé
                }
            })

            if (currentRequestId.current !== requestId) return data
            if (error) throw error

            // Après réception de data depuis fusion-run
            const fusionContent = data.fusion || data.raw_responses?.[0]?.content || ''

            // Détection du format — v121 retourne task_id et task_url directement
            let taskId = data.task_id || data.task?.id
            let taskUrl = data.task_url || data.task?.url

            // Fallback: parser MANUS_TASK::taskId depuis le contenu
            if (!taskId) {
                const manusTaskMatch = fusionContent.match(/^MANUS_TASK::(.+)$/)
                if (manusTaskMatch) {
                    taskId = manusTaskMatch[1]
                }
            }

            // Fallback URL si manquante
            if (taskId && !taskUrl) {
                taskUrl = `https://manus.im/share/${taskId}`
            }

            if (taskId && taskUrl) {
                // Mise à jour immédiate de la base pour persister l'URL et l'ID (évite de perdre la vue live au refresh)
                if (manusMessageId) {
                    supabase.from('messages')
                        .update({
                            manus_task_id: taskId,
                            manus_task_url: taskUrl,
                            manus_status: 'running',
                            is_manus: true,
                            content: '⏳ Manus travaille...'
                        })
                        .eq('id', manusMessageId)
                        .then(({ error }) => {
                            if (error) console.error('Error updating initial Manus task info:', error)
                        })
                }

                // Utilisation de Realtime au lieu du polling
                return new Promise((resolve, reject) => {
                    const channel = supabase
                        .channel(`manus-${taskId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: 'UPDATE',
                                schema: 'public',
                                table: 'messages',
                                filter: `id=eq.${manusMessageId}`
                            },
                            (payload) => {
                                const newMsg = payload.new;

                                // Mise à jour de l'UI pendant la progression
                                if (newMsg.manus_status_text) {
                                    setResult(JSON.stringify({
                                        status: newMsg.manus_status,
                                        taskUrl: taskUrl,
                                        status_text: newMsg.manus_status_text
                                    }))
                                }

                                if (newMsg.manus_status === 'completed') {
                                    const finalContent = newMsg.content
                                    const structured = newMsg.manus_structured

                                    setResult(finalContent)
                                    setRawResponses([{ slug: 'manus-agent', content: finalContent, status: 'success' }])
                                    setStatus('complete')

                                    setTimeout(() => { if (currentRequestId.current === requestId) setStatus('idle') }, 3000)

                                    supabase.removeChannel(channel)
                                    resolve({
                                        mode: 'manus',
                                        status: 'completed',
                                        task: { id: taskId, url: taskUrl },
                                        extracted_content: finalContent,
                                        structured: structured
                                    })
                                }

                                if (newMsg.manus_status === 'failed') {
                                    setResult('❌ Manus a échoué')
                                    setStatus('complete')
                                    setTimeout(() => { if (currentRequestId.current === requestId) setStatus('idle') }, 3000)
                                    supabase.removeChannel(channel)
                                    reject(new Error('Manus a échoué'))
                                }
                            }
                        )
                        .subscribe()

                    // Timeout de sécurité (10 minutes)
                    setTimeout(() => {
                        supabase.removeChannel(channel)
                        reject(new Error('Timeout : La tâche Manus prend trop de temps.'))
                    }, 600000)
                })
            }

            // Fallback si ce n'est pas une tâche Manus
            setResult(fusionContent)
            setRawResponses([{ slug: 'manus-agent', content: fusionContent, status: 'success' }])
            setStatus('complete')
            return { mode: 'manus', status: 'completed', extracted_content: fusionContent }

        } catch (err: any) {
            if (currentRequestId.current === requestId) {
                console.error("Manus Error:", err)
                setError(err.message)
                setStatus('complete')
                setResult(`❌ Erreur Manus : ${err.message}`)
                setTimeout(() => { if (currentRequestId.current === requestId) setStatus('idle') }, 3000)
            }
            throw err
        }
    }

    const resetTokenUsage = () => setTotalTokensUsed(0)

    return {
        runFusion,
        runSolo,
        runImageGen,
        runManus,
        stop,
        resetTokenUsage,
        status,
        fusionMode,
        result,
        rawResponses,
        phases,
        exchanges,
        tokenUsage,
        totalTokensUsed,
        error
    }
}