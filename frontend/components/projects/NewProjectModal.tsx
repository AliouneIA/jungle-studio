'use client'

import React, { useState, useRef } from 'react'
import { X, Folder, Briefcase, Star, Heart, Cloud, Code, Upload, Image as ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface NewProjectModalProps {
    isOpen: boolean
    onClose: () => void
    onCreate: (title: string, icon: any, image?: string) => void
}

const ICONS = [
    { id: 'folder', icon: Folder, label: 'Dossier' },
    { id: 'briefcase', icon: Briefcase, label: 'Travail' },
    { id: 'star', icon: Star, label: 'Favoris' },
    { id: 'heart', icon: Heart, label: 'Perso' },
    { id: 'cloud', icon: Cloud, label: 'Cloud' },
    { id: 'code', icon: Code, label: 'Dev' },
]

export default function NewProjectModal({ isOpen, onClose, onCreate }: NewProjectModalProps) {
    const [title, setTitle] = useState('')
    const [selectedIconId, setSelectedIconId] = useState('folder')
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setUploadedImage(url)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        onCreate(title, selectedIconId, uploadedImage || undefined)

        // Reset
        setTitle('')
        setUploadedImage(null)
        setSelectedIconId('folder')
        onClose()
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        // Beige Background (#EAE1D3) with Taupe Border (#c1b2a2)
                        className="relative bg-[#EAE1D3] border border-[#c1b2a2] rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden"
                    >
                        {/* Background Glow (White for lightness) */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-white/40 blur-[50px] pointer-events-none" />

                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-[#3E3B36]">Nouveau Projet</h2>
                                <button onClick={onClose} className="p-2 text-[#3E3B36]/50 hover:text-[#3E3B36] rounded-full hover:bg-[#3E3B36]/5 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Title Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#3E3B36]/70 uppercase tracking-wider">Titre du projet</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ex: Marketing Campagne 2024"
                                        className="w-full bg-white/50 border border-[#c1b2a2]/30 rounded-lg p-3 text-[#3E3B36] placeholder-[#3E3B36]/30 focus:outline-none focus:border-[#c1b2a2] focus:ring-1 focus:ring-[#c1b2a2] transition-all"
                                        autoFocus
                                    />
                                </div>

                                {/* Icon / Image Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-[#3E3B36]/70 uppercase tracking-wider">Icône ou Image</label>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Predefined Icons */}
                                        <div className="col-span-2 grid grid-cols-6 gap-2">
                                            {ICONS.map(({ id, icon: Icon }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => { setSelectedIconId(id); setUploadedImage(null) }}
                                                    className={`p-2 rounded-lg flex items-center justify-center transition-all ${selectedIconId === id && !uploadedImage
                                                        ? 'bg-[#c1b2a2] text-white shadow-lg scale-105'
                                                        : 'bg-white/50 text-[#3E3B36]/60 hover:bg-white/80'}`}
                                                >
                                                    <Icon size={20} />
                                                </button>
                                            ))}
                                        </div>

                                        {/* Image Upload */}
                                        <div className="col-span-2">
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${uploadedImage
                                                    ? 'border-[#c1b2a2] bg-[#c1b2a2]/10'
                                                    : 'border-[#c1b2a2]/30 hover:border-[#c1b2a2] hover:bg-white/50'}`}
                                            >
                                                {uploadedImage ? (
                                                    <div className="relative w-16 h-16 mb-2">
                                                        <img src={uploadedImage} alt="Preview" className="w-full h-full object-cover rounded-lg shadow-sm" />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                                                            <span className="text-xs text-white">Changer</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload size={24} className="text-[#c1b2a2] mb-2" />
                                                        <span className="text-xs text-[#3E3B36]/60">Charger une image (PNG, JPG)</span>
                                                    </>
                                                )}
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleFileChange}
                                                    className="hidden"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={!title.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-[#c1b2a2] to-[#8C847B] text-white font-bold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all"
                                >
                                    Créer le dossier
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
