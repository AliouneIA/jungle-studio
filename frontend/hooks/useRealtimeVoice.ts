import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'processing' | 'error';

interface RealtimeVoiceState {
    status: VoiceStatus;
    isMuted: boolean;
    error: string | null;
    volume: number;
    assistantVolume: number;
}

export function useRealtimeVoice() {
    const [state, setState] = useState<RealtimeVoiceState>({
        status: 'idle',
        isMuted: false,
        error: null,
        volume: 0,
        assistantVolume: 0
    });

    const socketRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const nextStartTimeRef = useRef(0);
    // Track all active audio sources so we can stop them on interruption
    const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

    const supabase = createClient();

    // --- Stop all currently playing/scheduled audio ---
    const stopAllAudio = useCallback(() => {
        activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (_) { /* already stopped */ }
        });
        activeSourcesRef.current = [];
        audioQueueRef.current = [];
        nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
    }, []);

    // --- Audio Playback Logic ---
    const drainAudioQueue = useCallback(async () => {
        if (isPlayingRef.current) return;
        isPlayingRef.current = true;

        const audioCtx = audioContextRef.current;
        if (!audioCtx) {
            isPlayingRef.current = false;
            return;
        }

        if (audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume();
            } catch (e) {
                console.error("[Audio] Failed to resume AudioContext:", e);
                isPlayingRef.current = false;
                return;
            }
        }

        let chunksPlayed = 0;

        while (audioQueueRef.current.length > 0) {
            const base64Audio = audioQueueRef.current.shift();
            if (!base64Audio) continue;

            try {
                const binaryString = window.atob(base64Audio);
                const len = binaryString.length;
                const bytes = new Int16Array(len / 2);
                for (let i = 0; i < len; i += 2) {
                    bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
                }

                const float32 = new Float32Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) {
                    float32[i] = bytes[i] / 32768.0;
                }

                const buffer = audioCtx.createBuffer(1, float32.length, 24000);
                buffer.getChannelData(0).set(float32);

                // Volume meter
                let sum = 0;
                for (let i = 0; i < float32.length; i += 100) {
                    sum += Math.abs(float32[i]);
                }
                const avg = sum / (float32.length / 100);
                setState(prev => ({ ...prev, assistantVolume: Math.min(avg * 5, 1), status: 'speaking' }));

                const currentTime = audioCtx.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }

                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtx.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;

                // Track this source for potential interruption
                activeSourcesRef.current.push(source);
                source.onended = () => {
                    const idx = activeSourcesRef.current.indexOf(source);
                    if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
                };

                chunksPlayed++;
            } catch (e) {
                console.error("[Audio] Decode Error:", e);
            }
        }

        if (chunksPlayed > 0) {
            console.log(`[Audio] Scheduled ${chunksPlayed} chunks, next at ${nextStartTimeRef.current.toFixed(2)}s`);
        }

        isPlayingRef.current = false;
    }, []);

    // Poll queue
    useEffect(() => {
        const interval = setInterval(() => {
            if (audioQueueRef.current.length > 0) {
                drainAudioQueue();
            } else {
                const audioCtx = audioContextRef.current;
                if (audioCtx && audioCtx.currentTime >= nextStartTimeRef.current && state.status === 'speaking') {
                    setState(prev => ({ ...prev, status: 'listening', assistantVolume: 0 }));
                }
            }
        }, 50);
        return () => clearInterval(interval);
    }, [drainAudioQueue, state.status]);


    // --- Connect ---
    const connect = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, status: 'connecting', error: null }));

            const { data, error } = await supabase.functions.invoke('voice-proxy');
            if (error || !data) throw new Error("Failed to get session token");

            const token = data.value || data.client_secret?.value || data.client_secret;
            if (!token) throw new Error("No client secret found in response");

            const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-realtime`;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass({ sampleRate: 24000 });
            audioContextRef.current = audioCtx;
            nextStartTimeRef.current = 0;

            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }

            const ws = new WebSocket(wsUrl, [
                "realtime",
                `openai-insecure-api-key.${token}`,
            ]);

            ws.onopen = () => {
                console.log("Connected to OpenAI Realtime (gpt-realtime)");
                setState(prev => ({ ...prev, status: 'listening' }));

                ws.send(JSON.stringify({
                    type: "session.update",
                    session: {
                        type: "realtime",
                        audio: {
                            input: {
                                format: { type: "audio/pcm", rate: 24000 },
                                turn_detection: {
                                    type: "server_vad",
                                    threshold: 0.5,
                                    prefix_padding_ms: 300,
                                    silence_duration_ms: 200,
                                    create_response: true,
                                    interrupt_response: true,
                                },
                            },
                            output: {
                                format: { type: "audio/pcm", rate: 24000 },
                                voice: "alloy",
                                speed: 1.0,
                            },
                        },
                    },
                }));

                startMicrophone(ws, audioCtx);
            };

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);

                switch (msg.type) {
                    case 'session.created':
                        console.log("[WS] Session created");
                        break;
                    case 'session.updated':
                        console.log("[WS] Session updated");
                        break;
                    case 'response.output_audio.delta':
                    case 'response.audio.delta':
                        if (msg.delta) {
                            audioQueueRef.current.push(msg.delta);
                        }
                        break;
                    case 'input_audio_buffer.speech_started':
                        console.log("[WS] Speech started - stopping playback");
                        stopAllAudio(); // ← STOP all scheduled sources immediately
                        setState(prev => ({ ...prev, status: 'listening', assistantVolume: 0 }));
                        break;
                    case 'input_audio_buffer.speech_stopped':
                        console.log("[WS] Speech stopped");
                        setState(prev => ({ ...prev, status: 'processing' }));
                        break;
                    case 'response.created':
                        console.log("[WS] Response started");
                        break;
                    case 'response.done':
                        console.log("[WS] Response complete");
                        break;
                    case 'error':
                        console.error("[WS] OpenAI Error:", JSON.stringify(msg, null, 2));
                        setState(prev => ({ ...prev, error: msg.error?.message || 'Unknown error' }));
                        break;
                }
            };

            ws.onerror = (e) => {
                console.error("WebSocket Error", e);
                setState(prev => ({ ...prev, status: 'error', error: 'Connection failed' }));
            };

            ws.onclose = () => {
                console.log("Disconnected");
                setState(prev => ({ ...prev, status: 'idle' }));
                stopMicrophone();
            };

            socketRef.current = ws;

        } catch (e: any) {
            console.error(e);
            setState(prev => ({ ...prev, status: 'error', error: e.message }));
        }
    }, [stopAllAudio]);


    // --- Microphone ---
    const startMicrophone = async (ws: WebSocket, audioCtx: AudioContext) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;

            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const sampleRate = audioCtx.sampleRate;
                const targetSampleRate = 24000;

                const ratio = sampleRate / targetSampleRate;
                const newLength = Math.floor(inputData.length / ratio);
                const pcm16 = new Int16Array(newLength);

                for (let i = 0; i < newLength; i++) {
                    const offset = i * ratio;
                    const index = Math.floor(offset);
                    const decimal = offset - index;
                    const v1 = inputData[index] || 0;
                    const v2 = inputData[index + 1] || v1;
                    const val = v1 + (v2 - v1) * decimal;
                    const s = Math.max(-1, Math.min(1, val));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                let sum = 0;
                for (let i = 0; i < inputData.length; i += 100) sum += Math.abs(inputData[i]);
                const avg = sum / (inputData.length / 100);
                setState(prev => ({ ...prev, volume: Math.min(avg * 5, 1) }));

                let binary = '';
                const bytes = new Uint8Array(pcm16.buffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = window.btoa(binary);

                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: base64
                    }));
                }
            };

            source.connect(processor);
            const mute = audioCtx.createGain();
            mute.gain.value = 0;
            processor.connect(mute);
            mute.connect(audioCtx.destination);
            processorRef.current = processor;
            console.log("[Mic] Started, sample rate:", audioCtx.sampleRate);

        } catch (e) {
            console.error("[Mic] Error:", e);
        }
    };

    const stopMicrophone = () => {
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        processorRef.current?.disconnect();
        if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close();
    };

    const disconnect = useCallback(() => {
        stopAllAudio();
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        stopMicrophone();
        setState(prev => ({ ...prev, status: 'idle', volume: 0, assistantVolume: 0 }));
    }, [stopAllAudio]);

    return { connect, disconnect, state };
}
