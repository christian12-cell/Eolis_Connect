'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Pencil, UserPlus, X, Eye, EyeOff, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'
import { apiFetch, getUser } from '@/lib/api-client'
import { PhoneInput } from '@/components/ui/PhoneInput'

function generateUsername(firstName: string, lastName: string): string {
  function clean(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '')
  }
  // Take only first word of each name
  const f = clean((firstName.trim().split(/\s+/)[0]) ?? '')
  const l = clean((lastName.trim().split(/\s+/)[0])  ?? '')
  if (!f) return ''
  const first = f[0].toUpperCase() + f.slice(1).toLowerCase()
  return l ? `${first}.${l.toUpperCase()}` : first
}

interface User {
  id: string
  username: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  role: string
  status: string
  language: string
  createdAt: string
}

interface Props {
  users: User[]
  locale: string
  total: number
  page: number
  pageSize: number
  currentQ: string
  currentRole: string
  onRefresh?: () => void
  onPageChange?: (p: number) => void
}

const ROLES = ['CLIENT', 'AGENT', 'OPS_ADMIN', 'FINANCE_AGENT', 'SYSTEM_ADMIN']
const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  CLIENT:        { fr: 'Client',          en: 'Client'         },
  AGENT:         { fr: 'Agent',           en: 'Agent'          },
  OPS_ADMIN:     { fr: 'Admin Ops',       en: 'Ops Admin'      },
  FINANCE_AGENT: { fr: 'Agent Financier', en: 'Finance Agent'  },
  SYSTEM_ADMIN: { fr: 'Admin Sys.',   en: 'Sys Admin'  },
}
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: { fr: string; en: string } }> = {
  PENDING:   { bg: 'bg-amber-100',  text: 'text-amber-700',  label: { fr: 'En attente', en: 'Pending'   } },
  ACTIVE:    { bg: 'bg-emerald-100',text: 'text-emerald-700',label: { fr: 'Actif',      en: 'Active'    } },
  SUSPENDED: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: { fr: 'Suspendu',  en: 'Suspended' } },
  REJECTED:  { bg: 'bg-red-100',    text: 'text-red-600',    label: { fr: 'Refusé',    en: 'Rejected'  } },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder = '', readOnly = false }: {
  value: string; onChange?: (v: string) => void; type?: string; placeholder?: string; readOnly?: boolean
}) {
  return (
    <input type={type} value={value} readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4] focus:border-transparent ${readOnly ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-200 bg-white'}`}
    />
  )
}

function ModalMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-center gap-2 text-xs p-3 rounded-xl border ${msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
      {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      {msg.text}
    </div>
  )
}

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({ locale, onClose, onDone }: { locale: string; onClose: () => void; onDone: () => void }) {
  const isFr = locale === 'fr'
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [username, setUsername]   = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('+237')
  const [role, setRole]           = useState('AGENT')
  const [password, setPassword]   = useState('')
  const [language, setLanguage]   = useState('fr')
  const [showPw, setShowPw]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null)

  // Auto-generate username from first+last name unless manually edited
  useEffect(() => {
    if (!usernameEdited) {
      setUsername(generateUsername(firstName, lastName))
    }
  }, [firstName, lastName, usernameEdited])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName || !lastName || !username || !email || !phone || !password) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await apiFetch('/api/users/admin/create', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, username, email, phone, role, password, language }),
      })
      if (res.ok) {
        setMsg({ ok: true, text: isFr ? 'Compte créé avec succès.' : 'Account created.' })
        setTimeout(() => { onDone(); onClose() }, 1200)
      } else {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail ?? ''
        const text = detail === 'username_taken'
          ? (isFr ? 'Identifiant déjà utilisé.' : 'Username already taken.')
          : detail === 'email_taken'
          ? (isFr ? 'Email déjà utilisé.' : 'Email already used.')
          : (isFr ? `Erreur serveur (${res.status}).` : `Server error (${res.status}).`)
        setMsg({ ok: false, text })
      }
    } catch {
      setMsg({ ok: false, text: isFr ? 'Impossible de joindre le serveur.' : 'Cannot reach server.' })
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{isFr ? 'Créer un compte' : 'Create account'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={isFr ? 'Prénom *' : 'First name *'}>
              <Input value={firstName} onChange={setFirstName} placeholder="Debora" />
            </Field>
            <Field label={isFr ? 'Nom *' : 'Last name *'}>
              <Input value={lastName} onChange={setLastName} placeholder="DENMEKO" />
            </Field>
          </div>

          <Field label={isFr ? 'Identifiant (login) *' : 'Username (login) *'}>
            <div>
              <Input value={username}
                onChange={v => { setUsername(v); setUsernameEdited(true) }}
                placeholder="Debora.DENMEKO" />
              {!usernameEdited && username && (
                <p className="text-[10px] text-[#4A8FC4] mt-1">
                  ✨ {isFr ? 'Généré automatiquement — modifiable' : 'Auto-generated — editable'}
                </p>
              )}
            </div>
          </Field>

          <Field label="Email *">
            <Input value={email} onChange={setEmail} type="email" placeholder="debora.denmeko@eolisgroup.com" />
          </Field>

          <Field label={isFr ? 'Téléphone *' : 'Phone *'}>
            <PhoneInput value={phone} onChange={setPhone} required />
          </Field>

          <Field label={isFr ? 'Mot de passe temporaire *' : 'Temporary password *'}>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]" />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {isFr ? 'L\'utilisateur recevra un lien sécurisé pour le récupérer.' : 'The user will receive a secure link to retrieve it.'}
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={isFr ? 'Rôle' : 'Role'}>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]?.[isFr ? 'fr' : 'en'] ?? r}</option>)}
              </select>
            </Field>
            <Field label={isFr ? 'Langue' : 'Language'}>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>

          <ModalMsg msg={msg} />
          <button type="submit" disabled={saving || !firstName || !lastName || !username || !email || !phone || !password}
            className="w-full py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] disabled:opacity-50 transition-colors">
            {saving ? '...' : (isFr ? 'Créer le compte' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ user, locale, onClose, onDone }: { user: User; locale: string; onClose: () => void; onDone: () => void }) {
  const isFr = locale === 'fr'
  const [username, setUsername]   = useState(user.username)
  const [email, setEmail]         = useState(user.email)
  const [phone, setPhone]         = useState(user.phone ?? '')
  const [role, setRole]           = useState(user.role)
  const [status, setStatus]       = useState(user.status)
  const [newPw, setNewPw]         = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const payload: Record<string, string> = { username, email, phone: phone || '', role, status }
    if (newPw.trim()) payload.newPassword = newPw.trim()
    const res = await apiFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setMsg({ ok: true, text: isFr ? 'Modifications enregistrées.' : 'Changes saved.' })
      setNewPw('')
      setTimeout(() => { onDone(); onClose() }, 1200)
    } else {
      const err = await res.json().catch(() => ({}))
      const detail = err.detail ?? ''
      const text = detail === 'username_taken'
        ? (isFr ? 'Identifiant déjà utilisé.' : 'Username already taken.')
        : detail === 'email_taken'
        ? (isFr ? 'Email déjà utilisé.' : 'Email already used.')
        : (isFr ? 'Erreur lors de la mise à jour.' : 'Update failed.')
      setMsg({ ok: false, text })
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{isFr ? 'Modifier le compte' : 'Edit account'}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{user.username}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <Field label={isFr ? 'Identifiant (login)' : 'Username (login)'}>
            <Input value={username} onChange={setUsername} placeholder="Debora.DENMEKO" />
          </Field>
          <Field label="Email">
            <Input value={email} onChange={setEmail} type="email" />
          </Field>
          <Field label={isFr ? 'Téléphone' : 'Phone'}>
            <Input value={phone} onChange={setPhone} placeholder="+237 6XX XXX XXX" />
          </Field>
          <Field label={isFr ? 'Rôle' : 'Role'}>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]?.[isFr ? 'fr' : 'en'] ?? r}</option>)}
            </select>
          </Field>
          <Field label={isFr ? 'Statut' : 'Status'}>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]">
              {['ACTIVE', 'SUSPENDED', 'REJECTED'].map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label[isFr ? 'fr' : 'en'] ?? s}</option>
              ))}
            </select>
          </Field>
          <Field label={isFr ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'New password (leave empty to keep current)'}>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder={isFr ? 'Laisser vide...' : 'Leave empty...'}
                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A8FC4]" />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
          <ModalMsg msg={msg} />
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] disabled:opacity-60 transition-colors">
            {saving ? '...' : (isFr ? 'Enregistrer' : 'Save changes')}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────

export default function UsersTable({ users, locale, total, page, pageSize, currentQ, currentRole, onRefresh, onPageChange }: Props) {
  const isFr = locale === 'fr'
  const me = getUser()
  const [showCreate, setShowCreate]   = useState(false)
  const [editUser, setEditUser]       = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const totalPages = Math.ceil(total / pageSize)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await apiFetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    onRefresh?.()
  }

  const t = {
    create:   isFr ? 'Créer un compte' : 'Create account',
    username: isFr ? 'Identifiant' : 'Username',
    email:    isFr ? 'Email' : 'Email',
    role:     isFr ? 'Rôle' : 'Role',
    status:   isFr ? 'Statut' : 'Status',
    since:    isFr ? 'Depuis' : 'Since',
    edit:     isFr ? 'Modifier' : 'Edit',
    noUsers:  isFr ? 'Aucun utilisateur' : 'No users',
    delete:   isFr ? 'Supprimer' : 'Delete',
    delConfirmTitle: isFr ? 'Supprimer ce compte ?' : 'Delete this account?',
    delConfirmBody: isFr
      ? 'Cette action est irréversible. Un email et un SMS seront envoyés à l\'utilisateur.'
      : 'This action is irreversible. An email and SMS will be sent to the user.',
    delConfirm: isFr ? 'Supprimer' : 'Delete',
    cancel:   isFr ? 'Annuler' : 'Cancel',
  }

  return (
    <>
      {/* Create button */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#152d47] transition-colors">
          <UserPlus size={15} /> {t.create}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
        {users.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-gray-400">{t.noUsers}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="px-5 py-3 text-left">{t.username}</th>
                  <th className="px-3 py-3 text-left">{t.email}</th>
                  <th className="px-3 py-3 text-left">{t.role}</th>
                  <th className="px-3 py-3 text-left">{t.status}</th>
                  <th className="px-3 py-3 text-left">{t.since}</th>
                  <th className="px-3 py-3 text-left">{t.edit}</th>
                  <th className="px-3 py-3 text-left">{t.delete}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => {
                  const statusConf = STATUS_CONFIG[u.status]
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1B3A5C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {u.firstName?.charAt(0)}{u.lastName?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-mono text-xs font-semibold text-gray-800">{u.username}</p>
                            <p className="text-[10px] text-gray-400">{u.firstName} {u.lastName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{u.email}</td>
                      <td className="px-3 py-3">
                        <span className="text-xs font-medium text-gray-700">
                          {ROLE_LABELS[u.role]?.[isFr ? 'fr' : 'en'] ?? u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConf?.bg ?? 'bg-gray-100'} ${statusConf?.text ?? 'text-gray-600'}`}>
                          {statusConf?.label[isFr ? 'fr' : 'en'] ?? u.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString(isFr ? 'fr-CM' : 'en-GB')}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => setEditUser(u)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B3A5C]/5 text-[#1B3A5C] text-xs font-semibold hover:bg-[#1B3A5C]/10 transition-colors">
                          <Pencil size={12} /> {t.edit}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        {u.id !== me?.id && (
                          <button onClick={() => setDeleteTarget(u)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <button onClick={() => onPageChange?.(page - 1)}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
          )}
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => onPageChange?.(i + 1)}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium ${
                page === i + 1 ? 'bg-[#1B3A5C] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {i + 1}
            </button>
          ))}
          {page < totalPages && (
            <button onClick={() => onPageChange?.(page + 1)}
              className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {showCreate && (
        <CreateModal locale={locale} onClose={() => setShowCreate(false)} onDone={() => onRefresh?.()} />
      )}
      {editUser && (
        <EditModal user={editUser} locale={locale} onClose={() => setEditUser(null)} onDone={() => onRefresh?.()} />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{t.delConfirmTitle}</h3>
                <p className="text-xs text-gray-400 font-mono">{deleteTarget.username}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">{t.delConfirmBody}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-semibold hover:bg-gray-50 transition-colors">
                {t.cancel}
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleting ? '...' : t.delConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
