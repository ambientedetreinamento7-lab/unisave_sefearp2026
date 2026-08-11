import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { useConfirm } from '../../components/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { deletePost, getModerationFeed, getReports, setPostPublished, type FeedPost, type ReportWithPost } from '../../lib/social'

type Tab = 'posts' | 'denuncias'

export function AdminComunidade() {
  const confirm = useConfirm()
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('posts')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [reports, setReports] = useState<ReportWithPost[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!profile) return
    setLoading(true)
    const [p, r] = await Promise.all([getModerationFeed(profile.id), getReports()])
    setPosts(p)
    setReports(r)
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function togglePublished(post: FeedPost) {
    await setPostPublished(post.id, !post.published)
    reload()
  }

  async function remove(postId: string) {
    if (!(await confirm('Excluir este post em definitivo?', { danger: true, confirmLabel: 'Excluir' }))) return
    await deletePost(postId)
    reload()
  }

  if (loading) return <AdminLayout><p className="text-ink-soft">Carregando…</p></AdminLayout>

  return (
    <AdminLayout>
      <div className="mb-4 flex gap-2 rounded-full bg-surface p-1 shadow-sm max-w-sm">
        <button
          onClick={() => setTab('posts')}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${tab === 'posts' ? 'bg-navy text-white' : 'text-ink-soft'}`}
        >
          Posts
        </button>
        <button
          onClick={() => setTab('denuncias')}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${tab === 'denuncias' ? 'bg-navy text-white' : 'text-ink-soft'}`}
        >
          Denúncias {reports.length > 0 && `(${reports.length})`}
        </button>
      </div>

      {tab === 'posts' && (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-ink">
                    {post.author_name}{' '}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        post.published ? 'bg-green-50 text-success' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {post.published ? 'Publicado' : 'Despublicado'}
                    </span>
                  </p>
                  <p className="text-xs text-ink-faint">
                    {new Date(post.created_at).toLocaleString('pt-BR')} · {post.scope === 'global' ? 'Global' : 'Meu curso'} ·{' '}
                    {post.post_type}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => togglePublished(post)}
                    className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                  >
                    {post.published ? 'Despublicar' : 'Publicar'}
                  </button>
                  <button
                    onClick={() => remove(post.id)}
                    className="rounded-lg border border-brand-red/30 px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              {post.body && <p className="mt-2 text-sm text-ink-soft">{post.body}</p>}
              {post.media.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {post.media.map((m) => (
                    <img key={m.id} src={m.url} alt="" className="h-20 w-20 shrink-0 rounded-lg border border-navy-light object-cover" />
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-ink-faint">♡ {post.likeCount} · 💬 {post.commentCount}</p>
            </div>
          ))}
          {posts.length === 0 && <p className="text-ink-soft">Nenhum post ainda.</p>}
        </div>
      )}

      {tab === 'denuncias' && (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="text-xs text-ink-faint">{new Date(r.created_at).toLocaleString('pt-BR')}</p>
              <p className="mt-1 text-sm font-semibold text-ink">Motivo: {r.reason}</p>
              {r.post ? (
                <div className="mt-2 rounded-lg bg-bg p-3">
                  <p className="text-xs font-semibold text-ink-soft">
                    Post de {r.post.author_name} · {r.post.published ? 'publicado' : 'despublicado'}
                  </p>
                  {r.post.body && <p className="mt-1 text-sm text-ink">{r.post.body}</p>}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setPostPublished(r.post!.id, false).then(reload)}
                      className="rounded-lg border border-navy-light px-3 py-1.5 text-xs font-semibold text-navy hover:border-navy"
                    >
                      Despublicar post
                    </button>
                    <button
                      onClick={() => remove(r.post!.id)}
                      className="rounded-lg border border-brand-red/30 px-3 py-1.5 text-xs font-semibold text-brand-red hover:border-brand-red"
                    >
                      Excluir post
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-ink-faint">Post já foi removido.</p>
              )}
            </div>
          ))}
          {reports.length === 0 && <p className="text-ink-soft">Nenhuma denúncia pendente.</p>}
        </div>
      )}
    </AdminLayout>
  )
}
