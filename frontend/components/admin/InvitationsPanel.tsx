'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Users, Trash2, Check, X, Loader2, Send, Clock, Shield,
  FolderOpen, MessageSquare, Share2, RefreshCw, Mail, AlertCircle,
  ChevronDown, Eye, Edit3, UserX, Key
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface Invitation {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  created_at: string
  accepted_at: string | null
  expires_at: string
}

interface Contact {
  contact_id: string
  email: string
  name: string
  nickname: string | null
  created_at: string
}

interface Share {
  id: string
  owner_id: string
  shared_with_id: string
  resource_type: 'project' | 'conversation'
  resource_id: string
  permission: 'view' | 'edit'
  created_at: string
}

export default function InvitationsPanel({ onManageKeys }: { onManageKeys?: (userId: string, name: string) => void }) {
  const supabase = createClient()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [shares, setShares] = useState<Share[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'contacts' | 'invitations' | 'shares'>('contacts')

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Share form
  const [isSharing, setIsSharing] = useState(false)
  const [shareContactId, setShareContactId] = useState('')
  const [shareType, setShareType] = useState<'project' | 'conversation'>('project')
  const [shareResourceId, setShareResourceId] = useState('')
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view')
  const [isSavingShare, setIsSavingShare] = useState(false)

  const apiCall = useCallback(async (action: string, method: string = 'GET', body?: any) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invitations?action=${action}`
    const opts: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Content-Type': 'application/json'
      }
    }
    if (body && method !== 'GET') opts.body = JSON.stringify(body)

    const res = await fetch(url, opts)
    return res.json()
  }, [supabase])

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [invRes, contactsRes, sharesRes] = await Promise.all([
        apiCall('list'),
        apiCall('contacts'),
        apiCall('my-shares'),
      ])

      if (invRes?.invitations) setInvitations(invRes.invitations)
      if (contactsRes?.contacts) setContacts(contactsRes.contacts)
      if (sharesRes?.shares) setShares(sharesRes.shares)

      // Fetch user's projects and conversations for share form
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: proj } = await supabase
          .from('projects').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false })
        const { data: conv } = await supabase
          .from('conversations').select('id, title').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
        if (proj) setProjects(proj)
        if (conv) setConversations(conv)
      }
    } catch (err) {
      console.error('[InvitationsPanel] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [apiCall, supabase])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // === Invite ===
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setIsSendingInvite(true)
    setInviteMsg(null)

    try {
      const res = await apiCall('invite', 'POST', { email: inviteEmail.trim() })
      if (res?.error) {
        setInviteMsg({ type: 'error', text: res.error })
      } else {
        const msg = res?.auto_accepted
          ? `${inviteEmail} est déjà inscrit — ajouté directement à vos contacts !`
          : `Invitation envoyée à ${inviteEmail}`
        setInviteMsg({ type: 'success', text: msg })
        setInviteEmail('')
        fetchAll()
      }
    } catch (err: any) {
      setInviteMsg({ type: 'error', text: err.message })
    } finally {
      setIsSendingInvite(false)
      setTimeout(() => setInviteMsg(null), 5000)
    }
  }

  // === Revoke ===
  const handleRevoke = async (invId: string) => {
    await apiCall('revoke', 'PUT', { invitation_id: invId })
    setInvitations(prev => prev.map(i => i.id === invId ? { ...i, status: 'revoked' as const } : i))
  }

  // === Remove Contact ===
  const handleRemoveContact = async (contactId: string, name: string) => {
    if (!confirm(`Supprimer ${name} de vos contacts ? Tous les partages avec cette personne seront supprimés.`)) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invitations?action=remove-contact&contact_id=${contactId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Content-Type': 'application/json'
      }
    })

    setContacts(prev => prev.filter(c => c.contact_id !== contactId))
    setShares(prev => prev.filter(s => s.shared_with_id !== contactId))
  }

  // === Share ===
  const handleShare = async () => {
    if (!shareContactId || !shareResourceId) return
    setIsSavingShare(true)
    try {
      await apiCall('share', 'POST', {
        contact_id: shareContactId,
        resource_type: shareType,
        resource_id: shareResourceId,
        permission: sharePermission
      })
      setIsSharing(false)
      setShareResourceId('')
      fetchAll()
    } catch (err) {
      console.error('[Share] Error:', err)
    } finally {
      setIsSavingShare(false)
    }
  }

  // === Unshare ===
  const handleUnshare = async (shareId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invitations?action=unshare&share_id=${shareId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Content-Type': 'application/json'
      }
    })

    setShares(prev => prev.filter(s => s.id !== shareId))
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-[#5C4B40]/10 text-[#5C4B40]',
      accepted: 'bg-emerald-100 text-emerald-700',
      revoked: 'bg-red-100 text-red-700',
      expired: 'bg-[#5C4B40]/5 text-[#5C4B40]/30',
    }
    const labels: Record<string, string> = {
      pending: '⏳ En attente',
      accepted: '✓ Acceptée',
      revoked: '✕ Révoquée',
      expired: '⌛ Expirée',
    }
    return (
      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#5C4B40]/10 rounded-xl">
            <Users size={20} className="text-[#5C4B40]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#5C4B40]">Utilisateurs & Partage</h3>
            <p className="text-xs text-[#5C4B40]/50">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''} • {shares.length} partage{shares.length !== 1 ? 's' : ''} actif{shares.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={fetchAll} className="p-2 text-[#5C4B40]/40 hover:text-[#5C4B40] transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Invite Form */}
      <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#5C4B40]/60 uppercase tracking-widest">
          <UserPlus size={12} />
          Inviter un utilisateur
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C4B40]/20" size={14} />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="email@exemple.com"
              className="w-full pl-9 pr-4 py-2.5 bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#5C4B40]/10"
            />
          </div>
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim() || isSendingInvite}
            className="px-5 py-2.5 bg-[#5C4B40] text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSendingInvite ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Inviter
          </button>
        </div>
        <AnimatePresence>
          {inviteMsg && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium ${inviteMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
            >
              {inviteMsg.type === 'success' ? <Check size={12} /> : <AlertCircle size={12} />}
              {inviteMsg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-[#5C4B40]/5 rounded-2xl w-full border border-[#5C4B40]/5">
        {[
          { key: 'contacts' as const, label: 'Contacts', icon: Users, count: contacts.length },
          { key: 'invitations' as const, label: 'Invitations', icon: Mail, count: invitations.filter(i => i.status === 'pending').length },
          { key: 'shares' as const, label: 'Partages', icon: Share2, count: shares.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 border ${activeTab === tab.key
                ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-lg shadow-[#5C4B40]/20 border-[#5C4B40]'
                : 'text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 border-transparent'
              }`}
          >
            <tab.icon size={14} strokeWidth={2.5} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[#5C4B40]/10 text-[#5C4B40]'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-[#5C4B40]/20">
          <Loader2 size={24} className="animate-spin mb-3" />
          <p className="text-xs font-bold uppercase tracking-widest">Chargement...</p>
        </div>
      ) : (
        <>
          {/* === CONTACTS TAB === */}
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              {contacts.length === 0 ? (
                <div className="text-center py-12 text-[#5C4B40]/20">
                  <Users size={40} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-bold">Aucun contact</p>
                  <p className="text-xs mt-1">Invitez quelqu'un pour commencer à partager</p>
                </div>
              ) : (
                contacts.map(contact => (
                  <div
                    key={contact.contact_id}
                    className="group flex items-center gap-4 p-4 bg-white border border-[#5C4B40]/10 rounded-2xl hover:shadow-sm transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#5C4B40]/10 flex items-center justify-center text-[#5C4B40] font-black text-sm">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#5C4B40] truncate">{contact.name}</p>
                      <p className="text-[10px] text-[#5C4B40]/40 truncate">{contact.email}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onManageKeys?.(contact.contact_id, contact.name)}
                        className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                        title="Gérer ses clés API"
                      >
                        <Key size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setIsSharing(true)
                          setShareContactId(contact.contact_id)
                          setActiveTab('shares')
                        }}
                        className="p-2 text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 rounded-lg transition-all"
                        title="Partager une ressource"
                      >
                        <Share2 size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveContact(contact.contact_id, contact.name)}
                        className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Supprimer le contact"
                      >
                        <UserX size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* === INVITATIONS TAB === */}
          {activeTab === 'invitations' && (
            <div className="space-y-3">
              {invitations.length === 0 ? (
                <div className="text-center py-12 text-[#5C4B40]/20">
                  <Mail size={40} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-bold">Aucune invitation</p>
                </div>
              ) : (
                invitations.map(inv => (
                  <div
                    key={inv.id}
                    className={`flex items-center gap-4 p-4 bg-white border border-[#5C4B40]/10 rounded-2xl ${inv.status !== 'pending' ? 'opacity-50' : ''}`}
                  >
                    <Mail size={16} className="text-[#5C4B40]/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#5C4B40] truncate">{inv.email}</p>
                      <p className="text-[9px] text-[#5C4B40]/30 mt-1">
                        Envoyée le {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    {getStatusBadge(inv.status)}
                    {inv.status === 'pending' && (
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        className="p-1.5 text-red-300 hover:text-red-500 rounded-lg transition-all"
                        title="Révoquer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* === SHARES TAB === */}
          {activeTab === 'shares' && (
            <div className="space-y-3">
              {!isSharing && (
                <button
                  onClick={() => setIsSharing(true)}
                  disabled={contacts.length === 0}
                  className="w-full py-4 border-2 border-dashed border-[#5C4B40]/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] text-[#5C4B40]/30 hover:text-[#5C4B40] hover:border-[#5C4B40]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Share2 size={14} />
                  Nouveau partage (Projet / Conversation)
                </button>
              )}

              {/* Share Form */}
              <AnimatePresence>
                {isSharing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white border border-[#5C4B40]/10 rounded-2xl p-5 space-y-4">
                      <div className="text-[10px] font-black text-[#5C4B40]/60 uppercase tracking-widest">Nouveau partage</div>

                      {/* Contact */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#5C4B40]/40 block mb-2">Partager avec</label>
                        <select
                          value={shareContactId}
                          onChange={(e) => setShareContactId(e.target.value)}
                          className="w-full bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl px-3 py-3 text-xs focus:outline-none"
                        >
                          <option value="">Choisir un contact...</option>
                          {contacts.map(c => (
                            <option key={c.contact_id} value={c.contact_id}>{c.name} ({c.email})</option>
                          ))}
                        </select>
                      </div>

                      {/* Resource Type */}
                      <div className="flex gap-2 p-1 bg-[#5C4B40]/5 rounded-2xl w-full border border-[#5C4B40]/5">
                        {[
                          { key: 'project' as const, label: 'Projet', icon: FolderOpen },
                          { key: 'conversation' as const, label: 'Conversation', icon: MessageSquare },
                        ].map(t => (
                          <button
                            key={t.key}
                            onClick={() => { setShareType(t.key); setShareResourceId('') }}
                            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 border ${shareType === t.key
                                ? 'bg-[#5C4B40] text-[#EAE1D3] shadow-lg border-[#5C4B40]'
                                : 'text-[#5C4B40]/40 hover:text-[#5C4B40] hover:bg-[#5C4B40]/5 border-transparent'
                              }`}
                          >
                            <t.icon size={14} strokeWidth={2.5} />
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Resource Select */}
                      <select
                        value={shareResourceId}
                        onChange={(e) => setShareResourceId(e.target.value)}
                        className="w-full bg-[#F8F6F2] border border-[#5C4B40]/10 rounded-xl px-3 py-3 text-xs focus:outline-none"
                      >
                        <option value="">Choisir {shareType === 'project' ? 'un projet' : 'une conversation'}...</option>
                        {(shareType === 'project' ? projects : conversations).map(r => (
                          <option key={r.id} value={r.id}>{r.name || r.title || 'Sans titre'}</option>
                        ))}
                      </select>

                      {/* Permission */}
                      <div className="flex gap-2">
                        {[
                          { key: 'view' as const, label: 'Lecture seule', icon: Eye },
                          { key: 'edit' as const, label: 'Édition', icon: Edit3 },
                        ].map(p => (
                          <button
                            key={p.key}
                            onClick={() => setSharePermission(p.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${sharePermission === p.key ? 'border-[#5C4B40] bg-[#5C4B40]/5 text-[#5C4B40]' : 'border-[#5C4B40]/10 text-[#5C4B40]/40'}`}
                          >
                            <p.icon size={14} className="mr-2" strokeWidth={2.5} />
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => setIsSharing(false)}
                          className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#5C4B40]/40 hover:text-[#5C4B40]"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleShare}
                          disabled={!shareContactId || !shareResourceId || isSavingShare}
                          className="px-8 py-3 bg-[#5C4B40] text-[#EAE1D3] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-[#5C4B40]/20"
                        >
                          {isSavingShare ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                          Confirmer le partage
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Existing Shares */}
              {shares.length === 0 && !isSharing ? (
                <div className="text-center py-12 text-[#5C4B40]/20">
                  <Share2 size={40} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-bold">Aucun partage actif</p>
                </div>
              ) : (
                shares.map(share => {
                  const contact = contacts.find(c => c.contact_id === share.shared_with_id)
                  return (
                    <div
                      key={share.id}
                      className="group flex items-center gap-3 p-4 bg-white border border-[#5C4B40]/10 rounded-2xl hover:shadow-sm transition-all"
                    >
                      {share.resource_type === 'project' ? (
                        <FolderOpen size={14} className="text-[#5C4B40]/40 shrink-0" />
                      ) : (
                        <MessageSquare size={14} className="text-[#5C4B40]/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#5C4B40] truncate">
                          {share.resource_type === 'project' ? 'Projet' : 'Conversation'} partagé
                        </p>
                        <p className="text-[9px] text-[#5C4B40]/30 truncate uppercase tracking-widest font-black">
                          avec {contact?.name || contact?.email || share.shared_with_id} • {share.permission === 'view' ? 'Lecture' : 'Édition'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnshare(share.id)}
                        className="p-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 rounded-lg transition-all"
                        title="Retirer le partage"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
