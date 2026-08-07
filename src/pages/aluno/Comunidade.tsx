import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { useAuth } from '../../context/AuthContext'
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getComments,
  getFeed,
  reportPost,
  toggleLike,
  type FeedPost,
} from '../../lib/social'
import { supabase } from '../../lib/supabase'
import type { Program, SocialComment, SocialScope } from '../../types/database'

const AVATAR_COLORS = ['#2f6f5e', '#a8842a', '#b5541f', '#1a3b6e', '#7c3aed', '#0891b2']

function colorForName(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const days = Math.floor(hr / 24)
  return `há ${days}d`
}

export function Comunidade() {
  const { profile } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [tab, setTab] = useState<SocialScope>('global')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)

  const myProgram = programs.find((p) => p.id === profile?.program_id) ?? null

  useEffect(() => {
    supabase
      .from('programs')
      .select('*')
      .then(({ data }) => setPrograms((data as Program[]) ?? []))
  }, [])

  async function reload() {
    if (!profile) return
    setLoading(true)
    const data = await getFeed({ scope: tab, programId: profile.program_id, viewerId: profile.id })
    setPosts(data)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, tab])

  if (!profile) return null

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Comunidade</h1>
        <p className="mt-1 text-ink-soft">Compartilhe o andamento do seu curso com os colegas.</p>

        <div className="mt-6 flex gap-2 rounded-full bg-surface p-1 shadow-sm">
          <button
            onClick={() => setTab('global')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              tab === 'global' ? 'bg-navy text-white' : 'text-ink-soft'
            }`}
          >
            Global
          </button>
          <button
            onClick={() => setTab('curso')}
            disabled={!profile.program_id}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition disabled:opacity-40 ${
              tab === 'curso' ? 'bg-navy text-white' : 'text-ink-soft'
            }`}
          >
            {myProgram ? `Meu curso — ${myProgram.name}` : 'Meu curso'}
          </button>
        </div>

        <Composer
          userId={profile.id}
          userName={profile.name}
          myProgramId={profile.program_id}
          defaultScope={tab}
          onPosted={reload}
        />

        <div className="mt-6 space-y-4">
          {loading && <p className="text-ink-soft">Carregando…</p>}
          {!loading &&
            posts.map((post) => (
              <PostCard key={post.id} post={post} viewerId={profile.id} programs={programs} onChanged={reload} />
            ))}
          {!loading && posts.length === 0 && (
            <p className="text-ink-soft">
              {tab === 'curso' && !profile.program_id
                ? 'Vincule seu curso no PDI express pra ver o mural do seu curso.'
                : 'Nenhum post por aqui ainda — seja o primeiro a compartilhar algo.'}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

function Composer({
  userId,
  userName,
  myProgramId,
  defaultScope,
  onPosted,
}: {
  userId: string
  userName: string
  myProgramId: string | null
  defaultScope: SocialScope
  onPosted: () => void
}) {
  const [scope, setScope] = useState<SocialScope>(defaultScope)
  const [body, setBody] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setScope(defaultScope), [defaultScope])

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  async function submit() {
    if (!body.trim() && images.length === 0) return
    setPosting(true)
    setError('')
    try {
      await createPost({
        authorId: userId,
        authorName: userName,
        authorProgramId: myProgramId,
        scope,
        programId: myProgramId,
        body: body.trim(),
        images,
      })
      setBody('')
      setImages([])
      onPosted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar o post.')
    }
    setPosting(false)
  }

  return (
    <div className="card mt-4 p-4">
      <textarea
        className="w-full resize-none rounded-xl border border-navy-light px-3 py-2.5 text-sm outline-none focus:border-navy"
        rows={3}
        placeholder="O que está rolando no seu curso?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {previews.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-lg border border-navy-light">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-navy-light px-2.5 py-1.5 text-xs font-semibold text-navy hover:border-navy">
            <Icon name="image" size={14} />
            Imagens
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setImages((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
            />
          </label>

          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as SocialScope)}
            disabled={!myProgramId}
            className="rounded-lg border border-navy-light px-2 py-1.5 text-xs font-semibold text-navy disabled:opacity-50"
          >
            <option value="global">Postar em: Global</option>
            {myProgramId && <option value="curso">Postar em: Meu curso</option>}
          </select>
        </div>

        <button
          onClick={submit}
          disabled={posting || (!body.trim() && images.length === 0)}
          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-50"
        >
          {posting ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}
    </div>
  )
}

function PostCard({
  post,
  viewerId,
  programs,
  onChanged,
}: {
  post: FeedPost
  viewerId: string
  programs: Program[]
  onChanged: () => void
}) {
  const [liked, setLiked] = useState(post.likedByMe)
  const [likeCount, setLikeCount] = useState(post.likeCount)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const courseName = programs.find((p) => p.id === post.author_program_id)?.name

  async function handleLike() {
    setLiked((v) => !v)
    setLikeCount((v) => (liked ? v - 1 : v + 1))
    await toggleLike(post.id, viewerId, liked)
  }

  async function handleDelete() {
    if (!confirm('Excluir este post?')) return
    await deletePost(post.id)
    onChanged()
  }

  async function handleReport() {
    const reason = prompt('Por que você está denunciando este post?')
    if (!reason) return
    await reportPost(post.id, viewerId, reason)
    setMenuOpen(false)
    alert('Denúncia enviada — obrigado por ajudar a manter a comunidade saudável.')
  }

  return (
    <article className="card p-4">
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: colorForName(post.author_name) }}
        >
          {initials(post.author_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">
            {post.author_name}
            {courseName && <span className="font-medium text-ink-soft"> · {courseName}</span>}
          </p>
          <p className="text-xs text-ink-faint">
            {relativeTime(post.created_at)} · {post.scope === 'global' ? 'Global' : 'Meu curso'}
          </p>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen((v) => !v)} className="rounded-full p-1 text-ink-faint hover:bg-navy-light">
            <Icon name="more-horizontal" size={16} />
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />
              <div className="card absolute right-0 z-20 mt-1 w-40 overflow-hidden p-1">
                {post.author_id === viewerId ? (
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-brand-red hover:bg-navy-light"
                  >
                    <Icon name="trash" size={14} /> Excluir
                  </button>
                ) : (
                  <button
                    onClick={handleReport}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-navy-light"
                  >
                    <Icon name="flag" size={14} /> Denunciar
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {post.body && <p className="mt-3 whitespace-pre-wrap text-sm text-ink">{post.body}</p>}

      {post.media.length === 1 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-navy-light">
          <img src={post.media[0].url} alt="" className="max-h-[420px] w-full object-cover" />
        </div>
      )}
      {post.media.length > 1 && (
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto rounded-xl">
          {post.media.map((m) => (
            <img
              key={m.id}
              src={m.url}
              alt=""
              className="h-64 w-64 shrink-0 snap-start rounded-xl border border-navy-light object-cover"
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 border-t border-navy-light/60 pt-3 text-sm font-semibold text-ink-soft">
        <button onClick={handleLike} className={`flex items-center gap-1.5 ${liked ? 'text-brand-red' : ''}`}>
          <Icon name={liked ? 'heart-filled' : 'heart'} size={16} />
          {likeCount}
        </button>
        <button onClick={() => setShowComments((v) => !v)} className="flex items-center gap-1.5">
          <Icon name="message-circle" size={16} />
          {post.commentCount}
        </button>
      </div>

      {showComments && <Comments postId={post.id} viewerId={viewerId} viewerName={post.author_name} />}
    </article>
  )
}

function Comments({ postId, viewerId, viewerName }: { postId: string; viewerId: string; viewerName: string }) {
  const [comments, setComments] = useState<SocialComment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)

  async function reload() {
    setComments(await getComments(postId))
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  async function submit() {
    if (!body.trim()) return
    await addComment(postId, viewerId, viewerName, body.trim())
    setBody('')
    reload()
  }

  async function remove(id: string) {
    await deleteComment(id)
    reload()
  }

  return (
    <div className="mt-3 space-y-2.5 border-t border-navy-light/60 pt-3">
      {loading && <p className="text-xs text-ink-soft">Carregando comentários…</p>}
      {!loading &&
        comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: colorForName(c.author_name) }}
            >
              {initials(c.author_name)}
            </span>
            <div className="min-w-0 flex-1 rounded-xl bg-bg px-3 py-1.5">
              <p className="text-xs font-semibold text-ink">{c.author_name}</p>
              <p className="text-sm text-ink">{c.body}</p>
            </div>
            {c.author_id === viewerId && (
              <button onClick={() => remove(c.id)} className="mt-1 text-ink-faint hover:text-brand-red">
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
        ))}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Escreva um comentário…"
          className="flex-1 rounded-full border border-navy-light px-3 py-1.5 text-sm outline-none focus:border-navy"
        />
        <button onClick={submit} className="rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white">
          Enviar
        </button>
      </div>
    </div>
  )
}
