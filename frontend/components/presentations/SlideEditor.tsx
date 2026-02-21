/* cspell:ignore evented linethrough qwen inpainting detourage */
'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'

interface SlideElement {
  id: string
  type: 'text' | 'image' | 'shape'
  x: number
  y: number
  width: number
  height: number
  content?: string
  src?: string
  style?: {
    fontSize?: number
    fontWeight?: string
    fontFamily?: string
    color?: string
    align?: string
    backgroundColor?: string
    borderRadius?: number
    opacity?: number
  }
  rotation?: number
  zIndex?: number
}

interface Slide {
  id: string
  background: string
  backgroundImage?: string
  elements: SlideElement[]
  notes?: string
  hidden?: boolean
}

interface SlideEditorProps {
  slides: Slide[]
  onSave: (slides: Slide[]) => void
  onClose: () => void
}

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 540  // 16:9

// Sous-composant pour le menu contextuel
const ContextMenuItem = ({ icon, label, shortcut, onClick, disabled }: {
  icon: string, label: string, shortcut?: string, onClick?: () => void, disabled?: boolean
}) => (
  <button
    onClick={(e) => { e.preventDefault(); if (!disabled && onClick) onClick(); }}
    disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '8px 16px',
      background: 'transparent', border: 'none', cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'Avenir, sans-serif', fontSize: 13, color: disabled ? 'rgba(92,75,64,0.3)' : '#5C4B40',
      transition: 'background 0.15s', textAlign: 'left'
    }}
    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(92,75,64,0.04)' }}
    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </span>
    {shortcut && (
      <span style={{
        fontSize: 10, color: 'rgba(92,75,64,0.35)',
        background: 'rgba(92, 75, 64, 0.04)', padding: '2px 8px',
        borderRadius: 4, fontWeight: 700
      }}>{shortcut}</span>
    )}
  </button>
)

export default function SlideEditor({ slides, onSave, onClose }: SlideEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null)
  const [editingSlides, setEditingSlides] = useState<Slide[]>(JSON.parse(JSON.stringify(slides)))
  const [backgroundLocked, setBackgroundLocked] = useState(true)
  const [isDecomposing, setIsDecomposing] = useState(false)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [showRemoveBgMenu, setShowRemoveBgMenu] = useState(false)
  const [removeBgPrompt, setRemoveBgPrompt] = useState('')
  const [removeObjectPrompt, setRemoveObjectPrompt] = useState('')
  const [selectedTextObj, setSelectedTextObj] = useState<any>(null)
  const [recentColors, setRecentColors] = useState<string[]>(['#000000', '#FFFFFF', '#5C4B40', '#E53E3E', '#3182CE'])
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [zoom, setZoom] = useState(100)
  const [viewMode, setViewMode] = useState<'editor' | 'pages'>('editor')
  const [slideMenuOpen, setSlideMenuOpen] = useState<number | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [showMoreTextMenu, setShowMoreTextMenu] = useState(false)
  const [groupOpenAjouter, setGroupOpenAjouter] = useState(true)
  const [groupOpenEdition, setGroupOpenEdition] = useState(true)
  const [groupOpenCalques, setGroupOpenCalques] = useState(true)
  const [showShapesMenu, setShowShapesMenu] = useState(false)
  const [clipboardSlide, setClipboardSlide] = useState<Slide | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null)
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number, y: number, visible: boolean }>({ x: 0, y: 0, visible: false })
  const [editorClipboard, setEditorClipboard] = useState<any>(null)
  const [editorClipboardStyle, setEditorClipboardStyle] = useState<any>(null)
  const [showPositionMenu, setShowPositionMenu] = useState(false)
  const editingSlidesRef = useRef(editingSlides)
  const currentSlideIndexRef = useRef(currentSlideIndex)
  const editorClipboardRef = useRef<any>(null)
  const editorClipboardStyleRef = useRef<any>(null)
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const isBatchOperation = useRef(false)
  const isLoadingSlide = useRef(false)

  useEffect(() => {
    editingSlidesRef.current = editingSlides
  }, [editingSlides])

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => {
    editorClipboardRef.current = editorClipboard
  }, [editorClipboard])

  useEffect(() => {
    editorClipboardStyleRef.current = editorClipboardStyle
  }, [editorClipboardStyle])

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  const addNewSlide = () => {
    saveCurrentSlide() // Sauvegarder la slide actuelle avant de changer
    const newSlide: Slide = {
      id: Date.now().toString(),
      background: '#ffffff',
      elements: []
    }
    const newSlides = [...editingSlidesRef.current, newSlide]
    setEditingSlides(newSlides)
    setCurrentSlideIndex(newSlides.length - 1)
    onSave(newSlides)
  }

  const duplicateSlide = (index: number) => {
    saveCurrentSlide() // Sauvegarder la slide actuelle avant de changer
    const slideToCopy = editingSlidesRef.current[index]
    const newSlide: Slide = JSON.parse(JSON.stringify(slideToCopy))
    newSlide.id = Date.now().toString()
    const newSlides = [...editingSlidesRef.current]
    newSlides.splice(index + 1, 0, newSlide)
    setEditingSlides(newSlides)
    setCurrentSlideIndex(index + 1)
    setSlideMenuOpen(null)
    setContextMenuPos(null)
    onSave(newSlides)
  }

  const deleteSlide = (index: number) => {
    if (editingSlides.length <= 1) return
    saveCurrentSlide() // Sauvegarder avant de supprimer/changer
    const newSlides = editingSlidesRef.current.filter((_, i) => i !== index)
    setEditingSlides(newSlides)
    const nextIndex = Math.min(index, newSlides.length - 1)
    setCurrentSlideIndex(nextIndex)
    setSlideMenuOpen(null)
    setContextMenuPos(null)
    onSave(newSlides)
  }

  const copySlide = (index: number) => {
    const slide = editingSlidesRef.current[index]
    if (!slide) return
    setClipboardSlide(JSON.parse(JSON.stringify(slide)))
    setContextMenuPos(null)
  }

  const pasteSlide = (index: number) => {
    if (!clipboardSlide) return
    saveCurrentSlide() // Sauvegarder avant de changer
    const newSlide: Slide = JSON.parse(JSON.stringify(clipboardSlide))
    newSlide.id = Date.now().toString()
    const newSlides = [...editingSlidesRef.current]
    newSlides.splice(index + 1, 0, newSlide)
    setEditingSlides(newSlides)
    setCurrentSlideIndex(index + 1)
    setContextMenuPos(null)
    onSave(newSlides)
  }

  const copySlideStyle = (index: number) => {
    const slide = editingSlidesRef.current[index]
    if (!slide) return
    setEditorClipboardStyle({
      background: slide.background,
      backgroundImage: slide.backgroundImage,
      isSlideStyle: true
    })
    setContextMenuPos(null)
  }

  const pasteSlideStyle = (index: number) => {
    const style = editorClipboardStyleRef.current
    if (!style || !style.isSlideStyle) return
    const newSlides = [...editingSlides]
    newSlides[index] = {
      ...newSlides[index],
      background: style.background,
      backgroundImage: style.backgroundImage
    }
    setEditingSlides(newSlides)
    onSave(newSlides)

    // Si on colle sur la slide actuelle, recharger le canvas
    if (index === currentSlideIndex) {
      loadSlide(index)
    }
    setContextMenuPos(null)
  }

  const toggleHideSlide = (index: number) => {
    setEditingSlides(prev => {
      const newSlides = prev.map((s, i) =>
        i === index ? { ...s, hidden: !s.hidden } : s
      )
      onSave(newSlides)
      return newSlides
    })
    setContextMenuPos(null)
  }

  const defaultColors = [
    '#000000', '#545454', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff',
    '#ff0000', '#ff5757', '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb', '#0038ff',
    '#38b6ff', '#5271ff', '#00c2cb', '#0d6efd', '#004aad', '#008037',
    '#7ed957', '#c9e265', '#ffde59', '#ffbd59', '#ff914d'
  ]

  const updateRecentColors = (color: string) => {
    setRecentColors(prev => {
      const withoutCurrent = prev.filter(c => c.toLowerCase() !== color.toLowerCase())
      return [color, ...withoutCurrent].slice(0, 5)
    })
  }

  // Fonctions de manipulation Canvas (définies avant useEffect pour les raccourcis)
  const copySelected = async () => {
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active) return
    try {
      const cloned = await active.clone()
      setEditorClipboard(cloned)
    } catch (e) {
      console.error('[Editor] Copy error:', e)
    }
    setCanvasContextMenu(prev => ({ ...prev, visible: false }))
  }

  const pasteFromClipboard = async () => {
    const canvas = fabricRef.current
    const clip = editorClipboardRef.current
    if (!canvas || !clip) return
    try {
      const cloned = await clip.clone()
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        evented: true,
        selectable: true
      })

      if (cloned.type === 'activeSelection') {
        cloned.canvas = canvas
        cloned.forEachObject((obj: any) => canvas.add(obj))
        cloned.setCoords()
      } else {
        canvas.add(cloned)
      }

      canvas.setActiveObject(cloned)
      canvas.renderAll()
    } catch (e) {
      console.error('[Editor] Paste error:', e)
    }
    setCanvasContextMenu(prev => ({ ...prev, visible: false }))
  }

  const copyStyle = () => {
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active) return
    setEditorClipboardStyle({
      fill: active.fill,
      fontFamily: (active as any).fontFamily,
      fontSize: (active as any).fontSize,
      fontWeight: (active as any).fontWeight,
      fontStyle: (active as any).fontStyle,
      underline: (active as any).underline,
      linethrough: (active as any).linethrough,
      textAlign: (active as any).textAlign,
      opacity: active.opacity,
      stroke: active.stroke,
      strokeWidth: active.strokeWidth,
      shadow: active.shadow
    })
    setCanvasContextMenu(prev => ({ ...prev, visible: false }))
  }

  const pasteStyle = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    const style = editorClipboardStyleRef.current
    if (!active || !style) return
    Object.keys(style).forEach(key => {
      if (style[key] !== undefined) {
        active.set(key as any, style[key])
      }
    })
    canvas.renderAll()
    if (active) canvas.fire('object:modified', { target: active })
    setCanvasContextMenu(prev => ({ ...prev, visible: false }))
  }

  const duplicateSelected = async (e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault()
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || (active as any).isBackground) return

    isBatchOperation.current = true
    try {
      const cloned = await active.clone()
      canvas.discardActiveObject()

      const offset = 20
      cloned.set({
        left: (cloned.left || 0) + offset,
        top: (cloned.top || 0) + offset
      })

      if (cloned.type === 'activeSelection') {
        (cloned as any).canvas = canvas;
        (cloned as any).forEachObject((obj: any) => {
          canvas.add(obj)
        })
        cloned.setCoords()
      } else {
        canvas.add(cloned)
      }

      canvas.setActiveObject(cloned)
      canvas.renderAll()
      saveState()
      saveCurrentSlide()
    } catch (err) {
      console.error('[Editor] Duplication error:', err)
    } finally {
      isBatchOperation.current = false
    }
  }

  const deleteSelected = (e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault()
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (!active || (active as any).isBackground) return

    isBatchOperation.current = true
    if (active.type === 'activeSelection') {
      (active as any).forEachObject((obj: any) => {
        canvas.remove(obj)
      })
      canvas.discardActiveObject()
    } else {
      canvas.remove(active)
    }

    canvas.renderAll()
    saveState()
    saveCurrentSlide()
    isBatchOperation.current = false
  }

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true
    })

    fabricRef.current = canvas

    // Configurer le style de sélection "Classe" (Style Figma/Design Premium)
    const selectionColor = '#8B5CF6' // Un beau violet indigo moderne et "classe"

    canvas.selectionColor = 'rgba(139, 92, 246, 0.1)' // Fond du lasso très léger
    canvas.selectionBorderColor = selectionColor     // Bordure du lasso
    canvas.selectionLineWidth = 1

    // Style global des objets sélectionnés
    fabric.Object.prototype.transparentCorners = false
    fabric.Object.prototype.cornerColor = '#FFFFFF'
    fabric.Object.prototype.cornerStrokeColor = selectionColor
    fabric.Object.prototype.cornerStyle = 'circle'    // Cercles pour un look plus moderne
    fabric.Object.prototype.cornerSize = 10           // Taille équilibrée
    fabric.Object.prototype.borderColor = selectionColor
    // @ts-ignore
    fabric.Object.prototype.borderDashArray = null    // Ligne solide
    fabric.Object.prototype.borderScaleFactor = 1.2
    fabric.Object.prototype.padding = 10              // Espace pour ne pas coller à l'objet

    // Style spécifique pour les contrôles (rotation handle)
    // @ts-ignore
    if (fabric.Object.prototype.controls && fabric.Object.prototype.controls.mtr) {
      // @ts-ignore
      fabric.Object.prototype.controls.mtr.withConnection = true
      // @ts-ignore
      fabric.Object.prototype.controls.mtr.offset = -40 // Écarter le bouton de rotation
    }

    // Événements
    // Événements pour la sauvegarde automatique
    const handleCanvasModification = () => {
      console.log('[Editor] handleCanvasModification, isLoading:', isLoadingSlide.current, 'isBatch:', isBatchOperation.current)
      if (isLoadingSlide.current || isBatchOperation.current) return
      saveState()
      saveCurrentSlide()
    }

    canvas.on('object:modified', handleCanvasModification)
    canvas.on('object:added', handleCanvasModification)
    canvas.on('object:removed', handleCanvasModification)

    // Menu contextuel sur le canvas
    const canvasEl = (canvas as any).upperCanvasEl || (canvas as any).getElement()

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = canvasEl.getBoundingClientRect()
      setCanvasContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        visible: true
      })
    }

    canvasEl.addEventListener('contextmenu', handleContextMenu)

    const handleGlobalClick = () => {
      setCanvasContextMenu(prev => ({ ...prev, visible: false }))
    }
    document.addEventListener('click', handleGlobalClick)

    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0] || null
      setSelectedObject(obj)

      // Mettre à jour l'état du verrou si c'est le background
      if (obj && (obj as any).isBackground) {
        setBackgroundLocked(obj.selectable === false)
      }

      // Contextual Text Toolbar
      if (obj && (obj.type === 'i-text' || obj.type === 'textbox')) {
        setSelectedTextObj(obj)
      } else {
        setSelectedTextObj(null)
      }
    })
    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0] || null
      setSelectedObject(obj)

      if (obj && (obj as any).isBackground) {
        setBackgroundLocked(obj.selectable === false)
      }

      if (obj && (obj.type === 'i-text' || obj.type === 'textbox')) {
        setSelectedTextObj(obj)
      } else {
        setSelectedTextObj(null)
      }
    })
    canvas.on('selection:cleared', () => {
      setSelectedObject(null)
      setBackgroundLocked(true) // Reset par défaut
      setSelectedTextObj(null)
      setShowPropertiesPanel(false)
      setShowColorPicker(false)
      setSlideMenuOpen(null)
      setShowNotes(false)
    })

    // Load current slide (uses ref to get latest index after state update)
    loadSlide(currentSlideIndexRef.current)

    // Raccourcis clavier
    const handleKeyDown = (e: KeyboardEvent) => {
      // Éviter les raccourcis pendant l'édition de texte
      if (isEditing()) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected(e)
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        duplicateSelected(e)
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelected(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteFromClipboard(); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copySlide(currentSlideIndexRef.current); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSlide(currentSlideIndexRef.current); }
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyStyle(); }
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteStyle(); }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      canvas.dispose()
      window.removeEventListener('keydown', handleKeyDown)
      canvasEl.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', handleGlobalClick)
    }
  }, [currentSlideIndex])

  const isEditing = () => {
    const obj = fabricRef.current?.getActiveObject()
    return obj && (obj as any).isEditing
  }

  // Toggle Background Lock
  const toggleBackgroundLock = () => {
    const canvas = fabricRef.current
    if (!canvas) return

    // Trouver l'image de fond
    const bgImage = canvas.getObjects().find((obj) => (obj as any).isBackground === true)

    if (!bgImage) return

    const newLocked = !backgroundLocked
    setBackgroundLocked(newLocked)

    bgImage.set({
      selectable: !newLocked,
      evented: !newLocked,
      hoverCursor: newLocked ? 'default' : 'move',
      hasControls: !newLocked,
      hasBorders: !newLocked,
      lockMovementX: newLocked,
      lockMovementY: newLocked
    })

    if (!newLocked) {
      canvas.setActiveObject(bgImage)
    } else {
      canvas.discardActiveObject()
    }

    canvas.renderAll()
  }

  // Fonction de décomposition par IA
  const decomposeCurrentSlide = async () => {
    console.log('[Editor] === Décomposer cliqué ===')
    console.log('[Editor] Slide actuelle:', currentSlideIndex)
    const currentSlide = editingSlides[currentSlideIndex]
    console.log('[Editor] backgroundImage:', currentSlide?.backgroundImage ? currentSlide.backgroundImage.substring(0, 80) + '...' : 'AUCUNE')

    const canvas = fabricRef.current
    if (!canvas) {
      console.error('[Editor] Canvas non initialisé dans decomposeCurrentSlide')
      return
    }

    if (!currentSlide.backgroundImage) {
      console.warn('[Editor] Aucune image de fond à décomposer pour la slide', currentSlideIndex)
      return
    }

    setIsDecomposing(true)

    try {
      console.log('[Editor] 🚀 DÉBUT DÉCOMPOSITION')
      console.log('[Editor] Slide ID:', currentSlideIndex)
      console.log('[Editor] Image URL:', currentSlide.backgroundImage)

      const statusResult = await decomposeSlideLayers(currentSlide.backgroundImage, 6)
      console.log('[Editor] RÉPONSE COMPLÈTE DU POLLING:', JSON.stringify(statusResult, null, 2))

      // Essayer différentes structures de réponse
      const layers = statusResult.layers
        || statusResult.raw?.layers
        || statusResult.raw?.output?.layers
        || statusResult.raw?.output?.images
        || statusResult.raw?.images
        || statusResult.response?.layers
        || statusResult.response?.output?.layers
        // Si c'est directement un tableau
        || (Array.isArray(statusResult) ? statusResult : [])
        || []

      console.log('[Editor] ✅ Calques extraits:', layers.length)

      if (layers.length === 0) {
        console.error('[Editor] ❌ Aucun calque reçu, on garde l\'image originale')
        alert('La décomposition n\'a retourné aucun calque. L\'image originale est conservée.')
        setIsDecomposing(false)
        return  // STOP
      }

      // Activer le mode batch pour éviter de sauvegarder à chaque ajout de calque
      isBatchOperation.current = true

      // Supprimer l'image de fond actuelle
      const bgObj = canvas.getObjects().find((obj) => (obj as any).isBackground)
      if (bgObj) {
        console.log('[Editor] Suppression de l\'image de fond originale')
        canvas.remove(bgObj)
      }

      // Charger chaque calque comme objet indépendant
      for (let i = 0; i < layers.length; i++) {
        // ... (boucle inchangée mais traitée)
        const layerUrl = layers[i].url || layers[i].image?.url || layers[i]
        await new Promise<void>((resolve) => {
          const img = document.createElement('img')
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const ImageClass = (fabric as any).FabricImage || fabric.Image
            // @ts-ignore
            const fabricImg = new ImageClass(img, {
              left: 0, top: 0,
              scaleX: CANVAS_WIDTH / img.naturalWidth,
              scaleY: CANVAS_HEIGHT / img.naturalHeight,
              selectable: true, evented: true, hasControls: true, hasBorders: true,
              originX: 'left', originY: 'top'
            })
            fabricImg.set('layerIndex', i)
            canvas.add(fabricImg)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = layerUrl
        })
      }

      isBatchOperation.current = false
      canvas.renderAll()
      saveState()
      saveCurrentSlide()
      console.log('[Editor] ✨ DÉCOMPOSITION TERMINÉE AVEC SUCCÈS')

    } catch (err: any) {
      console.error('[Editor] ❌ ERREUR CRITIQUE DÉCOMPOSITION:', err)
      alert('Erreur lors de la décomposition: ' + (err.message || err))
    } finally {
      setIsDecomposing(false)
    }
  }

  const applyMaskToImage = async (imageUrl: string, maskUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const mask = new Image()
      mask.crossOrigin = 'anonymous'

      let loaded = 0
      const onLoad = () => {
        loaded++
        if (loaded < 2) return

        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = img.width
        tempCanvas.height = img.height
        const ctx = tempCanvas.getContext('2d')!

        // Dessiner l'image
        ctx.drawImage(img, 0, 0)

        // Appliquer le masque en alpha
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(mask, 0, 0, img.width, img.height)

        resolve(tempCanvas.toDataURL('image/png'))
      }

      img.onload = onLoad
      mask.onload = onLoad
      img.src = imageUrl
      mask.src = maskUrl
    })
  }

  const removeBackground = async (prompt: string | null = null, mode: string | null = null) => {
    const canvas = fabricRef.current
    if (!canvas) return

    // Trouver l'image cible : l'objet sélectionné ou l'image de fond
    const activeObj = canvas.getActiveObject()
    let targetImage: any = null
    let targetUrl: string | null = null

    if (activeObj && (activeObj.type === 'image' || activeObj.type === 'FabricImage')) {
      // Objet sélectionné est une image
      targetImage = activeObj
      // Récupérer l'URL source de l'image Fabric
      targetUrl = (activeObj as any).getSrc?.() || (activeObj as any)._element?.src || null
    } else {
      // Sinon utiliser l'image de fond
      targetImage = canvas.getObjects().find((obj: any) => (obj as any).isBackground)
      if (targetImage) {
        targetUrl = (targetImage as any).getSrc?.() || (targetImage as any)._element?.src || null
      }
    }

    if (!targetUrl) {
      alert('Sélectionne une image ou utilise une slide avec une image de fond')
      return
    }

    console.log('[Editor] Suppression/Modification IA:', targetUrl.substring(0, 80), 'Prompt:', prompt, 'Mode:', mode)
    setIsRemovingBg(true)

    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

      // 1. Soumettre à remove-background
      const res = await fetch(
        'https://xrhcaskiudkszbrhuisu.supabase.co/functions/v1/remove-background',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey
          },
          body: JSON.stringify({
            image_url: targetUrl,
            prompt: prompt,
            mode: mode || (prompt ? 'intelligent' : 'automatic')
          })
        }
      )

      const rawText = await res.text()
      let data
      try {
        data = JSON.parse(rawText)
      } catch {
        console.error('[Editor] Non-JSON response:', res.status, rawText.substring(0, 300))
        throw new Error(`Erreur API (${res.status}): ${rawText.substring(0, 200)}`)
      }

      if (!res.ok) {
        console.error('[Editor] API error:', res.status, data)
        throw new Error(`Erreur API ${res.status}: ${JSON.stringify(data)}`)
      }

      let resultImageUrl: string | null = null

      if (data.success && data.image_url) {
        // Résultat direct (Backend v19+ synchrone)
        resultImageUrl = data.image_url
      } else {
        console.error('[Editor] Réponse inattendue remove-bg:', data)
        alert('Erreur: ' + (data.error || 'Réponse inattendue du serveur'))
        return
      }

      if (!resultImageUrl) {
        alert('Erreur: pas d\'image résultante')
        return
      }

      console.log('[Editor] Image sans fond:', resultImageUrl.substring(0, 100))

      // 2. Remplacer l'image dans le canvas
      const imgElement = document.createElement('img')
      imgElement.crossOrigin = 'anonymous'
      imgElement.onload = () => {
        const ImageClass = (fabric as any).FabricImage || fabric.Image
        // @ts-ignore
        const newFabricImg = new ImageClass(imgElement, {
          left: targetImage.left || 0,
          top: targetImage.top || 0,
          scaleX: targetImage.scaleX || 1,
          scaleY: targetImage.scaleY || 1,
          angle: targetImage.angle || 0,
          opacity: targetImage.opacity || 1,
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
          originX: 'left',
          originY: 'top'
        })

        if ((targetImage as any).isBackground) {
          newFabricImg.set('isBackground', true as any)
        }

        // Supprimer l'ancienne image
        canvas.remove(targetImage)
        // Ajouter la nouvelle (sans fond ou éditée)
        canvas.add(newFabricImg)

        // Ne pas sélectionner automatiquement si c'est une suppression d'objet par Gemini
        // ou si c'est le background (pour éviter d'ouvrir le panneau de propriétés)
        if (mode !== 'remove_object' && !newFabricImg.get('isBackground')) {
          canvas.setActiveObject(newFabricImg)
        } else {
          canvas.discardActiveObject()
          setSelectedObject(null)
        }

        canvas.renderAll()
        saveCurrentSlide()
        saveState()

        console.log('[Editor] ✅ Arrière-plan supprimé avec succès')
      }
      imgElement.onerror = () => {
        console.error('[Editor] Erreur chargement image sans fond')
        alert('Erreur de chargement de l\'image')
      }
      imgElement.src = resultImageUrl

    } catch (err) {
      console.error('[Editor] Erreur remove-bg:', err)
      alert('Erreur: ' + (err as Error).message)
    } finally {
      setIsRemovingBg(false)
    }
  }

  // Charger une slide dans le canvas
  const loadSlide = (index: number) => {
    isLoadingSlide.current = true
    console.log('[Editor] === loadSlide appelé ===', index)
    const slide = editingSlidesRef.current[index]
    if (!slide) {
      console.error('[Editor] Slide non trouvée à l\'index', index)
      return
    }
    console.log('[Editor] slide:', JSON.stringify(slide).substring(0, 200))
    console.log('[Editor] backgroundImage:', slide?.backgroundImage ? slide.backgroundImage.substring(0, 80) + '...' : 'AUCUNE')

    const canvas = fabricRef.current
    if (!canvas) {
      console.error('[Editor] Canvas non initialisé dans loadSlide')
      return
    }

    canvas.clear()
    setBackgroundLocked(true)

    // 1. Gérer le fond
    if (slide.backgroundImage) {
      console.log('[Editor] Traitement image de fond:', slide.backgroundImage)

      // Méthode native HTML robuste pour le cross-origin
      const imgElement = document.createElement('img')
      imgElement.crossOrigin = 'anonymous'

      imgElement.onload = () => {
        console.log('[Editor] ✅ Image HTML chargée:', imgElement.naturalWidth, 'x', imgElement.naturalHeight)
        const imgW = imgElement.naturalWidth
        const imgH = imgElement.naturalHeight

        try {
          const ImageClass = (fabric as any).FabricImage || fabric.Image
          // @ts-ignore
          const fabricImg = new ImageClass(imgElement, {
            left: 0,
            top: 0,
            scaleX: CANVAS_WIDTH / imgW,
            scaleY: CANVAS_HEIGHT / imgH,
            selectable: false,       // Verrouillé par défaut
            evented: false,
            hoverCursor: 'default',
            originX: 'left',
            originY: 'top'
          })

          // Marquer comme image de fond
          fabricImg.set('isBackground', true)

          // S'assurer que l'image est au fond
          canvas.add(fabricImg)
          console.log('[Editor] ✅ FabricImage ajoutée, objets:', canvas.getObjects().length)

          // Envoyer au fond
          const objects = canvas.getObjects()
          if (objects.length > 1) {
            // Utiliser moveTo pour placer à l'index 0
            if ((canvas as any).moveTo) {
              (canvas as any).moveTo(fabricImg, 0)
            } else {
              // Fallback
              canvas.remove(fabricImg);
              (canvas as any)._objects.unshift(fabricImg)
            }
          }

          canvas.renderAll()
          console.log('[Editor] Background inséré et rendu OK')

          // Recharger les éléments par-dessus le fond
          loadElements(slide, canvas)
        } catch (err) {
          console.error('[Editor] ❌ Erreur création FabricImage:', err)
          loadElements(slide, canvas)
        }
      }

      imgElement.onerror = (err) => {
        console.error('[Editor] ❌ Échec chargement background HTML:', err)
        canvas.backgroundColor = slide.background || '#ffffff'
        loadElements(slide, canvas)
      }

      imgElement.src = slide.backgroundImage
    } else {
      console.log('[Editor] Pas d\'image de fond, utilisation couleur:', slide.background || '#ffffff')
      canvas.backgroundColor = slide.background || '#ffffff'
      loadElements(slide, canvas)
    }

    // Fallback: s'assurer que isLoadingSlide repasse à false même en cas d'erreur
    setTimeout(() => {
      if (isLoadingSlide.current) {
        console.warn('[Editor] isLoadingSlide forcé à false (fallback 3s)')
        isLoadingSlide.current = false
      }
    }, 3000)
  }

  // Fonction séparée pour charger les éléments (texte, formes, etc.)
  const loadElements = (slide: Slide, canvas: fabric.Canvas) => {
    // 2. Charger les éléments
    slide.elements.forEach((el) => {
      if (el.type === 'text') {
        const text = new fabric.IText(el.content || 'Texte', {
          left: el.x,
          top: el.y,
          width: el.width,
          fontSize: el.style?.fontSize || 24,
          fontWeight: el.style?.fontWeight || 'normal',
          fontFamily: el.style?.fontFamily || 'Arial',
          fill: el.style?.color || '#000000',
          textAlign: (el.style?.align as any) || 'left',
          angle: el.rotation || 0,
          editable: true
        })
        text.set('elementId' as any, el.id)
        canvas.add(text)
      }

      if (el.type === 'image' && el.src) {
        const ImageClass = (fabric as any).FabricImage || fabric.Image;
        (ImageClass as any).fromURL(el.src, { crossOrigin: 'anonymous' })
          .then((img: fabric.Image) => {
            img.set({
              left: el.x,
              top: el.y,
              angle: el.rotation || 0,
              opacity: el.style?.opacity || 1
            })
            img.scaleToWidth(el.width)
            img.set('elementId' as any, el.id)
            canvas.add(img)
            canvas.renderAll()
          })
          .catch((e: any) => console.error('Image load error', e))
      }

      if (el.type === 'shape') {
        const rect = new fabric.Rect({
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          fill: el.style?.backgroundColor || '#EAE1D3',
          rx: el.style?.borderRadius || 0,
          ry: el.style?.borderRadius || 0,
          angle: el.rotation || 0,
          opacity: el.style?.opacity || 1
        })
        rect.set('elementId' as any, el.id)
        canvas.add(rect)
      }
    })

    canvas.renderAll()
    saveState()
    setTimeout(() => {
      isLoadingSlide.current = false
      console.log('[Editor] isLoadingSlide = false, ready for modifications')
    }, 300)
  }

  // Sauvegarder l'état du canvas dans la slide
  const saveCurrentSlide = (triggerSync = true) => {
    const canvas = fabricRef.current
    if (!canvas) return

    const elements: SlideElement[] = canvas.getObjects().map((obj, i) => {
      // Ignorer le fond (marqué isBackground)
      if ((obj as any).isBackground) return null

      const base = {
        id: (obj as any).elementId || crypto.randomUUID(),
        x: Math.round(obj.left || 0),
        y: Math.round(obj.top || 0),
        width: Math.round((obj.width || 100) * (obj.scaleX || 1)),
        height: Math.round((obj.height || 100) * (obj.scaleY || 1)),
        rotation: Math.round(obj.angle || 0),
        zIndex: i
      }

      if (obj.type === 'i-text' || obj.type === 'text') {
        return {
          ...base,
          type: 'text' as const,
          content: (obj as fabric.IText).text || '',
          style: {
            fontSize: (obj as any).fontSize,
            fontWeight: (obj as any).fontWeight,
            fontFamily: (obj as any).fontFamily,
            color: (obj as any).fill,
            align: (obj as any).textAlign
          }
        }
      }

      if (obj.type === 'image') {
        return {
          ...base,
          type: 'image' as const,
          src: (obj as fabric.Image).getSrc()
        }
      }

      return {
        ...base,
        type: 'shape' as const,
        style: {
          backgroundColor: (obj as any).fill,
          borderRadius: (obj as any).rx || 0,
          opacity: obj.opacity
        }
      }
    }).filter(Boolean) as SlideElement[]

    setEditingSlides(prev => {
      const updatedSlides = prev.map((s, i) =>
        i === currentSlideIndexRef.current ? { ...s, elements } : s
      )
      if (triggerSync) {
        onSave(updatedSlides)
      }
      return updatedSlides
    })
  }

  // Historique (Undo/Redo)
  const saveState = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    // Sauvegarder uniquement les objets NON-background
    const objects = canvas.getObjects().filter((obj: any) => !obj.isBackground)
    const json = JSON.stringify(objects.map(obj => obj.toJSON()))
    console.log('[Editor] saveState, idx:', historyIndexRef.current, 'history len:', historyRef.current.length)

    const idx = historyIndexRef.current
    const newHistory = [...historyRef.current.slice(0, idx + 1), json]
    historyRef.current = newHistory
    historyIndexRef.current = idx + 1
    setHistory(newHistory)
    setHistoryIndex(idx + 1)
  }

  const undo = () => {
    const idx = historyIndexRef.current
    const hist = historyRef.current
    console.log('[Editor] undo called, idx:', idx, 'history len:', hist.length)
    if (idx <= 0) return
    const canvas = fabricRef.current
    if (!canvas) return
    const newIndex = idx - 1
    const json = hist[newIndex]
    if (!json) {
      console.warn('[Editor] Undo: pas de state à index', newIndex)
      return
    }
    isLoadingSlide.current = true

    // Supprimer tous les objets SAUF le background
    const toRemove = canvas.getObjects().filter((obj: any) => !obj.isBackground)
    toRemove.forEach(obj => canvas.remove(obj))

    // Restaurer les objets sauvegardés
    const objects = JSON.parse(json)
    fabric.util.enlivenObjects(objects).then((enlivenedObjects: any[]) => {
      enlivenedObjects.forEach(obj => canvas.add(obj))
      canvas.renderAll()
      historyIndexRef.current = newIndex
      setHistoryIndex(newIndex)
      setTimeout(() => { isLoadingSlide.current = false }, 200)
    }).catch(() => {
      // Fallback si enlivenObjects échoue
      canvas.renderAll()
      historyIndexRef.current = newIndex
      setHistoryIndex(newIndex)
      setTimeout(() => { isLoadingSlide.current = false }, 200)
    })
  }

  const redo = () => {
    const idx = historyIndexRef.current
    const hist = historyRef.current
    if (idx >= hist.length - 1) return
    const canvas = fabricRef.current
    if (!canvas) return
    const newIndex = idx + 1
    const json = hist[newIndex]
    if (!json) return
    isLoadingSlide.current = true

    const toRemove = canvas.getObjects().filter((obj: any) => !obj.isBackground)
    toRemove.forEach(obj => canvas.remove(obj))

    const objects = JSON.parse(json)
    fabric.util.enlivenObjects(objects).then((enlivenedObjects: any[]) => {
      enlivenedObjects.forEach(obj => canvas.add(obj))
      canvas.renderAll()
      historyIndexRef.current = newIndex
      setHistoryIndex(newIndex)
      setTimeout(() => { isLoadingSlide.current = false }, 200)
    }).catch(() => {
      canvas.renderAll()
      historyIndexRef.current = newIndex
      setHistoryIndex(newIndex)
      setTimeout(() => { isLoadingSlide.current = false }, 200)
    })
  }

  // Ajouter des éléments
  const addText = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const text = new fabric.IText('Nouveau texte', {
      left: 100,
      top: 100,
      fontSize: 28,
      fontFamily: 'Arial',
      fill: '#5C4B40'
    })
    canvas.add(text)
    canvas.setActiveObject(text)
  }

  const addShape = (type: string) => {
    const canvas = fabricRef.current
    if (!canvas) return

    let shape: fabric.Object
    const baseOptions = {
      left: 100, top: 100,
      fill: '#EAE1D3',
      stroke: '#5C4B40',
      strokeWidth: 2
    }

    if (type === 'rect') {
      shape = new fabric.Rect({ ...baseOptions, width: 200, height: 120, rx: 12, ry: 12 })
    } else if (type === 'circle') {
      shape = new fabric.Circle({ ...baseOptions, radius: 60 })
    } else if (type === 'triangle') {
      shape = new fabric.Triangle({ ...baseOptions, width: 120, height: 120 })
    } else if (type === 'line') {
      shape = new fabric.Line([50, 50, 300, 50], {
        ...baseOptions,
        strokeWidth: 3
      })
    } else {
      // Formes complexes via Path (Star, Hexagon, etc.)
      const paths: Record<string, string> = {
        star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
        hexagon: "M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z",
        arrow: "M5 12h14M12 5l7 7-7 7",
        rhombus: "M12 2l10 10-10 10-10-10L12 2z",
        heart: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        cloud: "M17.5 19a5.5 5.5 0 0 0 0-11h-1.43a7 7 0 1 0-12.89 3.19A5.5 5.5 0 0 0 5.5 19h12Z",
        plus: "M12 5v14M5 12h14",
        polygon: "m12 2 10 7-3.8 11.5H5.8L2 9z"
      }

      const pathData = paths[type] || paths.star
      shape = new fabric.Path(pathData, {
        ...baseOptions,
        scaleX: 5, scaleY: 5
      })
    }

    canvas.add(shape)
    canvas.setActiveObject(shape)
  }
  const addImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        const ImageClass = (fabric as any).FabricImage || fabric.Image;
        // @ts-ignore
        (ImageClass as any).fromURL(result).then((img: fabric.Image) => {
          img.scaleToWidth(300)
          fabricRef.current?.add(img)
          fabricRef.current?.setActiveObject(img)
        }).catch((err: any) => console.error(err))
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }


  const bringToFront = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active || !canvas) return

    isBatchOperation.current = true
    if ((canvas as any).bringObjectToFront) (canvas as any).bringObjectToFront(active)
    else if ((canvas as any).bringToFront) (canvas as any).bringToFront(active)

    canvas.renderAll()
    saveCurrentSlide()
    saveState()
    isBatchOperation.current = false
  }

  const sendToBackLayer = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active || !canvas) return

    isBatchOperation.current = true
    const objects = canvas.getObjects()
    const bgIndex = objects.findIndex((obj) => (obj as any).isBackground)
    const targetIndex = bgIndex >= 0 ? bgIndex + 1 : 0

    if ((canvas as any).moveObjectTo) (canvas as any).moveObjectTo(active, targetIndex)
    else if ((canvas as any).moveTo) (canvas as any).moveTo(active, targetIndex)

    canvas.renderAll()
    saveCurrentSlide()
    saveState()
    isBatchOperation.current = false
  }

  const bringForward = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active || !canvas) return

    isBatchOperation.current = true
    if ((canvas as any).bringObjectForward) (canvas as any).bringObjectForward(active)
    else if ((canvas as any).bringForward) (canvas as any).bringForward(active)

    canvas.renderAll()
    saveCurrentSlide()
    saveState()
    isBatchOperation.current = false
  }

  const sendBackward = (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active || !canvas) return

    isBatchOperation.current = true
    const objects = canvas.getObjects()
    const activeIndex = objects.indexOf(active)
    const bgIndex = objects.findIndex((obj) => (obj as any).isBackground)
    const limit = bgIndex !== -1 ? bgIndex + 1 : 0

    if (activeIndex > limit) {
      if ((canvas as any).sendObjectBackwards) (canvas as any).sendObjectBackwards(active)
      else if ((canvas as any).sendBackwards) (canvas as any).sendBackwards(active)

      canvas.renderAll()
      saveCurrentSlide()
      saveState()
    }
    isBatchOperation.current = false
  }

  // Fonctions d'alignement sur la page
  const alignObject = (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const canvas = fabricRef.current
    const active = canvas?.getActiveObject()
    if (!active || !canvas) return

    const width = active.getScaledWidth()
    const height = active.getScaledHeight()

    switch (direction) {
      case 'left':
        active.set({ left: 0 })
        break
      case 'center':
        active.set({ left: (CANVAS_WIDTH - width) / 2 })
        break
      case 'right':
        active.set({ left: CANVAS_WIDTH - width })
        break
      case 'top':
        active.set({ top: 0 })
        break
      case 'middle':
        active.set({ top: (CANVAS_HEIGHT - height) / 2 })
        break
      case 'bottom':
        active.set({ top: CANVAS_HEIGHT - height })
        break
    }

    isBatchOperation.current = true
    active.setCoords()
    canvas.renderAll()
    saveCurrentSlide()
    saveState()
    isBatchOperation.current = false
  }

  // Changer de slide
  const goToSlide = (index: number) => {
    saveCurrentSlide()
    setCurrentSlideIndex(index)
  }

  // Sauvegarder et fermer
  const handleSave = () => {
    saveCurrentSlide()
    onSave(editingSlides)
  }

  // Helpers
  const rgbToHex = (color: any): string => {
    if (!color) return '#000000'
    if (typeof color === 'string' && color.startsWith('#')) return color
    if (typeof color === 'string' && color.startsWith('rgb')) {
      const match = color.match(/(\d+),\s*(\d+),\s*(\d+)/)
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, '0')
        const g = parseInt(match[2]).toString(16).padStart(2, '0')
        const b = parseInt(match[3]).toString(16).padStart(2, '0')
        return `#${r}${g}${b}`
      }
    }
    return '#000000'
  }

  // Styles
  const toolBtnStyleDA: React.CSSProperties = {
    minWidth: 34,
    height: 34,
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(92,75,64,0.05)',
    border: '1px solid rgba(92,75,64,0.08)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    color: '#5C4B40',
    transition: 'all 0.2s ease',
    fontFamily: 'Avenir, sans-serif'
  }

  const groupLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: '#5C4B40',
    marginRight: 8,
    cursor: 'pointer',
    userSelect: 'none',
    fontFamily: 'Avenir, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 6,
    transition: 'background 0.2s'
  }

  const separatorStyle: React.CSSProperties = {
    width: 1,
    height: 24,
    background: 'rgba(92,75,64,0.1)',
    margin: '0 10px'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#5C4B40',
    opacity: 0.4,
    display: 'block',
    marginBottom: 4,
    fontFamily: 'Avenir, sans-serif'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid rgba(92,75,64,0.12)',
    fontSize: 12,
    color: '#5C4B40',
    outline: 'none',
    background: 'rgba(92,75,64,0.03)',
    fontFamily: 'Avenir, sans-serif'
  }

  const menuBtnStyle: React.CSSProperties = {
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'white',
    border: '1px solid rgba(92,75,64,0.12)',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 13,
    color: '#5C4B40',
    transition: 'all 0.2s',
    fontWeight: 500,
    fontFamily: 'Avenir, sans-serif'
  }

  const dimBoxStyle: React.CSSProperties = {
    background: 'rgba(92,75,64,0.04)',
    border: '1px solid rgba(92,75,64,0.08)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#5C4B40',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'Avenir, sans-serif'
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1000,
      background: '#f0ede8', display: 'flex', flexDirection: 'column'
    }}>
      {/* HEADER */}
      <div style={{
        height: 56, background: 'white', borderBottom: '1px solid rgba(92,75,64,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px'
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: '#5C4B40', fontWeight: 600, fontFamily: 'Avenir, sans-serif'
        }}>← Retour</button>

        <span style={{ fontSize: 12, color: '#5C4B40', opacity: 0.5, fontFamily: 'Avenir, sans-serif' }}>
          Slide {currentSlideIndex + 1} / {editingSlides.length}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={undo} style={toolBtnStyleDA} title="Annuler (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-15 9 9 0 0 0-6 2.3L3 7" /></svg>
          </button>
          <button onClick={redo} style={toolBtnStyleDA} title="Rétablir (Ctrl+Y)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-15 9 9 0 0 1 6 2.3l3 4.7" /></svg>
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
            fontSize: 10, fontWeight: 700, color: '#5C4B40', opacity: 0.4,
            fontFamily: 'Avenir, sans-serif'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ENREGISTRÉ
          </div>
        </div>
      </div>

      {/* TOOLBAR HORIZONTALE */}
      <div style={{
        height: 48, background: '#F8F6F2', borderBottom: '1px solid rgba(92,75,64,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', gap: 3
      }}>
        {/* Groupe: Ajouter */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span onClick={() => setGroupOpenAjouter(!groupOpenAjouter)} style={groupLabelStyle}>
            Ajouter {groupOpenAjouter ? '▾' : '▸'}
          </span>
          {groupOpenAjouter && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={addText} style={toolBtnStyleDA} title="Texte">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
              </button>

              {/* Menu Formes Unifié */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowShapesMenu(!showShapesMenu)}
                  style={{ ...toolBtnStyleDA, background: showShapesMenu ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)' }}
                  title="Formes"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><circle cx="17.5" cy="6.5" r="3.5" /><path d="M12 21l-3.5-7h7L12 21z" /></svg>
                </button>
                {showShapesMenu && (
                  <>
                    <div onClick={() => setShowShapesMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
                    <div style={{
                      position: 'absolute', top: 38, left: 0, width: 220,
                      background: 'white', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                      border: '1px solid rgba(0,0,0,0.08)', zIndex: 1101, padding: '12px',
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8
                    }}>
                      {[
                        { type: 'rect', icon: <rect x="3" y="3" width="18" height="18" rx="2" />, label: 'Carré' },
                        { type: 'circle', icon: <circle cx="12" cy="12" r="9" />, label: 'Cercle' },
                        { type: 'triangle', icon: <path d="M12 3l9 18H3l9-18z" />, label: 'Triangle' },
                        { type: 'star', icon: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />, label: 'Étoile' },
                        { type: 'hexagon', icon: <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />, label: 'Hexagone' },
                        { type: 'arrow', icon: <path d="M5 12h14M12 5l7 7-7 7" />, label: 'Flèche' },
                        { type: 'rhombus', icon: <path d="M12 2l10 10-10 10-10-10L12 2z" />, label: 'Losange' },
                        { type: 'line', icon: <line x1="2" y1="2" x2="22" y2="22" />, label: 'Ligne' },
                        { type: 'heart', icon: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />, label: 'Cœur' },
                        { type: 'cloud', icon: <path d="M17.5 19a5.5 5.5 0 0 0 0-11h-1.43a7 7 0 1 0-12.89 3.19A5.5 5.5 0 0 0 5.5 19h12Z" />, label: 'Nuage' },
                        { type: 'plus', icon: <path d="M12 5v14M5 12h14" />, label: 'Plus' },
                        { type: 'polygon', icon: <path d="m12 2 10 7-3.8 11.5H5.8L2 9z" />, label: 'Polygone' }
                      ].map((shape, idx) => (
                        <div
                          key={idx}
                          onClick={() => { addShape(shape.type as any); setShowShapesMenu(false); }}
                          style={{
                            aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', borderRadius: 8, background: 'rgba(92,75,64,0.03)',
                            color: '#5C4B40', border: '1px solid transparent', transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(92,75,64,0.08)')}
                          onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(92,75,64,0.03)')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {shape.icon}
                          </svg>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button onClick={addImage} style={toolBtnStyleDA} title="Image">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              </button>
            </div>
          )}
        </div>

        <div style={separatorStyle} />

        {/* Groupe: Éditer */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span onClick={() => setGroupOpenEdition(!groupOpenEdition)} style={groupLabelStyle}>
            Éditer {groupOpenEdition ? '▾' : '▸'}
          </span>
          {groupOpenEdition && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={duplicateSelected} style={toolBtnStyleDA} title="Dupliquer (Ctrl+D)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              </button>
              <button onClick={deleteSelected} style={{ ...toolBtnStyleDA, color: '#e53e3e' }} title="Supprimer (Supprimer)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
              </button>
            </div>
          )}
        </div>

        <div style={separatorStyle} />

        {/* Groupe: Position */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <button
            onClick={() => setShowPositionMenu(!showPositionMenu)}
            style={{
              ...toolBtnStyleDA,
              width: 'auto',
              padding: '0 12px',
              gap: 6,
              background: showPositionMenu ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)',
            }}
            title="Position et Alignement"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /></svg>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Avenir, sans-serif' }}>POSITION</span>
          </button>

          {showPositionMenu && (
            <>
              <div onClick={() => setShowPositionMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 1100 }} />
              <div style={{
                position: 'absolute', top: 42, left: 0, width: 320,
                background: 'white', borderRadius: 14, boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
                border: '1px solid rgba(0,0,0,0.08)', zIndex: 1101, padding: '16px',
                fontFamily: 'Avenir, sans-serif', color: '#5C4B40'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Position</h3>
                  <button onClick={() => setShowPositionMenu(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, fontSize: 18 }}>✕</button>
                </div>

                {/* Calques */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                  <button onClick={() => bringForward()} style={menuBtnStyle}><span style={{ fontSize: 16 }}>⬆️</span> Avant</button>
                  <button onClick={() => sendBackward()} style={menuBtnStyle}><span style={{ fontSize: 16 }}>⬇️</span> Arrière</button>
                  <button onClick={() => bringToFront()} style={menuBtnStyle}><span style={{ fontSize: 16 }}>🔝</span> Avant-plan</button>
                  <button onClick={() => sendToBackLayer()} style={menuBtnStyle}><span style={{ fontSize: 16 }}>🔙</span> Arrière-plan</button>
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12, opacity: 0.9 }}>Aligner sur la page</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
                  <button onClick={() => alignObject('top')} style={menuBtnStyle}><span style={{ fontSize: 14 }}>▔</span> Haut</button>
                  <button onClick={() => alignObject('left')} style={menuBtnStyle}><span style={{ fontSize: 14 }}>▎</span> Gauche</button>
                  <button onClick={() => alignObject('middle')} style={menuBtnStyle}><span style={{ fontSize: 14 }}>═</span> Centre</button>
                  <button onClick={() => alignObject('center')} style={menuBtnStyle}><span style={{ fontSize: 14 }}>║</span> Centre</button>
                  <button onClick={() => alignObject('bottom')} style={menuBtnStyle}><span style={{ fontSize: 14 }}> </span> Bas</button>
                  <button onClick={() => alignObject('right')} style={menuBtnStyle}><span style={{ fontSize: 14 }}>▕</span> Droite</button>
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12, opacity: 0.9 }}>Avancé</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>Largeur</div>
                    <div style={dimBoxStyle}>{Math.round(selectedObject?.getScaledWidth() || 0)} px</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>Hauteur</div>
                    <div style={dimBoxStyle}>{Math.round(selectedObject?.getScaledHeight() || 0)} px</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ ...dimBoxStyle, width: '100%', justifyContent: 'center', opacity: 0.6 }}>🔒</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>X</div>
                    <div style={dimBoxStyle}>{Math.round(selectedObject?.left || 0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>Y</div>
                    <div style={dimBoxStyle}>{Math.round(selectedObject?.top || 0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, marginBottom: 4 }}>Pivoter</div>
                    <div style={dimBoxStyle}>{Math.round(selectedObject?.angle || 0)}°</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={separatorStyle} />

        {/* Groupe: Fond */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={groupLabelStyle}>Fond</span>
          <button onClick={toggleBackgroundLock} style={{
            ...toolBtnStyleDA,
            background: backgroundLocked ? 'rgba(92,75,64,0.12)' : 'rgba(92,75,64,0.05)',
            border: backgroundLocked ? '1px solid rgba(92,75,64,0.2)' : '1px solid rgba(92,75,64,0.08)'
          }} title={backgroundLocked ? 'Déverrouiller' : 'Verrouiller'}>
            {backgroundLocked ? '🔒' : '🔓'}
          </button>
        </div>

        <div style={separatorStyle} />

        {/* Groupe: IA */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={groupLabelStyle}>IA</span>
          <button
            onClick={decomposeCurrentSlide}
            disabled={isDecomposing}
            style={{
              ...toolBtnStyleDA,
              width: 'auto',
              padding: '0 14px',
              gap: 6,
              background: isDecomposing ? 'rgba(92,75,64,0.08)' : 'linear-gradient(135deg, rgba(92,75,64,0.08), rgba(92,75,64,0.02))',
              border: '1px solid rgba(92,75,64,0.12)',
              opacity: isDecomposing ? 0.5 : 1
            }}
            title="Décomposer en calques éditables"
          >
            {isDecomposing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 15.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" /><path d="M13 10.5h.01" /><path d="m20 10.5-3 .5-.5 3 .5 3 3 .5 2.5-3.5L20 10.5Z" /><path d="m15.5 19-.5-3 3-.5 3.5 2.5-3.5 2.5-3-1.5Z" /></svg>
            )}
            <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Avenir, sans-serif' }}>
              {isDecomposing ? 'DÉCOMPOSITION...' : 'DÉCOMPOSER'}
            </span>
          </button>
          <div style={{ width: 4 }} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                const next = !showRemoveBgMenu
                setShowRemoveBgMenu(next)
                if (next) {
                  setShowPropertiesPanel(false)
                  setShowColorPicker(false)
                }
              }}
              disabled={isRemovingBg}
              style={{
                ...toolBtnStyleDA,
                width: 'auto',
                padding: '0 14px',
                gap: 6,
                display: 'flex',
                alignItems: 'center',
                opacity: isRemovingBg ? 0.5 : 1
              }}
              title="Supprimer l'arrière-plan"
            >
              {isRemovingBg ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 10l-4 4 4 4" /><path d="M18 10l4 4-4 4" /><path d="M12 4l-4 4 4 4" /><path d="M12 20l4-4-4-4" /></svg>
              )}
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Avenir, sans-serif' }}>
                {isRemovingBg ? 'CALCUL...' : 'DÉTOURAGE'}
              </span>
            </button>

            {/* Menu popup */}
            {showRemoveBgMenu && !isRemovingBg && (
              <div style={{
                position: 'absolute',
                top: 42,
                left: 0,
                width: 280,
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid rgba(92,75,64,0.08)',
                padding: 14,
                zIndex: 200
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#5C4B40', opacity: 0.5,
                  display: 'block', marginBottom: 10
                }}>
                  Détourage Magique (IA)
                </span>

                {/* Option 1: Automatique */}
                <button
                  onClick={() => { setShowRemoveBgMenu(false); removeBackground(null) }}
                  style={{
                    width: '100%', padding: '10px 12px', marginBottom: 8,
                    background: 'rgba(92,75,64,0.04)', border: '1px solid rgba(92,75,64,0.08)',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'Avenir, sans-serif', fontSize: 13, color: '#5C4B40',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(92,75,64,0.08)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(92,75,64,0.04)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>✂️</span>
                    <div>
                      <strong style={{ display: 'block' }}>Automatique</strong>
                      <span style={{ fontSize: 10, opacity: 0.6 }}>Idéal pour isoler le sujet principal</span>
                    </div>
                  </div>
                </button>

                {/* Option 2: Avec prompt (Isoler) */}
                <div style={{
                  padding: '12px',
                  background: 'rgba(92,75,64,0.04)',
                  border: '1px solid rgba(92,75,64,0.08)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🎯</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#5C4B40' }}>Isoler un élément</strong>
                      <span style={{ fontSize: 10, opacity: 0.6, color: '#5C4B40', display: 'block' }}>
                        Décris ce que tu veux GARDER
                      </span>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={removeBgPrompt}
                    onChange={(e) => setRemoveBgPrompt(e.target.value)}
                    placeholder="Ex: la montre, le texte..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && removeBgPrompt.trim()) {
                        setShowRemoveBgMenu(false)
                        removeBackground(removeBgPrompt.trim())
                      }
                    }}
                    style={{
                      width: '100%', padding: '10px 12px',
                      borderRadius: 8, border: '1px solid rgba(92,75,64,0.12)',
                      fontSize: 12, color: '#5C4B40', outline: 'none',
                      background: 'white', fontFamily: 'Avenir, sans-serif'
                    }}
                  />

                  <button
                    onClick={() => {
                      if (removeBgPrompt.trim()) {
                        setShowRemoveBgMenu(false)
                        removeBackground(removeBgPrompt.trim())
                      }
                    }}
                    style={{
                      width: '100%', padding: '10px 0',
                      background: '#5C4B40', color: 'white', border: 'none',
                      borderRadius: 8, fontSize: 11, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'Avenir, sans-serif',
                      letterSpacing: '0.05em'
                    }}
                  >
                    EXTRAIRE L'ÉLÉMENT
                  </button>
                </div>

                {/* Option 3: Supprimer un objet spécifique (Retouche) */}
                <div style={{
                  padding: '12px',
                  background: 'rgba(229, 62, 62, 0.04)',
                  border: '1px solid rgba(229, 62, 62, 0.1)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>🗑️</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#c53030' }}>Supprimer un objet</strong>
                      <span style={{ fontSize: 10, opacity: 0.7, color: '#c53030', display: 'block' }}>
                        Effacer et reconstruire le fond
                      </span>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={removeObjectPrompt}
                    onChange={(e) => setRemoveObjectPrompt(e.target.value)}
                    placeholder="Ex: le scorpion, la chaise..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && removeObjectPrompt.trim()) {
                        setShowRemoveBgMenu(false)
                        removeBackground(removeObjectPrompt.trim(), 'remove_object')
                      }
                    }}
                    style={{
                      width: '100%', padding: '10px 12px',
                      borderRadius: 8, border: '1px solid rgba(229, 62, 62, 0.2)',
                      fontSize: 12, color: '#5C4B40', outline: 'none',
                      background: 'white', fontFamily: 'Avenir, sans-serif'
                    }}
                  />

                  <button
                    onClick={() => {
                      if (removeObjectPrompt.trim()) {
                        setShowRemoveBgMenu(false)
                        removeBackground(removeObjectPrompt.trim(), 'remove_object')
                      }
                    }}
                    style={{
                      width: '100%', padding: '10px 0',
                      background: '#e53e3e', color: 'white', border: 'none',
                      borderRadius: 8, fontSize: 11, fontWeight: 800,
                      cursor: 'pointer', fontFamily: 'Avenir, sans-serif',
                      letterSpacing: '0.05em'
                    }}
                  >
                    EFFACER L'OBJET
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* BARRE DE FORMATAGE CONTEXTUELLE (TEXTE) */}
      {selectedTextObj && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px',
          background: '#F8F6F2',
          borderBottom: '1px solid rgba(92,75,64,0.08)',
          fontFamily: 'Avenir, sans-serif',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {/* Police */}
          <select
            value={selectedTextObj.fontFamily || 'Avenir'}
            onChange={(e) => {
              selectedTextObj.set('fontFamily', e.target.value)
              fabricRef.current?.renderAll()
              saveState()
            }}
            style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid rgba(92,75,64,0.12)',
              fontSize: 12, color: '#5C4B40', background: 'white',
              fontFamily: 'Avenir, sans-serif', minWidth: 120
            }}
          >
            {['Avenir', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New',
              'Verdana', 'Impact', 'Comic Sans MS', 'Trebuchet MS', 'Palatino',
              'Garamond', 'Bookman', 'Tahoma', 'Lucida Console'].map(f => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
          </select>

          {/* Séparateur */}
          <div style={{ width: 1, height: 20, background: 'rgba(92,75,64,0.1)' }} />

          {/* Taille - / valeur / + */}
          <button onClick={() => {
            const size = Math.max(8, (selectedTextObj.fontSize || 28) - 1)
            selectedTextObj.set('fontSize', size)
            fabricRef.current?.renderAll()
            saveState()
          }} style={{ ...toolBtnStyleDA, width: 28, height: 28, fontSize: 14 }}>−</button>

          <input
            type="number"
            value={Math.round(selectedTextObj.fontSize || 28)}
            onChange={(e) => {
              const size = Math.max(8, Math.min(300, parseInt(e.target.value) || 28))
              selectedTextObj.set('fontSize', size)
              fabricRef.current?.renderAll()
              saveState()
            }}
            style={{
              width: 42, textAlign: 'center', padding: '2px 4px',
              borderRadius: 6, border: '1px solid rgba(92,75,64,0.12)',
              fontSize: 12, color: '#5C4B40', fontFamily: 'Avenir, sans-serif'
            }}
          />

          <button onClick={() => {
            const size = Math.min(300, (selectedTextObj.fontSize || 28) + 1)
            selectedTextObj.set('fontSize', size)
            fabricRef.current?.renderAll()
            saveState()
          }} style={{ ...toolBtnStyleDA, width: 28, height: 28, fontSize: 14 }}>+</button>

          {/* Séparateur */}
          <div style={{ width: 1, height: 20, background: 'rgba(92,75,64,0.1)' }} />

          {/* Couleur texte + Pastilles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            {/* Bouton Multicolor / Trigger */}
            <div
              onClick={() => {
                const next = !showColorPicker
                setShowColorPicker(next)
                if (next) {
                  setShowPropertiesPanel(false)
                  setShowRemoveBgMenu(false)
                }
              }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: '2px solid white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                position: 'relative'
              }}
            >
              <span style={{ color: 'white', fontSize: 16, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>+</span>
            </div>

            {/* Pastilles de couleurs récentes (Simplifiées ici car le popup en a déjà) */}
            <div style={{ display: 'flex', gap: 4 }}>
              {recentColors.slice(0, 3).map((color, idx) => (
                <div
                  key={`${color}-${idx}`}
                  onClick={() => {
                    selectedTextObj.set('fill', color)
                    updateRecentColors(color)
                    fabricRef.current?.renderAll()
                    saveState()
                  }}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: color, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
                    boxShadow: color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.05)' : 'none'
                  }}
                />
              ))}
            </div>

            {/* POPUP COULEURS (DESIGN STYLE) */}
            {showColorPicker && (
              <div style={{
                position: 'absolute', top: 38, left: 0, width: 280,
                background: 'white', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid rgba(0,0,0,0.08)', zIndex: 1100, padding: '16px 0',
                maxHeight: 480, overflowY: 'auto', fontFamily: 'Avenir, sans-serif'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px 16px' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#000' }}>Couleur du texte</span>
                  <button onClick={() => setShowColorPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#000', opacity: 0.5 }}>✕</button>
                </div>

                {/* Search Bar Placeholder */}
                <div style={{ padding: '0 16px 16px 16px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: '#F6F6F6', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    <span style={{ fontSize: 14, opacity: 0.6 }}>🔍</span>
                    <input
                      placeholder="Essayer « bleu » ou « #00c4cc »"
                      style={{ background: 'none', border: 'none', fontSize: 12, outline: 'none', width: '100%', color: '#000' }}
                    />
                  </div>
                </div>

                {/* Section: Couleurs du document */}
                <div style={{ padding: '0 16px 16px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: '#000' }}>
                    <span style={{ fontSize: 14 }}>📄</span> Couleurs du document
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {/* Trigger Custom Color (Multicolor circle with +) */}
                    <div
                      onClick={() => colorInputRef.current?.click()}
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        position: 'relative'
                      }}
                    >
                      <div style={{ background: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#000', fontSize: 16, fontWeight: 700 }}>+</span>
                      </div>
                    </div>

                    {[...new Set([rgbToHex(selectedTextObj.fill || '#000000'), ...recentColors])].slice(0, 6).map((color, idx) => (
                      <div
                        key={`doc-${color}-${idx}`}
                        onClick={() => {
                          selectedTextObj.set('fill', color)
                          updateRecentColors(color)
                          fabricRef.current?.renderAll()
                          saveState()
                        }}
                        style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: color, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
                          boxShadow: color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.05)' : 'none',
                          transform: rgbToHex(selectedTextObj.fill) === color.toLowerCase() ? 'scale(1.1)' : 'none',
                          outline: rgbToHex(selectedTextObj.fill) === color.toLowerCase() ? '2px solid #5C4B40' : 'none',
                          outlineOffset: '2px'
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Section: Couleurs unies par défaut */}
                <div style={{ padding: '8px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#000' }}>🎨 Couleurs unies par défaut</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#000', opacity: 0.6, cursor: 'pointer' }}>Afficher tout</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                    {defaultColors.map((color, idx) => (
                      <div
                        key={`def-${color}-${idx}`}
                        onClick={() => {
                          selectedTextObj.set('fill', color)
                          updateRecentColors(color)
                          fabricRef.current?.renderAll()
                          saveState()
                        }}
                        style={{
                          width: '100%', aspectRatio: '1/1', borderRadius: '50%',
                          background: color, border: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer',
                          boxShadow: color.toLowerCase() === '#ffffff' ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Hidden Native Picker */}
                <input
                  type="color"
                  ref={colorInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const color = e.target.value
                    selectedTextObj.set('fill', color)
                    updateRecentColors(color)
                    fabricRef.current?.renderAll()
                    saveState()
                  }}
                />
              </div>
            )}
          </div>

          {/* Séparateur */}
          <div style={{ width: 1, height: 20, background: 'rgba(92,75,64,0.1)' }} />

          {/* Gras B */}
          <button
            onClick={() => {
              const isBold = selectedTextObj.fontWeight === 'bold' || selectedTextObj.fontWeight === 700
              selectedTextObj.set('fontWeight', isBold ? 'normal' : 'bold')
              fabricRef.current?.renderAll()
              saveState()
            }}
            style={{
              ...toolBtnStyleDA, width: 28, height: 28, fontSize: 13, fontWeight: 700,
              background: (selectedTextObj.fontWeight === 'bold' || selectedTextObj.fontWeight === 700)
                ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)'
            }}
          >B</button>

          {/* Italique I */}
          <button
            onClick={() => {
              const isItalic = selectedTextObj.fontStyle === 'italic'
              selectedTextObj.set('fontStyle', isItalic ? 'normal' : 'italic')
              fabricRef.current?.renderAll()
              saveState()
            }}
            style={{
              ...toolBtnStyleDA, width: 28, height: 28, fontSize: 13, fontStyle: 'italic',
              background: selectedTextObj.fontStyle === 'italic'
                ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)'
            }}
          >I</button>

          {/* Souligné U */}
          <button
            onClick={() => {
              const isUnderline = selectedTextObj.underline
              selectedTextObj.set('underline', !isUnderline)
              fabricRef.current?.renderAll()
              saveState()
            }}
            style={{
              ...toolBtnStyleDA, width: 28, height: 28, fontSize: 13, textDecoration: 'underline',
              background: selectedTextObj.underline
                ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)'
            }}
          >U</button>

          {/* Barré S */}
          <button
            onClick={() => {
              const isStrike = selectedTextObj.linethrough
              selectedTextObj.set('linethrough', !isStrike)
              fabricRef.current?.renderAll()
              saveState()
            }}
            style={{
              ...toolBtnStyleDA, width: 28, height: 28, fontSize: 13, textDecoration: 'line-through',
              background: selectedTextObj.linethrough
                ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)'
            }}
          >S</button>

          {/* Séparateur */}
          <div style={{ width: 1, height: 20, background: 'rgba(92,75,64,0.1)' }} />

          {/* Alignement */}
          <button onClick={() => {
            const aligns = ['left', 'center', 'right']
            const current = selectedTextObj.textAlign || 'left'
            const next = aligns[(aligns.indexOf(current) + 1) % aligns.length]
            selectedTextObj.set('textAlign', next)
            fabricRef.current?.renderAll()
            saveState()
          }} style={{ ...toolBtnStyleDA, width: 28, height: 28 }}>
            {selectedTextObj.textAlign === 'center' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="6" /><line x1="21" y1="12" x2="3" y2="12" /><line x1="18" y1="18" x2="6" y2="18" /></svg>
            ) : selectedTextObj.textAlign === 'right' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="21" y1="6" x2="9" y2="6" /><line x1="21" y1="12" x2="3" y2="12" /><line x1="21" y1="18" x2="9" y2="18" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="15" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="15" y2="18" /></svg>
            )}
          </button>

          {/* Séparateur */}
          <div style={{ width: 1, height: 20, background: 'rgba(92,75,64,0.1)' }} />

          {/* Burger de Texte (Plus d'options) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreTextMenu(!showMoreTextMenu)}
              style={{
                ...toolBtnStyleDA, width: 28, height: 28, fontSize: 13,
                background: showMoreTextMenu ? 'rgba(92,75,64,0.15)' : 'rgba(92,75,64,0.05)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>

            {showMoreTextMenu && (
              <>
                <div
                  onClick={() => setShowMoreTextMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 1150 }}
                />
                <div style={{
                  position: 'absolute', top: 34, right: 0, width: 180,
                  background: 'white', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid rgba(92,75,64,0.08)', zIndex: 1160, padding: '6px 0',
                  fontFamily: 'Avenir, sans-serif'
                }}>
                  {[
                    {
                      label: 'Paramètres',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
                      action: () => {
                        setShowPropertiesPanel(!showPropertiesPanel)
                        setShowMoreTextMenu(false)
                      }
                    },
                    {
                      label: 'Dupliquer',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
                      action: () => {
                        duplicateSelected()
                        setShowMoreTextMenu(false)
                      }
                    },
                    {
                      label: 'Supprimer',
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>,
                      action: () => {
                        deleteSelected()
                        setShowMoreTextMenu(false)
                      }
                    }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      onClick={item.action}
                      style={{
                        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', transition: 'background 0.2s', fontSize: 13, color: '#5C4B40'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = '#F6F6F6')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ display: 'flex' }}>{item.icon}</span>
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}


      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* POPUP PROPRIÉTÉS — descend depuis la toolbar */}
        {showPropertiesPanel && selectedObject && !isRemovingBg && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 120, // À gauche de la sidebar slides
            width: 280,
            background: 'white',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid rgba(92,75,64,0.08)',
            padding: 16,
            zIndex: 100,
            maxHeight: 500,
            overflowY: 'auto'
          }}>
            {/* Bouton fermer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: '#5C4B40', fontFamily: 'Avenir, sans-serif'
              }}>
                Propriétés
              </span>
              <button
                onClick={() => setShowPropertiesPanel(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#5C4B40', opacity: 0.4 }}
              >
                ✕
              </button>
            </div>

            {/* Position — ligne horizontale */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Position</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, color: '#5C4B40', opacity: 0.3, fontFamily: 'Avenir, sans-serif' }}>X</span>
                  <input type="number" value={Math.round(selectedObject.left || 0)}
                    onChange={(e) => { selectedObject.set('left', +e.target.value); fabricRef.current?.renderAll() }}
                    style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, color: '#5C4B40', opacity: 0.3, fontFamily: 'Avenir, sans-serif' }}>Y</span>
                  <input type="number" value={Math.round(selectedObject.top || 0)}
                    onChange={(e) => { selectedObject.set('top', +e.target.value); fabricRef.current?.renderAll() }}
                    style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Taille — ligne horizontale */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Taille</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, color: '#5C4B40', opacity: 0.3, fontFamily: 'Avenir, sans-serif' }}>L</span>
                  <input type="number" value={Math.round((selectedObject.width || 0) * (selectedObject.scaleX || 1))}
                    onChange={(e) => { selectedObject.set('width', +e.target.value); selectedObject.set('scaleX', 1); fabricRef.current?.renderAll() }}
                    style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, color: '#5C4B40', opacity: 0.3, fontFamily: 'Avenir, sans-serif' }}>H</span>
                  <input type="number" value={Math.round((selectedObject.height || 0) * (selectedObject.scaleY || 1))}
                    onChange={(e) => { selectedObject.set('height', +e.target.value); selectedObject.set('scaleY', 1); fabricRef.current?.renderAll() }}
                    style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Rotation + Opacité côte à côte */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Rotation</label>
                <input type="range" min="0" max="360" value={Math.round(selectedObject.angle || 0)}
                  onChange={(e) => { selectedObject.set('angle', +e.target.value); fabricRef.current?.renderAll() }}
                  style={{ width: '100%', accentColor: '#5C4B40' }} />
                <span style={{ fontSize: 9, color: '#5C4B40', opacity: 0.4, fontFamily: 'Avenir, sans-serif' }}>{Math.round(selectedObject.angle || 0)}°</span>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Opacité</label>
                <input type="range" min="0" max="100" value={Math.round((selectedObject.opacity || 1) * 100)}
                  onChange={(e) => { selectedObject.set('opacity', +e.target.value / 100); fabricRef.current?.renderAll() }}
                  style={{ width: '100%', accentColor: '#5C4B40' }} />
                <span style={{ fontSize: 9, color: '#5C4B40', opacity: 0.4, fontFamily: 'Avenir, sans-serif' }}>{Math.round((selectedObject.opacity || 1) * 100)}%</span>
              </div>
            </div>

            {/* Couleur */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Couleur</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color"
                  value={rgbToHex((selectedObject as any).fill) || '#000000'}
                  onChange={(e) => {
                    const color = e.target.value
                    selectedObject.set('fill', color)
                    updateRecentColors(color)
                    fabricRef.current?.renderAll()
                  }}
                  style={{ width: 48, height: 32, border: '1px solid rgba(92,75,64,0.1)', borderRadius: 6, cursor: 'pointer' }} />

                <div style={{ display: 'flex', gap: 4 }}>
                  {/* Pastille multicolor pour ouvrir le picker ici aussi si besoin */}
                  <div
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                      border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  ><span style={{ color: 'white', fontSize: 10, fontWeight: 900 }}>+</span></div>

                  {recentColors.slice(0, 4).map((color, idx) => (
                    <div
                      key={`panel-${color}-${idx}`}
                      onClick={() => {
                        selectedObject.set('fill', color)
                        updateRecentColors(color)
                        fabricRef.current?.renderAll()
                      }}
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: color, border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            {/* Avancé: Espacement & Interligne */}
            {(selectedObject.type === 'i-text' || selectedObject.type === 'textbox') && (
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 1, background: 'rgba(92,75,64,0.08)', margin: '12px 0' }} />
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#5C4B40', opacity: 0.6, marginBottom: 12, display: 'block' }}>
                  Espacement
                </span>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Espacement des lettres</label>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5C4B40' }}>{(selectedObject as any).charSpacing / 10 || 0}</span>
                  </div>
                  <input
                    type="range" min="-100" max="500" value={(selectedObject as any).charSpacing || 0}
                    onChange={(e) => {
                      (selectedObject as any).set('charSpacing', +e.target.value)
                      fabricRef.current?.renderAll()
                    }}
                    style={{ width: '100%', accentColor: '#5C4B40' }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Interligne</label>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5C4B40' }}>{((selectedObject as any).lineHeight || 1.16).toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="0.5" max="3" step="0.05" value={(selectedObject as any).lineHeight || 1.16}
                    onChange={(e) => {
                      (selectedObject as any).set('lineHeight', +e.target.value)
                      fabricRef.current?.renderAll()
                    }}
                    style={{ width: '100%', accentColor: '#5C4B40' }}
                  />
                </div>

                {/* Ancrer la zone de texte */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>Ancrer la zone de texte</label>
                  <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                    {[
                      { icon: '⤒', val: 'top' },
                      { icon: '↕', val: 'center' },
                      { icon: '⤓', val: 'bottom' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        onClick={() => {
                          // Note: Fabric Textbox simulated vertical anchor via originY
                          (selectedObject as any).set('originY', item.val)
                          fabricRef.current?.renderAll()
                        }}
                        style={{
                          flex: 1, height: 40, border: 'none', background: (selectedObject.originY === item.val) ? '#EAE1D3' : 'white',
                          cursor: 'pointer', fontSize: 18, color: (selectedObject.originY === item.val) ? '#5C4B40' : '#5C4B40',
                          borderRight: '1px solid rgba(0,0,0,0.05)'
                        }}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: 'rgba(92,75,64,0.08)', margin: '12px 0' }} />

                {/* Formatage */}
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#5C4B40', opacity: 0.6, marginBottom: 12, display: 'block' }}>
                  Formatage
                </span>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>Position du texte</label>
                  <div style={{ display: 'flex', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                    {[
                      { label: 'A2', val: 'normal' },
                      { label: 'A²', val: 'super' },
                      { label: 'A₂', val: 'sub' }
                    ].map((item) => (
                      <button
                        key={item.val}
                        style={{
                          flex: 1, height: 40, border: 'none', background: item.val === 'normal' ? '#EAE1D3' : 'white',
                          cursor: 'pointer', fontSize: 14, color: item.val === 'normal' ? '#5C4B40' : '#5C4B40',
                          fontWeight: 600, borderRight: '1px solid rgba(0,0,0,0.05)', fontFamily: 'Avenir, sans-serif'
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: 'rgba(92,75,64,0.08)', margin: '12px 0' }} />

                {/* Typographie */}
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#5C4B40', opacity: 0.6, marginBottom: 12, display: 'block' }}>
                  Typographie
                </span>

                {/* Crénage */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ ...labelStyle, margin: 0 }}>Crénage</label>
                  </div>
                  <p style={{ fontSize: 10, opacity: 0.5, marginBottom: 8, marginTop: 0 }}>
                    Ajustez l’espacement entre les lettres pour une meilleure lisibilité
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ flex: 1, height: 40, background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, cursor: 'pointer' }}>-</button>
                    <button style={{ flex: 1, height: 40, background: '#EAE1D3', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, cursor: 'pointer', color: '#5C4B40', fontSize: 13, fontWeight: 700 }}>V⃡A</button>
                  </div>
                </div>

                {/* Ligatures */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>Ligatures</label>
                  <p style={{ fontSize: 10, opacity: 0.5, marginBottom: 8, marginTop: 0 }}>
                    Combinez élégamment certains caractères spécifiques
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ flex: 1, height: 40, background: '#EAE1D3', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, cursor: 'pointer', color: '#5C4B40', fontStyle: 'italic', fontWeight: 600 }}>fi</button>
                    <button style={{ flex: 1, height: 40, background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>fi</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTENU PRINCIPAL (CANVAS OU PAGES) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#e8e4de' }}>

          {/* VUE MULTI-PAGES (VERTICAL STACK) */}
          {viewMode === 'pages' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
              {editingSlides.map((slide, i) => (
                <div key={`page-view-${slide.id}`} style={{ width: '100%', maxWidth: 1000 }}>
                  {/* Header de Page */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#000', fontFamily: 'Avenir, sans-serif' }}>Page {i + 1}</span>
                      <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', fontFamily: 'Avenir, sans-serif' }}>- Ajouter le titre de la page</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Icons Premium SVG */}
                      <span title="Monter" style={{ cursor: 'pointer', opacity: 0.5, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                      </span>
                      <span title="Descendre" style={{ cursor: 'pointer', opacity: 0.5, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </span>
                      <span title="Masquer" style={{ cursor: 'pointer', opacity: 0.5, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" /><circle cx="12" cy="12" r="3" /></svg>
                      </span>
                      <span title="Verrouiller" style={{ cursor: 'pointer', opacity: 0.5, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); duplicateSlide(i); }} title="Dupliquer" style={{ cursor: 'pointer', opacity: 0.5, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); deleteSlide(i); }} title="Supprimer" style={{ cursor: 'pointer', opacity: 0.5, display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                      </span>
                      <span onClick={(e) => { e.stopPropagation(); addNewSlide(); }} title="Ajouter une page" style={{ cursor: 'pointer', opacity: 0.8, display: 'flex' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                      </span>
                    </div>
                  </div>

                  {/* Aperçu Slide avec bordure violette si active */}
                  <div
                    onClick={() => {
                      setCurrentSlideIndex(i)
                      loadSlide(i)
                      setViewMode('editor')
                    }}
                    style={{
                      width: '100%', aspectRatio: '16/9', background: slide.background || '#fff',
                      borderRadius: 4, border: i === currentSlideIndex ? '2px solid #5C4B40' : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)', cursor: 'pointer', position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {slide.backgroundImage && <img src={slide.backgroundImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {/* Render minimal elements inside for preview if needed, but for now simple background/image */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ opacity: 0.1, fontSize: 12 }}>Aperçu contenu</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ZONE CANVAS (VUE ÉDITEUR) */
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px', overflow: 'auto'
            }}>
              <div style={{
                boxShadow: '0 8px 40px rgba(0,0,0,0.15)', borderRadius: 8, overflow: 'hidden',
                transform: `scale(${zoom / 100})`, transition: 'transform 0.2s ease'
              }}>
                <canvas ref={canvasRef} />

                {canvasContextMenu.visible && (
                  <div
                    style={{
                      position: 'absolute',
                      left: canvasContextMenu.x,
                      top: canvasContextMenu.y,
                      zIndex: 100000,
                      background: 'white',
                      borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      border: '1px solid rgba(92,75,64,0.06)',
                      padding: '6px 0',
                      minWidth: 240,
                      fontFamily: 'Avenir, sans-serif'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ContextMenuItem icon="📋" label="Copier" shortcut="Ctrl+C" onClick={copySelected} />
                    <ContextMenuItem icon="🎨" label="Copier le style" shortcut="Ctrl+Alt+C" onClick={copyStyle} />
                    <ContextMenuItem icon="📌" label="Coller le style" shortcut="" onClick={pasteStyle} disabled={!editorClipboardStyle} />
                    <ContextMenuItem icon="📥" label="Coller" shortcut="Ctrl+V" onClick={pasteFromClipboard} disabled={!editorClipboard} />
                    <ContextMenuItem icon="📑" label="Dupliquer" shortcut="Ctrl+D" onClick={() => { duplicateSelected(); setCanvasContextMenu(prev => ({ ...prev, visible: false })); }} />

                    <div style={{ height: 1, background: 'rgba(92,75,64,0.06)', margin: '4px 0' }} />

                    <ContextMenuItem icon="➕" label="Ajouter une slide" shortcut="Ctrl+Entrée" onClick={() => { addNewSlide(); setCanvasContextMenu(prev => ({ ...prev, visible: false })); }} />
                    <ContextMenuItem icon="📄" label="Dupliquer la slide" shortcut="" onClick={() => { duplicateSlide(currentSlideIndex); setCanvasContextMenu(prev => ({ ...prev, visible: false })); }} />
                    <ContextMenuItem icon="🗑️" label="Supprimer la slide" shortcut="" onClick={() => { deleteSlide(currentSlideIndex); setCanvasContextMenu(prev => ({ ...prev, visible: false })); }} disabled={editingSlides.length <= 1} />

                    <div style={{ height: 1, background: 'rgba(92,75,64,0.06)', margin: '4px 0' }} />

                    <ContextMenuItem icon="⬆️" label="Avancer" shortcut="" onClick={bringForward} />
                    <ContextMenuItem icon="⬇️" label="Reculer" shortcut="" onClick={sendBackward} />

                    <div style={{ height: 1, background: 'rgba(92,75,64,0.06)', margin: '4px 0' }} />

                    <ContextMenuItem
                      icon="🔒"
                      label={selectedObject?.lockMovementX ? "Déverrouiller" : "Verrouiller"}
                      shortcut=""
                      onClick={() => { toggleBackgroundLock(); setCanvasContextMenu(prev => ({ ...prev, visible: false })); }}
                    />
                    <ContextMenuItem icon="🗑️" label="Supprimer" shortcut="Supprimer" onClick={deleteSelected} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FOOTER PREMIUM (STYLE DESIGN) */}
          <div style={{
            height: 120, background: 'white', borderTop: '1px solid rgba(92,75,64,0.1)',
            display: 'flex', flexDirection: 'column', position: 'relative'
          }}>
            {/* Rendu du Menu Contextuel Slide (HORS de la zone overflow pour éviter le clipping) */}
            {(slideMenuOpen !== null || contextMenuPos !== null) && (
              <div
                onClick={() => { setSlideMenuOpen(null); setContextMenuPos(null); }}
                style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
              />
            )}

            {/* Context Menu Premium Style Design */}
            {(slideMenuOpen !== null || contextMenuPos !== null) && (
              <div style={{
                position: 'fixed',
                zIndex: 99999, // Z-index ultra élevé pour passer au dessus de tout
                bottom: contextMenuPos ? 'auto' : 125,
                left: contextMenuPos ? contextMenuPos.x : Math.max(20, (slideMenuOpen! * 132) + 20 - (document.querySelector('.slide-nav-bar')?.scrollLeft || 0)),
                top: contextMenuPos ? Math.min(contextMenuPos.y, window.innerHeight - 450) : 'auto', // Éviter de sortir par le bas
                width: 280,
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 1px rgba(0,0,0,0.1)',
                border: '1px solid rgba(0,0,0,0.12)',
                padding: '8px 0',
                fontFamily: 'Avenir, sans-serif',
                pointerEvents: 'auto'
              }}>
                {[
                  { label: 'Copier', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>, shortcut: 'Ctrl+C', action: () => copySlide(slideMenuOpen ?? currentSlideIndex) },
                  { label: 'Copier le style', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 12V5a2 2 0 0 1 2-2h9" /><path d="M21 8a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v13" /><rect width="14" height="6" x="8" y="10" rx="1" /></svg>, shortcut: 'Ctrl+Alt+C', action: () => copySlideStyle(slideMenuOpen ?? currentSlideIndex) },
                  { label: 'Copier le style de la page', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>, premium: true, action: () => copySlideStyle(slideMenuOpen ?? currentSlideIndex) },
                  { label: 'Coller', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /></svg>, shortcut: 'Ctrl+V', action: () => pasteSlide(slideMenuOpen ?? currentSlideIndex), disabled: !clipboardSlide },
                  { label: 'Coller le style', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>, shortcut: 'Ctrl+Alt+V', action: () => pasteSlideStyle(slideMenuOpen ?? currentSlideIndex), disabled: !editorClipboardStyle?.isSlideStyle },
                  { label: 'Dupliquer la page', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /></svg>, shortcut: 'Ctrl+D', action: () => duplicateSlide(slideMenuOpen ?? currentSlideIndex) },
                  { type: 'divider' },
                  { label: 'Ajouter une page', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></svg>, shortcut: 'Ctrl+Entrée', action: addNewSlide },
                  {
                    label: editingSlides[slideMenuOpen ?? currentSlideIndex]?.hidden ? 'Afficher cette page' : 'Masquer cette page',
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>,
                    action: () => toggleHideSlide(slideMenuOpen ?? currentSlideIndex)
                  },
                  { type: 'divider' },
                  { label: 'Commenter', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L22 4Z" /><path d="M12 12v.01" /></svg>, shortcut: 'Ctrl+Alt+N' },
                  { label: 'Supprimer', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>, action: () => deleteSlide(slideMenuOpen ?? currentSlideIndex) },
                ].map((item: any, idx) => (
                  item.type === 'divider' ? (
                    <div key={idx} style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '6px 0' }} />
                  ) : (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (item.action && !item.disabled) item.action()
                        setSlideMenuOpen(null)
                        setContextMenuPos(null)
                      }}
                      style={{
                        padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        cursor: item.disabled ? 'not-allowed' : 'pointer', fontSize: 13, color: item.disabled ? '#ccc' : '#000',
                        opacity: item.disabled ? 0.6 : 1
                      }}
                      onMouseOver={(e) => !item.disabled && (e.currentTarget.style.background = '#F6F6F6')}
                      onMouseOut={(e) => !item.disabled && (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18, color: '#5C4B40' }}>{item.icon}</span>
                        <span style={{ fontWeight: 500 }}>{item.label}</span>
                        {item.premium && <span style={{ fontSize: 14 }}>👑</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.shortcut && <span style={{ fontSize: 11, opacity: 0.6, background: '#f0f0f0', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{item.shortcut}</span>}
                        {item.arrow && <span style={{ opacity: 0.4 }}>›</span>}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
            {/* Barre de Miniature Slide */}
            <div
              className="slide-nav-bar"
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
                overflowX: 'auto', background: '#F8F6F2'
              }}
            >
              {editingSlides.map((slide, i) => (
                <div key={slide.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: i === editingSlides.length - 1 ? 12 : 0 }}>
                  <div
                    onClick={() => goToSlide(i)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('[Editor] Right-click on slide:', i, e.clientX, e.clientY)
                      setContextMenuPos({ x: e.clientX, y: e.clientY })
                      setSlideMenuOpen(i)
                    }}
                    style={{
                      width: 120, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: i === currentSlideIndex ? '2px solid #5C4B40' : '2px solid rgba(0,0,0,0.08)',
                      background: slide.background || '#fff', transition: 'all 0.2s ease',
                      position: 'relative', boxShadow: i === currentSlideIndex ? '0 4px 12px rgba(92, 75, 64, 0.2)' : 'none',
                      opacity: slide.hidden ? 0.4 : 1
                    }}
                  >
                    {slide.backgroundImage && (
                      <img src={slide.backgroundImage} alt="" style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        filter: slide.hidden ? 'grayscale(100%)' : 'none'
                      }} />
                    )}

                    {/* Badge Masqué */}
                    {slide.hidden && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5C4B40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                      </div>
                    )}

                    {/* Bouton Burger ≡ au lieu de ... */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setSlideMenuOpen(slideMenuOpen === i ? null : i)
                      }}
                      style={{
                        position: 'absolute', top: 6, right: 6, width: 24, height: 24,
                        borderRadius: '50%', background: i === currentSlideIndex ? '#5C4B40' : 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', cursor: 'pointer', zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'all 0.2s'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    </div>

                    {/* Label Page (Style Design) */}
                    <div style={{
                      position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)',
                      background: '#1a1a1b', color: 'white', padding: '2px 8px', borderRadius: 6,
                      fontSize: 10, fontWeight: 700, pointerEvents: 'none', zIndex: 5,
                      fontFamily: 'Avenir, sans-serif', visibility: i === currentSlideIndex ? 'visible' : 'hidden'
                    }}>
                      Page {i + 1}
                      <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '4px solid #1a1a1b' }} />
                    </div>

                    <div style={{
                      position: 'absolute', bottom: 4, left: 6,
                      fontSize: 10, fontWeight: 800, color: i === currentSlideIndex ? '#5C4B40' : '#5C4B40',
                      fontFamily: 'Avenir, sans-serif'
                    }}>{i + 1}</div>
                  </div>

                  {/* Bouton Ajouter Slide intercalé ou à la fin */}
                  {i === editingSlides.length - 1 && (
                    <div
                      onClick={addNewSlide}
                      style={{
                        width: 48, height: 48, borderRadius: 8, background: 'rgba(0,0,0,0.03)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)', fontSize: 24,
                        color: '#5C4B40', transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                    >
                      +
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Barre de Zoom et Contrôles Bas */}
            <div style={{
              height: 48, borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between', padding: '0 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div
                  onClick={() => setShowNotes(!showNotes)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    opacity: showNotes ? 1 : 0.6, color: showNotes ? '#5C4B40' : 'inherit',
                    background: showNotes ? '#EAE1D3' : 'transparent',
                    padding: '4px 8px', borderRadius: 6, transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: 16 }}>📝</span>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Avenir, sans-serif' }}>Notes</span>
                </div>
                {/* Popup Notes */}
                {showNotes && (
                  <>
                    <div
                      onClick={() => setShowNotes(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 60, left: 20, width: 320, height: 240,
                      background: 'white', border: '1px solid rgba(92, 75, 64, 0.1)',
                      borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                      display: 'flex', flexDirection: 'column', zIndex: 2001,
                      fontFamily: 'Avenir, sans-serif', padding: 16
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#5C4B40' }}>Notes de présentation</span>
                        <span onClick={() => setShowNotes(false)} style={{ cursor: 'pointer', opacity: 0.4 }}>✕</span>
                      </div>
                      <textarea
                        value={editingSlides[currentSlideIndex]?.notes || ''}
                        onChange={(e) => {
                          const newVal = e.target.value
                          setEditingSlides(prev => {
                            const next = prev.map((s, i) =>
                              i === currentSlideIndexRef.current ? { ...s, notes: newVal } : s
                            )
                            onSave(next)
                            return next
                          })
                        }}
                        placeholder="Ajouter des notes sur cette slide..."
                        style={{
                          flex: 1, width: '100%', border: 'none', resize: 'none',
                          fontSize: 13, color: '#5C4B40', outline: 'none',
                          lineHeight: '1.6', fontFamily: 'Avenir, sans-serif'
                        }}
                        autoFocus
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range" min="10" max="200" value={zoom}
                    onChange={(e) => setZoom(+e.target.value)}
                    style={{ width: 120, accentColor: '#5C4B40' }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, width: 35, fontFamily: 'Avenir, sans-serif' }}>{zoom}%</span>
                </div>

                <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)' }} />

                <div
                  onClick={() => setViewMode(viewMode === 'pages' ? 'editor' : 'pages')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: viewMode === 'pages' ? '#EAE1D3' : 'rgba(0,0,0,0.05)',
                    padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                    color: viewMode === 'pages' ? '#5C4B40' : '#5C4B40',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Avenir, sans-serif' }}>Pages</span>
                </div>

                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(0,0,0,0.4)', fontFamily: 'Avenir, sans-serif' }}>
                  {currentSlideIndex + 1} / {editingSlides.length}
                </span>

                <div style={{ display: 'flex', gap: 12, opacity: 0.6 }}>
                  <span style={{ cursor: 'pointer' }}>▦</span>
                  <span style={{ cursor: 'pointer' }}>↗</span>
                  <span style={{ cursor: 'pointer' }}>?</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helpers
const decomposeSlideLayers = async (imageUrl: string, numLayers: number = 4): Promise<any> => {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // 1. Lancer la décomposition
  const submitRes = await fetch(
    'https://xrhcaskiudkszbrhuisu.supabase.co/functions/v1/decompose-slide',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({ image_url: imageUrl, num_layers: numLayers })
    }
  )

  const rawText = await submitRes.text()
  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    console.error('[Editor] Non-JSON response (decompose):', submitRes.status, rawText.substring(0, 300))
    throw new Error(`Erreur Décomposition (${submitRes.status})`)
  }

  if (!submitRes.ok) {
    throw new Error(data.error || `Erreur Décomposition ${submitRes.status}`)
  }

  // 2. Si résultat direct, retourner
  if (data.success && data.layers) {
    return data.layers
  }

  // 3. Si en queue ou processing (réponse de l'Edge Function mise à jour), poller
  if ((data.status === 'queued' || data.status === 'processing') && data.request_id) {
    console.log('[Editor] Polling pour request_id:', data.request_id)
    const statusResult = await pollForResult(data.request_id, 'fal-ai/qwen-image-layered')
    console.log('[Editor] Decompose statusResult:', statusResult)
    return statusResult
  }

  throw new Error(data.error || 'Échec de la décomposition')
}

const pollForResult = async (requestId: string, endpoint: string, maxAttempts: number = 60): Promise<any> => {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  let consecutiveErrors = 0

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000))

    try {
      const res = await fetch(
        'https://xrhcaskiudkszbrhuisu.supabase.co/functions/v1/studio-video-status',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey
          },
          body: JSON.stringify({
            request_id: requestId,
            endpoint: endpoint
          })
        }
      )

      if (!res.ok) {
        consecutiveErrors++
        const errorText = await res.text()
        console.error('[Poll] Erreur', res.status, ':', errorText.substring(0, 200))

        if (consecutiveErrors >= 5) {
          throw new Error(`Trop d'erreurs consécutives (5x status ${res.status}): ${errorText.substring(0, 100)}`)
        }
        continue
      }

      consecutiveErrors = 0
      const rawText = await res.text()
      let data
      try {
        data = JSON.parse(rawText)
      } catch {
        console.error('[Poll] Non-JSON response:', res.status, rawText.substring(0, 300))
        consecutiveErrors++
        continue
      }
      console.log('[Poll]', i + 1, 'Status:', data.status)

      if (data.status === 'completed') {
        return data // Retourner l'objet COMPLET
      }

      if (data.status === 'failed' || data.error) {
        throw new Error('Tâche échouée: ' + (data.error || 'Erreur inconnue'))
      }

      if (i % 5 === 0) console.log('[Editor] Polling...', i + 1, '/', maxAttempts)

    } catch (err: any) {
      if (err.message.includes('Trop d\'erreurs')) throw err
      consecutiveErrors++
      console.error('[Poll] Exception:', err)
      if (consecutiveErrors >= 5) throw err
    }
  }

  throw new Error('Timeout: le processus a pris trop de temps')
}




