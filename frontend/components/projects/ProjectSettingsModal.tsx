'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Folder, Briefcase, Star, Heart, Cloud, Code, Upload, Trash2, ChevronDown, Plus, FileText, ImageIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'

interface Project {
    id: string
    title: string
    icon?: string
    image_url?: string
    instructions?: string
    memory_setting?: string
}

interface ProjectFile {
    id: string
    file_name: string
    file_path: string
    file_type: string
    file_size: number
    created_at: string
}

interface ProjectSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    project: Project | null
    onUpdate: () => void
    onDelete: (id: string) => void
}

const ICONS = [
    { id: 'folder', icon: Folder, label: 'Dossier' },
    { id: 'briefcase', icon: Briefcase, label: 'Travail' },
    { id: 'star', icon: Star, label: 'Favoris' },
    { id: 'heart', icon: Heart, label: 'Perso' },
    { id: 'cloud', icon: Cloud, label: 'Cloud' },
    { id: 'code', icon: Code, label: 'Dev' },
]

export default function ProjectSettingsModal({ isOpen, onClose, project, onUpdate, onDelete }: ProjectSettingsModalProps) {
    const supabase = createClient()

    const [title, setTitle] = useState('')
    const [instructions, setInstructions] = useState('')
    const [selectedIconId, setSelectedIconId] = useState('folder')
    const [memorySetting, setMemorySetting] = useState('default')
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)
    const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const projectFileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (project) {
            setTitle(project.title)
            setInstructions(project.instructions || '')
            setSelectedIconId(project.icon || 'folder')
            setMemorySetting(project.memory_setting || 'default')
            setUploadedImage(project.image_url || null)
        }
    }, [project])

    useEffect(() => {
        if (project?.id) {
            fetchProjectFiles()
        }
    }, [project?.id])

    const fetchProjectFiles = async () => {
        if (!project) return
        const { data, error } = await supabase
            .from('project_files')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching files:', error)
        } else {
            setProjectFiles(data || [])
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !project) return

        setIsUploading(true)
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${project.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('project_files')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            // 2. Create Record via API (Edge Function) or Direct DB Insert
            // Direct Insert since we have RLS
            const { error: dbError } = await supabase
                .from('project_files')
                .insert({
                    project_id: project.id,
                    file_name: file.name,
                    file_path: fileName,
                    file_type: file.type,
                    file_size: file.size
                })

            if (dbError) throw dbError

            fetchProjectFiles()
        } catch (error: any) {
            console.error('Upload error:', error)
            alert('Erreur lors de l\'upload: ' + (error.message || 'Inconnue'))
        } finally {
            setIsUploading(false)
            if (projectFileInputRef.current) projectFileInputRef.current.value = ''
        }
    }

    const handleDeleteFile = async (file: ProjectFile) => {
        if (!confirm(`Supprimer le fichier ${file.file_name} ?`)) return

        try {
            // 1. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from('project_files')
                .remove([file.file_path])

            if (storageError) console.error('Storage delete error:', storageError)

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('project_files')
                .delete()
                .eq('id', file.id)

            if (dbError) throw dbError

            fetchProjectFiles()
        } catch (error: any) {
            console.error('Delete error:', error)
            alert('Erreur: ' + error.message)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setUploadedImage(url)
        }
    }

    const handleSave = async () => {
        if (!project || !title.trim()) return
        setIsSaving(true)

        const { error } = await supabase
            .from('projects')
            .update({
                title,
                instructions,
                icon: selectedIconId,
                image_url: uploadedImage,
                memory_setting: memorySetting,
                updated_at: new Date().toISOString()
            })
            .eq('id', project.id)

        setIsSaving(false)
        if (error) {
            console.error('Error updating project:', error)
            alert('Erreur lors de la sauvegarde: ' + error.message)
        } else {
            onUpdate()
            onClose()
        }
    }

    const handleDelete = () => {
        if (project && confirm('Supprimer définitivement ce projet ?')) {
            onDelete(project.id)
            onClose()
        }
    }

    if (!project) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="relative bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-800">Paramètres du projet</h2>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            {/* Project Name */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-700">Nom du projet</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors shrink-0 overflow-hidden"
                                    >
                                        {uploadedImage ? (
                                            <img src={uploadedImage} alt="icon" className="w-full h-full object-cover" />
                                        ) : (
                                            <Plus size={20} />
                                        )}
                                    </button>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                                        placeholder="Nom du projet"
                                    />
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-700">Instructions</label>
                                <p className="text-xs text-gray-400 italic">L'IA devra suivre les instructions de ce prompt système qui ne s'appliquera que dans ce dossier.</p>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="Par exemple, « Réponds en espagnol. Fais référence à la documentation JavaScript la plus récente. Fournis des réponses courtes et ciblées. »"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm min-h-[120px] resize-none"
                                />
                            </div>

                            {/* Files */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-semibold text-gray-700">Fichiers ({projectFiles.length})</label>
                                    <button
                                        onClick={() => projectFileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="px-4 py-1.5 bg-gray-50 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-full transition-all border border-gray-200 disabled:opacity-50"
                                    >
                                        {isUploading ? 'Ajout...' : 'Ajouter'}
                                    </button>
                                    <input
                                        ref={projectFileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </div>

                                {projectFiles.length === 0 ? (
                                    <div
                                        onClick={() => projectFileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                            <Plus size={24} />
                                        </div>
                                        <p className="text-sm text-gray-500 max-w-[280px]">
                                            Ajoutez des documents, code, ou images. <span className="font-bold text-gray-700">{title}</span> pourra les utiliser comme contexte.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 no-scrollbar">
                                        {projectFiles.map(file => (
                                            <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl group hover:border-blue-200 transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-gray-100 text-gray-400">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium text-gray-700 truncate">{file.file_name}</span>
                                                        <span className="text-[10px] text-gray-400 flex gap-2">
                                                            {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteFile(file)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Memory */}
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-gray-700">Mémoire</label>
                                <div className="relative">
                                    <select
                                        value={memorySetting}
                                        onChange={(e) => setMemorySetting(e.target.value)}
                                        className="w-full appearance-none bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-sm"
                                    >
                                        <option value="default">Par défaut</option>
                                        <option value="active">Activée</option>
                                        <option value="disabled">Désactivée</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                <p className="text-[10px] text-gray-400 leading-relaxed">
                                    Le projet peut accéder à des éléments mémorisés provenant de chats extérieurs, et vice versa. Ceci ne peut être modifié.
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-6 flex flex-col gap-4">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !title.trim()}
                                    className="w-full py-4 bg-gray-800 hover:bg-black text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                                >
                                    {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="w-full py-4 text-red-500 font-bold rounded-2xl border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all text-sm"
                                >
                                    Supprimer le projet
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
