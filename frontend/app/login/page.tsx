
'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
    const supabase = createClient()
    const router = useRouter()
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    // Load saved credentials on mount
    useEffect(() => {
        const savedEmail = localStorage.getItem('jungle_email')
        const savedPass = localStorage.getItem('jungle_pass')
        if (savedEmail && savedPass) {
            setEmail(savedEmail)
            setPassword(savedPass)
            setRememberMe(true)
        }
    }, [])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                setMessage("Compte créé ! Vérifiez vos emails pour confirmer.")
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error


                // Handle Remember Me
                if (rememberMe) {
                    localStorage.setItem('jungle_email', email)
                    localStorage.setItem('jungle_pass', password)
                } else {
                    localStorage.removeItem('jungle_email')
                    localStorage.removeItem('jungle_pass')
                }

                router.push('/')
            }
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials' ? 'Identifiants invalides' : err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#EAE1D3] flex items-center justify-center p-6 relative overflow-hidden font-sans">

            {/* Soft decorative elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#5C4B40]/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#5C4B40]/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 w-full max-w-lg group"
            >
                {/* Animated LED Border - "Fibre Optique" style */}
                <div className="absolute -inset-[1px] rounded-[2.6rem] overflow-hidden p-[1px]">
                    <div className="absolute inset-[-200%] bg-[conic-gradient(from_0deg,transparent_20%,#5C4B40_50%,transparent_80%)] animate-[spin_3s_linear_infinite]" />
                    <div className="absolute inset-0 bg-[#EAE1D3] rounded-[2.6rem]" /> {/* Mask to keep the border thin */}
                </div>

                {/* Outer Glow */}
                <div className="absolute -inset-[4px] rounded-[2.8rem] bg-[#5C4B40]/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                <div className="relative bg-white/90 backdrop-blur-2xl p-10 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(92,75,64,0.15)] border border-white/50 overflow-hidden">

                    {/* Brand Section */}
                    <div className="flex flex-col items-center mb-10 text-center -mt-24">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="w-[420px] h-[420px] -mb-28 relative"
                        >
                            <img
                                src="/logos/Jungle_studio.png"
                                alt="Jungle Studio"
                                className="w-full h-full object-contain filter drop-shadow-sm"
                            />
                        </motion.div>
                        <h1 className="text-4xl font-light text-[#5C4B40] tracking-[0.2em] uppercase mb-2">
                            Jungle Studio
                        </h1>
                        <p className="text-[#5C4B40]/40 text-[10px] font-bold uppercase tracking-[0.3em]">
                            Intelligence & Créativité
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#5C4B40]/50 uppercase tracking-widest ml-1">E-mail Professionnel</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/30 group-focus-within:text-[#5C4B40] transition-colors" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#FCF9F5] border-none rounded-2xl py-4 pl-12 pr-4 text-[#5C4B40] placeholder-[#5C4B40]/20 focus:ring-2 focus:ring-[#5C4B40]/10 transition-all text-sm shadow-sm"
                                    placeholder="nom@jungle.studio"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[#5C4B40]/50 uppercase tracking-widest ml-1">Mot de passe</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/30 group-focus-within:text-[#5C4B40] transition-colors" size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#FCF9F5] border-none rounded-2xl py-4 pl-12 pr-12 text-[#5C4B40] placeholder-[#5C4B40]/20 focus:ring-2 focus:ring-[#5C4B40]/10 transition-all text-sm shadow-sm"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C4B40]/20 hover:text-[#5C4B40] transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 ml-1">
                            <input
                                type="checkbox"
                                id="rememberMe"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-none bg-[#FCF9F5] text-[#5C4B40] focus:ring-[#5C4B40]/10"
                            />
                            <label htmlFor="rememberMe" className="text-[10px] font-bold text-[#5C4B40]/40 uppercase tracking-widest cursor-pointer select-none">
                                Se souvenir de moi
                            </label>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-medium border border-red-100"
                            >
                                <AlertCircle size={14} />
                                {error}
                            </motion.div>
                        )}

                        {message && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-green-50 text-green-700 p-4 rounded-2xl flex items-center gap-3 text-xs font-medium border border-green-100"
                            >
                                <ShieldCheck size={14} />
                                {message}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#5C4B40] hover:bg-[#4D3F36] text-[#EAE1D3] font-bold py-4 rounded-2xl transition-all shadow-[0_10px_30px_-5px_rgba(92,75,64,0.3)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-[#EAE1D3]/30 border-t-[#EAE1D3] rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>{isSignUp ? 'Créer mon compte' : 'Entrer dans le Studio'}</span>
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }}
                            className="text-[10px] font-black text-[#5C4B40]/40 hover:text-[#5C4B40] uppercase tracking-widest transition-colors underline underline-offset-8 decoration-[#5C4B40]/10"
                        >
                            {isSignUp ? "J'ai déjà un compte" : "Demander une clé d'accès"}
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center invisible group-hover:visible transition-opacity">
                    <p className="text-[#5C4B40]/30 text-[9px] font-bold uppercase tracking-[0.4em]">
                        &copy; 2026 Jungle Studio — Creative Engine by Alioune DIENNA
                    </p>
                </div>
            </motion.div>

            {/* Absolute Footer Positioned at the very bottom of the screen to ensure visibility */}
            <div className="absolute bottom-6 left-0 right-0 text-center z-20">
                <p className="text-[#5C4B40]/30 text-[9px] font-bold uppercase tracking-[0.4em]">
                    &copy; 2026 Jungle Studio — Creative Engine by Alioune DIENNA
                </p>
            </div>
        </div>
    )
}

