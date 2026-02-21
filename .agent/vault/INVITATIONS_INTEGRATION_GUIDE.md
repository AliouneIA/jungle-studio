# 👥 Guide d'intégration — Multi-utilisateurs Jungle Studio

## Architecture déployée

| Composant | Statut | Description |
|-----------|--------|-------------|
| Table `user_invitations` | ✅ Migré | Invitations par email (pending/accepted/revoked/expired) |
| Table `user_contacts` | ✅ Migré | Contacts bidirectionnels entre users |
| Table `shared_resources` | ✅ Migré | Partage projets/conversations avec permission |
| RLS `projects` + `conversations` | ✅ Étendu | Accès en lecture pour les users ayant un partage |
| Edge Function `invitations` | ✅ Déployé | API complète (invite, accept, share, unshare, etc.) |
| Composant `InvitationsPanel.tsx` | ✅ Créé | UI 3 onglets (contacts, invitations, partages) |

---

## 1. Ajouter InvitationsPanel dans AdminDashboard.tsx

```tsx
// Import
import InvitationsPanel from '@/components/admin/InvitationsPanel'

// Ajouter 'users' dans advancedTab
const [advancedTab, setAdvancedTab] = useState<'audio' | 'chat' | 'memory' | 'apikeys' | 'users'>('audio')

// Sub-tab button
<button
  onClick={() => setAdvancedTab('users')}
  className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${advancedTab === 'users' ? 'bg-[#5C4B40]/10 text-[#5C4B40]' : 'text-[#5C4B40]/40 hover:text-[#5C4B40]'}`}
>
  Utilisateurs
</button>

// Render
{advancedTab === 'users' && (
  <InvitationsPanel />
)}
```

Fichier destination : `frontend/components/admin/InvitationsPanel.tsx`

---

## 2. Flux utilisateur

### Scénario : Toi (admin) invite un collaborateur

1. **Paramètres → Utilisateurs → Inviter**
   - Tu saisis `collaborateur@email.com`
   - Si déjà inscrit → auto-accepté, ajouté aux contacts
   - Si pas inscrit → invitation pending (7 jours expiry)

2. **Le collaborateur se connecte**
   - S'il est nouveau, il crée un compte normal
   - L'invitation est auto-acceptée au login (via `accept` action)
   - Il apparaît dans tes contacts

3. **Tu partages un projet/conversation**
   - Onglet Contacts → icône Share → choisis le projet
   - Permission : Lecture seule ou Édition

4. **Le collaborateur voit le contenu partagé**
   - Les RLS policies lui donnent accès en SELECT
   - Il peut voir le projet/conversation dans son interface

5. **Tu supprimes l'accès**
   - Onglet Partages → Supprimer
   - Ou Contacts → Supprimer le contact (retire TOUT)

---

## 3. Auto-accept pour l'invité au login

Ajouter dans le middleware ou le layout principal :

```tsx
// Dans le layout ou après login, vérifier s'il y a une invitation pending
useEffect(() => {
  const checkPendingInvitations = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invitations?action=accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
    } catch {
      // Silent — not all users have pending invitations
    }
  }

  checkPendingInvitations()
}, [])
```

---

## 4. Afficher les ressources partagées dans la Sidebar

Pour que l'invité voie les projets/conversations partagés :

```tsx
// Dans Sidebar.tsx, après le fetch des projets du user :
const { data: sharedWithMe } = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invitations?action=shared-with-me`,
  { headers: { 'Authorization': `Bearer ${session.access_token}` } }
).then(r => r.json())

if (sharedWithMe?.shares) {
  // Fetch les projets partagés
  const sharedProjectIds = sharedWithMe.shares
    .filter(s => s.resource_type === 'project')
    .map(s => s.resource_id)

  if (sharedProjectIds.length > 0) {
    const { data: sharedProjects } = await supabase
      .from('projects')
      .select('*')
      .in('id', sharedProjectIds)

    // Ajouter à la liste avec un badge "Partagé"
    if (sharedProjects) {
      setProjects(prev => [
        ...prev,
        ...sharedProjects.map(p => ({ ...p, isShared: true }))
      ])
    }
  }
}
```

---

## 5. API de l'Edge Function `invitations`

| Action | Méthode | Description |
|--------|---------|-------------|
| `invite` | POST | Inviter par email `{email}` |
| `list` | GET | Lister mes invitations envoyées |
| `contacts` | GET | Lister mes contacts |
| `revoke` | PUT | Révoquer une invitation `{invitation_id}` |
| `remove-contact` | DELETE | Supprimer un contact `?contact_id=...` |
| `share` | POST | Partager `{contact_id, resource_type, resource_id, permission}` |
| `unshare` | DELETE | Retirer partage `?share_id=...` |
| `my-shares` | GET | Lister ce que j'ai partagé |
| `shared-with-me` | GET | Lister ce qu'on a partagé avec moi |
| `accept` | POST | Accepter une invitation (appelé par l'invité) |

---

## 6. Sécurité

- ✅ RLS sur toutes les tables
- ✅ Contacts bidirectionnels (les deux users se voient)
- ✅ Suppression cascade (supprimer contact → retire tous les partages)
- ✅ Vérification ownership avant partage
- ✅ Expiration des invitations (7 jours)
- ✅ Impossible de s'inviter soi-même (CHECK constraint)
- ✅ Un seul partage par resource/user (UNIQUE constraint)
