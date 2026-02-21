# 🔐 Guide d'intégration — Clés API chiffrées Jungle Studio

## Architecture déployée

| Composant | Statut | Description |
|-----------|--------|-------------|
| Table `user_api_keys` | ✅ Migré | Stockage chiffré AES-256 via pgcrypto, RLS activé |
| Fonctions SQL `encrypt_api_key` / `decrypt_api_key` | ✅ Créées | Chiffrement/déchiffrement côté serveur |
| Edge Function `api-keys` | ✅ Déployé | CRUD complet (list, save, decrypt, toggle, delete) |
| Composant `ApiKeysPanel.tsx` | ✅ Créé | UI complète avec 8 providers pré-configurés |

---

## 1. Ajouter ApiKeysPanel dans AdminDashboard.tsx

Ajouter un sous-onglet "Clés API" dans les paramètres :

```tsx
// Import en haut
import ApiKeysPanel from '@/components/admin/ApiKeysPanel'

// Ajouter 'apikeys' dans le type advancedTab
const [advancedTab, setAdvancedTab] = useState<'audio' | 'chat' | 'memory' | 'apikeys'>('audio')

// Ajouter le bouton sub-tab
<button
  onClick={() => setAdvancedTab('apikeys')}
  className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${advancedTab === 'apikeys' ? 'bg-[#5C4B40]/10 text-[#5C4B40]' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
>
  Clés API
</button>

// Rendu conditionnel
{advancedTab === 'apikeys' && (
  <ApiKeysPanel />
)}
```

Fichier destination : `frontend/components/admin/ApiKeysPanel.tsx`

---

## 2. Utiliser les clés dans fusion-run (ou toute edge function)

Quand une edge function doit appeler un LLM avec la clé de l'utilisateur :

```typescript
// Dans fusion-run ou toute edge function
async function getUserApiKey(supabase: any, userId: string, provider: string, userToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/api-keys?action=decrypt`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ provider })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.api_key || null;
  } catch {
    return null;
  }
}

// Usage dans fusion-run :
const userOpenAIKey = await getUserApiKey(supabase, user.id, 'openai', userToken);
const apiKey = userOpenAIKey || OPENAI_API_KEY; // Fallback sur la clé globale
```

### Priorité des clés :
1. **Clé utilisateur** (si configurée et active) → `user_api_keys`
2. **Clé globale** (fallback) → variable d'environnement Supabase

---

## 3. Sécurité

### Chiffrement
- **Algorithme** : AES-256 via `pgp_sym_encrypt` (pgcrypto)
- **Passphrase** : Variable d'environnement `API_KEYS_ENCRYPTION_SECRET`
- **Fallback** : Si la variable n'existe pas, utilise `SUPABASE_SERVICE_ROLE_KEY`

### Recommandation : Créer un secret dédié
```bash
# Dans Supabase Dashboard → Settings → Edge Functions → Secrets
# Ajouter :
API_KEYS_ENCRYPTION_SECRET = "<votre-passphrase-forte-64-chars>"
```

Utiliser un secret dédié est plus sûr car il peut être roté indépendamment du service role key.

### Flux de sécurité
```
[UI] Utilisateur saisit clé → 
[Edge Function] Reçoit via HTTPS → 
[SQL] pgp_sym_encrypt(clé, passphrase) → 
[DB] Stockage BYTEA chiffré → 
[UI] Seul le hint visible (sk-p...4xZm)
```

La clé en clair n'est JAMAIS :
- Stockée en DB
- Retournée au frontend après enregistrement
- Visible dans les logs
- Accessible via l'API publique

---

## 4. Providers supportés

| Provider | Slug | Placeholder |
|----------|------|-------------|
| OpenAI | `openai` | `sk-proj-...` |
| Anthropic | `anthropic` | `sk-ant-...` |
| Google AI | `google` | `AIza...` |
| xAI (Grok) | `xai` | `xai-...` |
| Mistral AI | `mistral` | `sk-...` |
| Perplexity | `perplexity` | `pplx-...` |
| ElevenLabs | `elevenlabs` | `sk_...` |
| Stability AI | `stability` | `sk-...` |

Pour ajouter un nouveau provider, il suffit d'ajouter une entrée dans le dictionnaire `PROVIDERS` du composant.

---

## 5. API de l'Edge Function

| Action | Méthode | Params | Description |
|--------|---------|--------|-------------|
| `list` | GET | `?action=list` | Liste les clés (hint uniquement) |
| `save` | POST | `?action=save` + body `{provider, api_key, label}` | Chiffre et sauvegarde |
| `decrypt` | POST | `?action=decrypt` + body `{provider}` | Déchiffre (server only) |
| `toggle` | PUT | `?action=toggle` + body `{provider, is_active}` | Active/désactive |
| `delete` | DELETE | `?action=delete&provider=openai` | Supprime définitivement |
