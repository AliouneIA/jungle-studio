# 🐛 Rapport de Bugs — SlideEditor.tsx

## Audit complet du composant `SlideEditor.tsx`

13 bugs identifiés, classés par sévérité.

---

## 🔴 CRITIQUE

### Bug 1 — Stale Closures sur le Clipboard et le Style

**Symptôme :** Copier/Coller d'éléments entre slides et Copier/Coller le style ne fonctionnent pas.

**Cause :** Le `useEffect` principal (~ligne 350) a `[currentSlideIndex]` en dépendance. À chaque changement de slide, il recrée le canvas et capture les fonctions `copySelected`, `pasteFromClipboard`, `copyStyle`, `pasteStyle` dans le `handleKeyDown`. Ces fonctions lisent `editorClipboard` et `editorClipboardStyle` depuis le state React, mais le state capturé est toujours la valeur au moment du mount (= `null`).

**Fix :**

```typescript
// Ajouter ces refs (à côté de editingSlidesRef et currentSlideIndexRef)
const editorClipboardRef = useRef<any>(null)
const editorClipboardStyleRef = useRef<any>(null)

// Synchroniser
useEffect(() => { editorClipboardRef.current = editorClipboard }, [editorClipboard])
useEffect(() => { editorClipboardStyleRef.current = editorClipboardStyle }, [editorClipboardStyle])

// Dans pasteFromClipboard, remplacer :
//   if (!canvas || !editorClipboard) return
// par :
//   const clip = editorClipboardRef.current
//   if (!canvas || !clip) return
//   const cloned = await clip.clone()

// Dans pasteStyle, remplacer :
//   if (!active || !editorClipboardStyle) return
//   Object.keys(editorClipboardStyle).forEach(...)
// par :
//   const style = editorClipboardStyleRef.current
//   if (!active || !style) return
//   Object.keys(style).forEach(...)
```

---

### Bug 2 — Undo/Redo cassés après changement de slide

**Symptôme :** Ctrl+Z / Ctrl+Y ne font rien après avoir changé de slide.

**Cause :** Même problème de stale closure. `undo()` et `redo()` lisent `historyIndex` et `history` depuis le state, mais le `handleKeyDown` capture les valeurs initiales.

**Fix :**

```typescript
// Ajouter des refs
const historyRef = useRef<string[]>([])
const historyIndexRef = useRef(-1)

// Synchroniser
useEffect(() => { historyRef.current = history }, [history])
useEffect(() => { historyIndexRef.current = historyIndex }, [historyIndex])

// Dans undo() et redo(), lire depuis les refs :
const undo = () => {
  if (historyIndexRef.current <= 0) return
  const canvas = fabricRef.current
  if (!canvas) return
  const newIndex = historyIndexRef.current - 1
  const json = historyRef.current[newIndex]
  if (!json) return
  canvas.loadFromJSON(json, () => {
    canvas.renderAll()
    setHistoryIndex(newIndex)
  })
}
```

---

## 🟠 IMPORTANT

### Bug 3 — Double chargement de slide dans `goToSlide`

**Symptôme :** Lag et comportement incohérent quand on clique sur une miniature de slide.

**Cause :** `goToSlide` appelle `loadSlide(index)` directement ET `setCurrentSlideIndex(index)` qui déclenche le `useEffect` (dépendance `[currentSlideIndex]`) qui recrée le canvas et appelle aussi `loadSlide`. La slide est donc chargée 2 fois, et la première charge est dans un canvas qui va être détruit.

```typescript
// ACTUEL (bugué)
const goToSlide = (index: number) => {
  saveCurrentSlide()
  setCurrentSlideIndex(index)  // → useEffect → dispose + new canvas + loadSlide
  loadSlide(index)             // → charge dans l'ancien canvas condamné
}
```

**Fix :** Retirer l'appel direct à `loadSlide` — le `useEffect` s'en charge :

```typescript
const goToSlide = (index: number) => {
  saveCurrentSlide()
  setCurrentSlideIndex(index)
  // loadSlide sera appelé par le useEffect automatiquement
}
```

---

### Bug 4 — Double chargement dans `deleteSlide`

**Même problème que Bug 3.**

```typescript
// ACTUEL (bugué)
const deleteSlide = (index: number) => {
  // ...
  setCurrentSlideIndex(nextIndex)
  loadSlide(nextIndex)  // ← SUPPRIMER cette ligne
  // ...
}
```

---

### Bug 5 — Double sauvegarde (events Fabric + appels directs)

**Symptôme :** Chaque action crée 2 entrées dans l'historique et déclenche 2 auto-saves.

**Cause :** Les événements Fabric `object:added`, `object:modified`, `object:removed` appellent `handleCanvasModification` → `saveState()` + `saveCurrentSlide()`. Mais les fonctions comme `addText`, `addShape`, `duplicateSelected`, `deleteSelected`, `pasteFromClipboard`, `bringToFront`, `sendToBackLayer`, `bringForward`, `sendBackward`, `alignObject`, `pasteStyle` appellent AUSSI `saveState()` et/ou `saveCurrentSlide()` directement.

**Fix :** Retirer les appels manuels à `saveState()` et `saveCurrentSlide()` dans les fonctions individuelles, puisque les événements Fabric les déclenchent automatiquement. OU désactiver temporairement les event listeners pendant les opérations programmatiques.

```typescript
// Option recommandée : flag pour empêcher le double save
const isBatchOperation = useRef(false)

const handleCanvasModification = () => {
  if (isInitialMount.current || isBatchOperation.current) return
  saveState()
  saveCurrentSlide()
}

// Puis dans les fonctions :
const addText = () => {
  isBatchOperation.current = true
  // ... add text ...
  isBatchOperation.current = false
  saveState()
  saveCurrentSlide()
}
```

---

### Bug 6 — Guard `isInitialMount` avec timeout fragile

**Symptôme :** Saves parasites si le chargement de la slide prend plus de 1.5s, ou premier vrai changement ignoré si le chargement est plus rapide.

**Cause :** `isInitialMount` est désactivé après un `setTimeout` de 1500ms fixe, indépendamment de l'état réel du chargement.

**Fix :** Utiliser un flag `isLoadingSlide` activé/désactivé explicitement :

```typescript
const isLoadingSlide = useRef(false)

const loadSlide = (index: number) => {
  isLoadingSlide.current = true
  // ... chargement ...
  // À la fin du chargement (dans le callback onload ou après loadElements) :
  setTimeout(() => { isLoadingSlide.current = false }, 100)
}

const handleCanvasModification = () => {
  if (isLoadingSlide.current) return
  saveState()
  saveCurrentSlide()
}
```

---

## 🟡 MOYEN

### Bug 7 — "Copier le style" dans le menu contextuel slide n'a pas d'action

**Symptôme :** Cliquer sur "Copier le style" ou "Copier le style de la page" dans le menu contextuel d'une miniature ne fait rien.

**Cause :** Pas de propriété `action` sur ces entrées :

```typescript
// Ligne ~2380 environ
{ label: 'Copier le style', icon: ..., shortcut: 'Ctrl+Alt+C' },
// ← manque: action: () => copySlideStyle(slideMenuOpen ?? currentSlideIndex)

{ label: 'Copier le style de la page', icon: ..., premium: true },
// ← manque: action: () => copyPageStyle(slideMenuOpen ?? currentSlideIndex)
```

**Fix :** Implémenter les fonctions `copySlideStyle` / `pasteSlideStyle` qui copient le `background`, `backgroundImage`, et les styles globaux d'une slide vers une autre.

---

### Bug 8 — Raccourci Ctrl+Alt+C pour "Copier le style" non implémenté

**Symptôme :** Le raccourci Ctrl+Alt+C affiché dans le menu ne fonctionne pas.

**Cause :** `handleKeyDown` ne gère pas `e.ctrlKey && e.altKey && e.key === 'c'`.

**Fix :**

```typescript
// Dans handleKeyDown, ajouter :
if (e.ctrlKey && e.altKey && e.key === 'c') { e.preventDefault(); copyStyle(); }
if (e.ctrlKey && e.altKey && e.key === 'v') { e.preventDefault(); pasteStyle(); }
```

---

### Bug 9 — Forme "ligne" crée une étoile

**Symptôme :** Cliquer sur l'icône "Ligne" dans le menu des formes crée une étoile.

**Cause :** Dans `addShape`, le type `'line'` n'est pas géré dans le `if/else`. Il tombe dans le `else` (formes via Path) qui cherche `paths['line']`, mais cette clé n'existe pas. Le fallback est `paths.star`.

**Fix :**

```typescript
// Dans addShape, ajouter avant le else :
} else if (type === 'line') {
  shape = new fabric.Line([50, 50, 300, 50], {
    ...baseOptions,
    strokeWidth: 3
  })
}
```

---

### Bug 10 — Notes de slide non sauvegardées vers le parent

**Symptôme :** Les notes de présentateur sont perdues à la fermeture de l'éditeur.

**Cause :** Le `textarea` des notes modifie `editingSlides` via `setEditingSlides`, mais n'appelle pas `onSave()`.

**Fix :**

```typescript
// Dans le onChange du textarea des notes, ajouter onSave :
onChange={(e) => {
  const newSlides = [...editingSlides]
  newSlides[currentSlideIndex].notes = e.target.value
  setEditingSlides(newSlides)
  onSave(newSlides)  // ← AJOUTER
}}
```

---

### Bug 11 — `loadSlide` lit `editingSlides` depuis le state (potentiellement stale)

**Symptôme :** Après un ajout/suppression rapide de slide, la mauvaise slide peut être chargée.

**Cause :** `loadSlide` lit `editingSlides[index]` mais `editingSlides` peut être stale dans le contexte du `useEffect`.

**Fix :** Utiliser `editingSlidesRef.current[index]` au lieu de `editingSlides[index]` dans `loadSlide`.

---

## 🔵 MINEUR

### Bug 12 — Deux systèmes de clipboard confus

`clipboardSlide` gère le copier/coller de slides entières (menu contextuel miniatures).
`editorClipboard` gère le copier/coller d'objets canvas.

Ce n'est pas un bug fonctionnel mais c'est confus. Aucun raccourci clavier ne gère le clipboard slide. Suggestion : Ctrl+Shift+C/V pour les slides.

---

### Bug 13 — Code polling mort dans `removeBackground`

Le code client gère encore le cas `data.request_id` avec `pollForResult`, mais le backend v19 est synchrone et retourne toujours un résultat direct. Ce code est mort et peut être retiré pour simplifier.

---

## Résumé des priorités

| # | Bug | Sévérité | Impact utilisateur |
|---|-----|----------|--------------------|
| 1 | Stale closures clipboard/style | 🔴 Critique | Copier/Coller entre slides cassé |
| 2 | Undo/Redo stale | 🔴 Critique | Ctrl+Z ne marche plus après changement de slide |
| 3 | Double loadSlide (goToSlide) | 🟠 Important | Lag et incohérence au changement de slide |
| 4 | Double loadSlide (deleteSlide) | 🟠 Important | Idem |
| 5 | Double saveState | 🟠 Important | Historique pollué, auto-saves en double |
| 6 | Guard isInitialMount fragile | 🟠 Important | Saves parasites au chargement |
| 7 | "Copier le style" sans action | 🟡 Moyen | Bouton de menu inopérant |
| 8 | Raccourci Ctrl+Alt+C manquant | 🟡 Moyen | Raccourci affiché mais inopérant |
| 9 | Ligne → Étoile | 🟡 Moyen | Mauvaise forme créée |
| 10 | Notes non sauvegardées | 🟡 Moyen | Perte de données |
| 11 | loadSlide stale | 🟡 Moyen | Mauvaise slide chargée (rare) |
| 12 | Deux clipboards | 🔵 Mineur | Confusion architecturale |
| 13 | Code polling mort | 🔵 Mineur | Code inutile |
