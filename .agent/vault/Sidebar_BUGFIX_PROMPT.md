# ANTIGRAVITY TASK: Fix 6 bugs in Sidebar.tsx
# CONSTRAINT: Apply ONLY the listed changes. Do NOT modify anything else.

---

## BUG 1 + BUG 2 — fetchData sans user_id + Realtime sans filtre user
### These are in the same area. Apply both together.

### Step 1: Replace `fetchData`:
```tsx
// BEFORE:
const fetchData = useCallback(async () => {
    const { data: proj } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    const { data: conv } = await supabase
        .from('conversations')
        .select('*, mode, canvas_mode')
        .order('created_at', { ascending: false })
    if (proj) setProjects(proj)
    if (conv) setConversations(conv)
}, [])

// AFTER:
const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: proj } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    const { data: conv } = await supabase
        .from('conversations')
        .select('*, mode, canvas_mode')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    if (proj) setProjects(proj)
    if (conv) setConversations(conv)
}, [])
```

### Step 2: Replace the Realtime useEffect:
```tsx
// BEFORE:
useEffect(() => {
    fetchData()

    const projectsSub = supabase
        .channel('projects-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchData())
        .subscribe()

    const conversationsSub = supabase
        .channel('conversations-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchData())
        .subscribe()

    return () => {
        supabase.removeChannel(projectsSub)
        supabase.removeChannel(conversationsSub)
    }
}, [fetchData])

// AFTER:
useEffect(() => {
    fetchData()

    let projectsSub: any = null
    let conversationsSub: any = null

    const setupRealtime = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        projectsSub = supabase
            .channel(`projects-rt-${user.id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
                () => fetchData()
            )
            .subscribe()

        conversationsSub = supabase
            .channel(`conversations-rt-${user.id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'conversations', filter: `user_id=eq.${user.id}` },
                () => fetchData()
            )
            .subscribe()
    }

    setupRealtime()

    return () => {
        if (projectsSub) supabase.removeChannel(projectsSub)
        if (conversationsSub) supabase.removeChannel(conversationsSub)
    }
}, [fetchData])
```

---

## BUG 3 — handleDeleteProject sans user_id
### Fix: Add user auth + user_id filter:
```tsx
// BEFORE:
const handleDeleteProject = useCallback(async (id: string) => {
    console.log('Tentative de suppression du projet:', id)
    if (!confirm('Supprimer ce dossier ? Les conversations seront conservées.')) {
        console.log('Suppression annulée par l\'utilisateur')
        return
    }

    const { error } = await supabase.from('projects').delete().eq('id', id)

// AFTER:
const handleDeleteProject = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce dossier ? Les conversations seront conservées.')) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
```
(Rest of the function stays identical, just remove the console.log statements)

---

## BUG 4 + BUG 5 — localStorage sans guard SSR + save écrase au mount

### Problem: Three useEffects interact badly:
### 1. Load effect reads from localStorage
### 2. Save effect for openSections fires immediately with default values, OVERWRITING saved values
### 3. Same for isCollapsed

### Fix: Replace ALL THREE localStorage useEffects with a single hydrated pattern:

```tsx
// BEFORE (3 separate useEffects):
// Load states from localStorage
useEffect(() => {
    const savedSections = localStorage.getItem('sidebar-sections')
    if (savedSections) {
        try {
            setOpenSections(JSON.parse(savedSections))
        } catch (e) { console.error(e) }
    }

    const savedCollapsed = localStorage.getItem('sidebar-collapsed')
    if (savedCollapsed !== null) {
        setIsCollapsed(savedCollapsed === 'true')
    }
}, [])

// Save sections to localStorage
useEffect(() => {
    localStorage.setItem('sidebar-sections', JSON.stringify(openSections))
}, [openSections])

// Save collapse state to localStorage
useEffect(() => {
    localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
}, [isCollapsed])

// AFTER (hydrated pattern — replace all 3 with these 3):
const [isHydrated, setIsHydrated] = useState(false)

// Load states from localStorage (SSR-safe)
useEffect(() => {
    if (typeof window === 'undefined') return
    try {
        const savedSections = localStorage.getItem('sidebar-sections')
        if (savedSections) {
            setOpenSections(JSON.parse(savedSections))
        }
    } catch (e) { console.error(e) }

    try {
        const savedCollapsed = localStorage.getItem('sidebar-collapsed')
        if (savedCollapsed !== null) {
            setIsCollapsed(savedCollapsed === 'true')
        }
    } catch (e) { console.error(e) }

    setIsHydrated(true)
}, [])

// Save to localStorage only AFTER hydration (prevents overwriting saved values)
useEffect(() => {
    if (!isHydrated) return
    try {
        localStorage.setItem('sidebar-sections', JSON.stringify(openSections))
        localStorage.setItem('sidebar-collapsed', isCollapsed.toString())
    } catch (e) { console.error(e) }
}, [openSections, isCollapsed, isHydrated])
```

NOTE: The `isHydrated` state declaration should go near the other useState declarations at the top of the Sidebar component.

---

## BUG 6 — SidebarSection React.memo sans displayName
### Fix: Add displayName after the component definition:
```tsx
// ADD THIS LINE right after the closing )) of SidebarSection:
SidebarSection.displayName = 'SidebarSection'
```

---

## SUMMARY OF ALL CHANGES (6 bugs):
1. ✅ `fetchData`: add `user_id` filter to both queries
2. ✅ Realtime: add `filter: user_id=eq.${user.id}` + unique channel names
3. ✅ `handleDeleteProject`: add `user_id` filter + auth check
4. ✅ localStorage: add SSR guard (`typeof window !== 'undefined'`)
5. ✅ localStorage save: hydration flag prevents overwriting saved prefs at mount
6. ✅ SidebarSection: add `displayName`

## DO NOT MODIFY ANYTHING ELSE. No formatting changes, no refactoring, no renaming.
