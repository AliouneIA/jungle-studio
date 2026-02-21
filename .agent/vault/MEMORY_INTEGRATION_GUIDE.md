# 🧠 Guide d'intégration — Mémoire LLM Jungle Studio

## Architecture déployée

| Composant | Statut | Emplacement |
|-----------|--------|-------------|
| Table `user_memories` | ✅ Migré | Supabase DB (RLS activé) |
| Edge Function `memory-extract` | ✅ Déployé | Extraction auto post-conversation |
| Edge Function `memory-get` | ✅ Déployé | Récupère les mémoires pour le system prompt |
| Composant `MemoryPanel.tsx` | ✅ Créé | UI de gestion dans les Paramètres |

---

## 1. Ajouter MemoryPanel dans AdminDashboard.tsx

Dans l'onglet "Avancé", ajouter un sous-onglet "Mémoire" :

```tsx
// Import en haut du fichier
import MemoryPanel from '@/components/admin/MemoryPanel'

// Ajouter 'memory' dans le type advancedTab
const [advancedTab, setAdvancedTab] = useState<'audio' | 'chat' | 'memory'>('audio')

// Ajouter le bouton dans les sub-tabs (section Advanced)
<button
  onClick={() => setAdvancedTab('memory')}
  className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${advancedTab === 'memory' ? 'bg-[#5C4B40]/10 text-[#5C4B40]' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
>
  Mémoire IA
</button>

// Ajouter le rendu conditionnel après le bloc 'chat'
{advancedTab === 'memory' && (
  <MemoryPanel />
)}
```

Fichier destination : `frontend/components/admin/MemoryPanel.tsx`

---

## 2. Injection de la mémoire dans le system prompt (fusion-run)

Modifier la edge function `fusion-run` pour injecter les mémoires :

```typescript
// Au début de la fonction, après la vérification auth :
const memoryRes = await fetch(`${SUPABASE_URL}/functions/v1/memory-get`, {
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  }
});
const memoryData = await memoryRes.json();
const memoryBlock = memoryData?.system_prompt_block || '';

// Injecter dans le system prompt envoyé au LLM :
const systemPrompt = `${existingSystemPrompt}

${memoryBlock}`
```

---

## 3. Extraction automatique après chaque conversation

Dans `CockpitPage.tsx` ou `ChatInput.tsx`, appeler `memory-extract` après chaque réponse :

```typescript
// Après avoir reçu la réponse du LLM et sauvegardé le message :
const extractMemories = async (conversationId: string, messages: any[]) => {
  try {
    await supabase.functions.invoke('memory-extract', {
      body: {
        conversation_id: conversationId,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      }
    })
  } catch (err) {
    // Silencieux — ne pas bloquer l'UX pour la mémoire
    console.warn('[Memory] Extraction failed:', err)
  }
}

// Appeler APRÈS la réponse complète (pas pendant le streaming)
// Par exemple dans le finally{} du handleSend ou après setChatHistory
if (messages.length >= 4) { // Attendre au moins 2 échanges
  extractMemories(conversationId, messages)
}
```

**IMPORTANT** : Ne pas appeler à chaque message. Idéalement :
- Après chaque 4ème message (2 échanges complets)
- Ou quand l'utilisateur quitte la conversation
- Ou quand la conversation dépasse 6 messages

---

## 4. Format du system prompt injecté

Voici un exemple de ce que `memory-get` retourne dans `system_prompt_block` :

```
<user_memory>
Voici ce que tu sais sur cet utilisateur (mémoire persistante) :

👤 Identité:
- S'appelle Alioune, développeur fullstack
- Basé en France, travaille en français

⚙️ Préférences:
- Préfère les réponses concises et techniques
- Aime le design minimaliste et épuré
- Utilise le tutoiement

📁 Projets en cours:
- Développe Jungle Studio, une plateforme IA multi-modèles
- Tech stack: Next.js 14, Supabase, TailwindCSS, TypeScript
- Utilise plusieurs LLMs: GPT, Claude, Gemini, Grok

🎓 Expertise:
- Expert en React/Next.js
- Bonne maîtrise de Supabase et PostgreSQL
- Connaissance avancée des APIs LLM

Utilise ces informations naturellement dans tes réponses sans les répéter explicitement.
</user_memory>
```

---

## 5. Catégories de mémoire

| Catégorie | Exemples |
|-----------|----------|
| `identity` | Nom, rôle, localisation, langue |
| `preferences` | Style de réponse, format, ton |
| `projects` | Projets en cours, stack technique |
| `expertise` | Compétences, domaines, niveau |
| `context` | Décisions passées, objectifs récurrents |
| `general` | Tout le reste |

---

## 6. Sécurité

- ✅ RLS activé : chaque user ne voit que ses mémoires
- ✅ Edge functions vérifient le JWT
- ✅ Extraction via gpt-4o-mini (rapide, pas cher : ~$0.001/extraction)
- ✅ Limites : clé max 100 chars, valeur max 500 chars
- ✅ Upsert avec contrainte unique (user_id, key) — pas de doublons
