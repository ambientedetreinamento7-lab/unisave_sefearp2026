import { useEffect, useMemo, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { Icon } from '../../components/Icon'
import { useAuth } from '../../context/AuthContext'
import {
  addComment,
  closePoll,
  createImageStory,
  createPollPost,
  createPost,
  createVideoPost,
  createVideoStory,
  deleteComment,
  deletePost,
  deleteStory,
  getActiveStoryGroups,
  getComments,
  getFeed,
  getStoryViewers,
  recordStoryView,
  reportPost,
  toggleLike,
  voteInPoll,
  type FeedPost,
  type StoryGroup,
} from '../../lib/social'
import { supabase } from '../../lib/supabase'
import { MAX_VIDEO_DURATION_SECONDS, readVideoDuration, uploadVideoToVimeo } from '../../lib/vimeo'
import type { Program, SocialComment, SocialScope, SocialStoryView } from '../../types/database'

const MAX_STORY_VIDEO_SECONDS = 50

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
  const { profile, session } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [tab, setTab] = useState<SocialScope>('global')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])

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

  async function reloadStories() {
    if (!profile) return
    setStoryGroups(await getActiveStoryGroups(profile.id))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, tab])

  useEffect(() => {
    reloadStories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (!profile) return null

  return (
    <div className="min-h-screen bg-bg pb-16">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-extrabold text-ink">Comunidade</h1>
        <p className="mt-1 text-ink-soft">Compartilhe o andamento do seu curso com os colegas.</p>

        <StoriesRow
          userId={profile.id}
          userName={profile.name}
          myProgramId={profile.program_id}
          accessToken={session?.access_token ?? ''}
          groups={storyGroups}
          onChanged={reloadStories}
        />

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
          accessToken={session?.access_token ?? ''}
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

type ComposerMode = 'post' | 'video' | 'enquete'

function Composer({
  userId,
  userName,
  myProgramId,
  accessToken,
  defaultScope,
  onPosted,
}: {
  userId: string
  userName: string
  myProgramId: string | null
  accessToken: string
  defaultScope: SocialScope
  onPosted: () => void
}) {
  const [mode, setMode] = useState<ComposerMode>('post')
  const [scope, setScope] = useState<SocialScope>(defaultScope)
  const [body, setBody] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setScope(defaultScope), [defaultScope])

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])
  const videoPreview = useMemo(() => (video ? URL.createObjectURL(video) : null), [video])
  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview) }, [videoPreview])

  const validOptions = options.map((o) => o.trim()).filter(Boolean)
  const canSubmit =
    mode === 'post'
      ? !!body.trim() || images.length > 0
      : mode === 'video'
        ? !!video
        : !!question.trim() && validOptions.length >= 2

  function resetAll() {
    setBody('')
    setImages([])
    setVideo(null)
    setUploadPct(null)
    setQuestion('')
    setOptions(['', ''])
  }

  async function handleVideoSelect(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      const duration = await readVideoDuration(file)
      if (duration > MAX_VIDEO_DURATION_SECONDS) {
        setError(`Vídeo muito longo — máximo de ${Math.round(MAX_VIDEO_DURATION_SECONDS / 60)} minutos.`)
        return
      }
      setVideo(file)
    } catch {
      setError('Não foi possível ler esse vídeo.')
    }
  }

  async function submit() {
    if (!canSubmit) return
    setPosting(true)
    setError('')
    try {
      if (mode === 'post') {
        await createPost({
          authorId: userId,
          authorName: userName,
          authorProgramId: myProgramId,
          scope,
          programId: myProgramId,
          body: body.trim(),
          images,
        })
      } else if (mode === 'video') {
        if (!video) return
        setUploadPct(0)
        const { vimeoId } = await uploadVideoToVimeo(video, accessToken, setUploadPct)
        await createVideoPost({
          authorId: userId,
          authorName: userName,
          authorProgramId: myProgramId,
          scope,
          programId: myProgramId,
          body: body.trim(),
          vimeoId,
        })
      } else {
        await createPollPost({
          authorId: userId,
          authorName: userName,
          authorProgramId: myProgramId,
          scope,
          programId: myProgramId,
          question: question.trim(),
          options: validOptions,
        })
      }
      resetAll()
      onPosted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar.')
    }
    setPosting(false)
  }

  return (
    <div className="card mt-4 p-4">
      <div className="mb-3 flex gap-1.5">
        <button
          onClick={() => setMode('post')}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'post' ? 'bg-navy text-white' : 'bg-bg text-ink-soft'}`}
        >
          Post
        </button>
        <button
          onClick={() => setMode('video')}
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            mode === 'video' ? 'bg-navy text-white' : 'bg-bg text-ink-soft'
          }`}
        >
          <Icon name="video" size={12} /> Vídeo
        </button>
        <button
          onClick={() => setMode('enquete')}
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
            mode === 'enquete' ? 'bg-navy text-white' : 'bg-bg text-ink-soft'
          }`}
        >
          <Icon name="target" size={12} /> Enquete
        </button>
      </div>

      {(mode === 'post' || mode === 'video') && (
        <textarea
          className="w-full resize-none rounded-xl border border-navy-light px-3 py-2.5 text-sm outline-none focus:border-navy"
          rows={3}
          placeholder={mode === 'video' ? 'Conte um pouco sobre o vídeo (opcional)' : 'O que está rolando no seu curso?'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      )}

      {mode === 'post' && previews.length > 0 && (
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

      {mode === 'video' && (
        <div className="mt-2">
          {videoPreview ? (
            <div className="relative overflow-hidden rounded-xl border border-navy-light">
              <video src={videoPreview} className="max-h-64 w-full" controls />
              {!posting && (
                <button
                  onClick={() => setVideo(null)}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-light py-6 text-sm font-semibold text-navy hover:border-navy">
              <Icon name="video" size={16} />
              Escolher vídeo (máx. {Math.round(MAX_VIDEO_DURATION_SECONDS / 60)} min)
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleVideoSelect(e.target.files?.[0])}
              />
            </label>
          )}
          {uploadPct != null && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-light">
                <div className="h-full bg-brand-red transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-soft">Enviando vídeo para o Vimeo… {uploadPct}%</p>
            </div>
          )}
        </div>
      )}

      {mode === 'enquete' && (
        <div className="space-y-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunta da enquete"
            className="w-full rounded-xl border border-navy-light px-3 py-2.5 text-sm outline-none focus:border-navy"
          />
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                placeholder={`Opção ${i + 1}`}
                className="flex-1 rounded-xl border border-navy-light px-3 py-2 text-sm outline-none focus:border-navy"
              />
              {options.length > 2 && (
                <button
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-ink-faint hover:text-brand-red"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button
              onClick={() => setOptions((prev) => [...prev, ''])}
              className="text-xs font-semibold text-navy hover:underline"
            >
              + Adicionar opção
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {mode === 'post' && (
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
          )}

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
          disabled={posting || !canSubmit}
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
  const [poll, setPoll] = useState(post.poll)
  const [voting, setVoting] = useState(false)
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

  async function handleVote(optionId: string) {
    if (!poll || poll.myVoteOptionId || voting) return
    setVoting(true)
    setPoll({
      ...poll,
      totalVotes: poll.totalVotes + 1,
      myVoteOptionId: optionId,
      options: poll.options.map((o) => (o.id === optionId ? { ...o, voteCount: o.voteCount + 1 } : o)),
    })
    await voteInPoll(post.id, optionId, viewerId)
    setVoting(false)
  }

  async function handleClosePoll() {
    if (!confirm('Encerrar a votação desta enquete? Essa ação não pode ser desfeita.')) return
    await closePoll(post.id)
    onChanged()
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
        <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-navy-light bg-bg">
          <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      {post.media.length > 1 && (
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto rounded-xl">
          {post.media.map((m) => (
            <div key={m.id} className="h-64 w-64 shrink-0 snap-start overflow-hidden rounded-xl border border-navy-light bg-bg">
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {post.post_type === 'video' && post.vimeo_id && (
        <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-navy-light bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${post.vimeo_id}`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={post.body ?? 'Vídeo'}
          />
        </div>
      )}

      {poll && (
        <div className="mt-3 space-y-2">
          {poll.options.map((opt) => {
            const pct = poll.totalVotes ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0
            const voted = poll.myVoteOptionId != null
            const isMine = poll.myVoteOptionId === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => handleVote(opt.id)}
                disabled={voted || post.poll_closed || voting}
                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm ${
                  isMine ? 'border-navy' : 'border-navy-light'
                } ${voted || post.poll_closed ? 'cursor-default' : 'hover:border-navy'}`}
              >
                {(voted || post.poll_closed) && (
                  <span className="absolute inset-y-0 left-0 bg-navy-light" style={{ width: `${pct}%` }} />
                )}
                <span className="relative flex items-center justify-between font-semibold text-ink">
                  {opt.label}
                  {(voted || post.poll_closed) && <span>{pct}%</span>}
                </span>
              </button>
            )
          })}
          <p className="text-xs text-ink-faint">
            {poll.totalVotes} {poll.totalVotes === 1 ? 'voto' : 'votos'}
            {post.poll_closed && ' · votação encerrada'}
            {!post.poll_closed && post.author_id === viewerId && (
              <button onClick={handleClosePoll} className="ml-2 font-semibold text-navy hover:underline">
                Encerrar votação
              </button>
            )}
          </p>
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

// ---------------- Fase D: stories ----------------

function StoriesRow({
  userId,
  userName,
  myProgramId,
  accessToken,
  groups,
  onChanged,
}: {
  userId: string
  userName: string
  myProgramId: string | null
  accessToken: string
  groups: StoryGroup[]
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null)
  const myGroup = groups.find((g) => g.authorId === userId)
  const otherGroups = groups.filter((g) => g.authorId !== userId)

  return (
    <div className="mt-6 flex gap-3 overflow-x-auto pb-1">
      <button onClick={() => setCreating(true)} className="flex shrink-0 flex-col items-center gap-1.5">
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-navy-light text-navy">
          <Icon name="video" size={18} />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-white">
            <Icon name="x" size={10} className="rotate-45" />
          </span>
        </span>
        <span className="max-w-14 truncate text-[11px] font-medium text-ink-soft">Seu story</span>
      </button>

      {myGroup && (
        <button onClick={() => setViewingGroup(myGroup)} className="flex shrink-0 flex-col items-center gap-1.5">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full p-0.5"
            style={{ background: myGroup.allSeen ? '#d3ccbc' : 'linear-gradient(135deg,#ed1c24,#a8842a)' }}
          >
            <span
              className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: colorForName(myGroup.authorName) }}
            >
              {initials(myGroup.authorName)}
            </span>
          </span>
          <span className="max-w-14 truncate text-[11px] font-medium text-ink-soft">Você</span>
        </button>
      )}

      {otherGroups.map((g) => (
        <button key={g.authorId} onClick={() => setViewingGroup(g)} className="flex shrink-0 flex-col items-center gap-1.5">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full p-0.5"
            style={{ background: g.allSeen ? '#d3ccbc' : 'linear-gradient(135deg,#ed1c24,#a8842a)' }}
          >
            <span
              className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: colorForName(g.authorName) }}
            >
              {initials(g.authorName)}
            </span>
          </span>
          <span className="max-w-14 truncate text-[11px] font-medium text-ink-soft">{g.authorName.split(' ')[0]}</span>
        </button>
      ))}

      {creating && (
        <CreateStoryModal
          userId={userId}
          userName={userName}
          myProgramId={myProgramId}
          accessToken={accessToken}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            onChanged()
          }}
        />
      )}

      {viewingGroup && (
        <StoryViewerModal
          group={viewingGroup}
          viewerId={userId}
          viewerName={userName}
          onClose={() => setViewingGroup(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  )
}

function CreateStoryModal({
  userId,
  userName,
  myProgramId,
  accessToken,
  onClose,
  onCreated,
}: {
  userId: string
  userName: string
  myProgramId: string | null
  accessToken: string
  onClose: () => void
  onCreated: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function handleSelect(f: File | undefined) {
    if (!f) return
    setError('')
    const video = f.type.startsWith('video/')
    if (video) {
      try {
        const duration = await readVideoDuration(f)
        if (duration > MAX_STORY_VIDEO_SECONDS) {
          setError(`Vídeo muito longo — máximo de ${MAX_STORY_VIDEO_SECONDS} segundos.`)
          return
        }
      } catch {
        setError('Não foi possível ler esse vídeo.')
        return
      }
    }
    setIsVideo(video)
    setFile(f)
  }

  async function submit() {
    if (!file) return
    setSaving(true)
    setError('')
    try {
      if (isVideo) {
        setUploadPct(0)
        const { vimeoId } = await uploadVideoToVimeo(file, accessToken, setUploadPct)
        await createVideoStory({ authorId: userId, authorName: userName, authorProgramId: myProgramId, vimeoId })
      } else {
        await createImageStory({ authorId: userId, authorName: userName, authorProgramId: myProgramId, image: file })
      }
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar o story.')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-lg font-bold text-ink">Novo story</h3>
        <p className="mt-1 text-xs text-ink-soft">Foto ou vídeo de até {MAX_STORY_VIDEO_SECONDS}s — some em 24h.</p>

        {preview ? (
          <div className="relative mt-3 aspect-[9/16] max-h-80 overflow-hidden rounded-xl border border-navy-light bg-black">
            {isVideo ? (
              <video src={preview} className="h-full w-full object-cover" controls />
            ) : (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            )}
            {!saving && (
              <button
                onClick={() => setFile(null)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
        ) : (
          <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-light py-10 text-sm font-semibold text-navy hover:border-navy">
            <Icon name="image" size={18} />
            Escolher foto ou vídeo
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleSelect(e.target.files?.[0])}
            />
          </label>
        )}

        {uploadPct != null && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-light">
              <div className="h-full bg-brand-red transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-soft">Enviando vídeo para o Vimeo… {uploadPct}%</p>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-brand-red">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-navy-light py-2.5 font-semibold text-ink-soft">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!file || saving}
            className="flex-1 rounded-xl bg-brand-red py-2.5 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STORY_DURATION_MS = 6000

function StoryViewerModal({
  group,
  viewerId,
  viewerName,
  onClose,
  onChanged,
}: {
  group: StoryGroup
  viewerId: string
  viewerName: string
  onClose: () => void
  onChanged: () => void
}) {
  const [index, setIndex] = useState(0)
  const [viewers, setViewers] = useState<SocialStoryView[] | null>(null)
  const story = group.stories[index]
  const isMine = group.authorId === viewerId

  useEffect(() => {
    if (!story) return
    recordStoryView(story.id, viewerId, viewerName)
  }, [story, viewerId, viewerName])

  useEffect(() => {
    setViewers(null)
    if (!story) return
    const timer = setTimeout(() => {
      if (index < group.stories.length - 1) setIndex((i) => i + 1)
      else onClose()
    }, STORY_DURATION_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story])

  if (!story) return null

  async function handleDelete() {
    if (!confirm('Excluir este story?')) return
    await deleteStory(story.id)
    onChanged()
    onClose()
  }

  async function loadViewers() {
    setViewers(await getStoryViewers(story.id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="relative flex h-full max-h-[720px] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-black">
        <div className="absolute inset-x-2 top-2 z-10 flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              {i <= index && <div className="h-full w-full bg-white" />}
            </div>
          ))}
        </div>

        <div className="absolute inset-x-3 top-6 z-10 flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: colorForName(group.authorName) }}
          >
            {initials(group.authorName)}
          </span>
          <span className="text-sm font-semibold text-white drop-shadow">{group.authorName}</span>
          <button onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="relative flex-1">
          {story.media_type === 'video' && story.vimeo_id ? (
            <iframe
              key={story.id}
              src={`https://player.vimeo.com/video/${story.vimeo_id}?autoplay=1&background=0`}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              title="Story"
            />
          ) : (
            <img src={story.image_url ?? ''} alt="" className="h-full w-full object-cover" />
          )}

          <button
            onClick={() => (index > 0 ? setIndex(index - 1) : onClose())}
            className="absolute inset-y-0 left-0 w-1/3"
            aria-label="Anterior"
          />
          <button
            onClick={() => (index < group.stories.length - 1 ? setIndex(index + 1) : onClose())}
            className="absolute inset-y-0 right-0 w-1/3"
            aria-label="Próximo"
          />
        </div>

        {isMine && (
          <div className="z-10 flex items-center justify-between bg-black/70 px-3 py-2">
            {viewers == null ? (
              <button onClick={loadViewers} className="text-xs font-semibold text-white/90 hover:underline">
                👁 Ver quem assistiu
              </button>
            ) : (
              <p className="max-h-16 overflow-y-auto text-xs text-white/90">
                {viewers.length === 0
                  ? 'Ninguém viu ainda.'
                  : viewers.map((v) => v.viewer_name).join(', ')}
              </p>
            )}
            <button onClick={handleDelete} className="ml-3 shrink-0 text-xs font-semibold text-brand-red hover:underline">
              Excluir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
