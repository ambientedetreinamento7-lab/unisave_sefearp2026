import { supabase } from './supabase'
import type { SocialComment, SocialLike, SocialPost, SocialPostMedia, SocialPostType, SocialReport, SocialScope } from '../types/database'

export interface FeedPost extends SocialPost {
  media: SocialPostMedia[]
  likeCount: number
  commentCount: number
  likedByMe: boolean
}

function groupByPostId<T extends { post_id: string }>(rows: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  for (const row of rows) {
    ;(map[row.post_id] ??= []).push(row)
  }
  return map
}

async function enrichPosts(posts: SocialPost[], viewerId: string): Promise<FeedPost[]> {
  if (posts.length === 0) return []
  const ids = posts.map((p) => p.id)

  const [{ data: media }, { data: likes }, { data: comments }] = await Promise.all([
    supabase.from('social_post_media').select('*').in('post_id', ids).order('order_index'),
    supabase.from('social_likes').select('*').in('post_id', ids),
    supabase.from('social_comments').select('id, post_id').in('post_id', ids),
  ])

  const mediaByPost = groupByPostId((media as SocialPostMedia[]) ?? [])
  const likesByPost = groupByPostId((likes as SocialLike[]) ?? [])
  const commentsByPost = groupByPostId((comments as { post_id: string }[]) ?? [])

  return posts.map((p) => ({
    ...p,
    media: mediaByPost[p.id] ?? [],
    likeCount: (likesByPost[p.id] ?? []).length,
    likedByMe: (likesByPost[p.id] ?? []).some((l) => l.user_id === viewerId),
    commentCount: (commentsByPost[p.id] ?? []).length,
  }))
}

export async function getFeed({
  scope,
  programId,
  viewerId,
}: {
  scope: SocialScope
  programId: string | null
  viewerId: string
}): Promise<FeedPost[]> {
  let query = supabase.from('social_posts').select('*').eq('scope', scope).order('created_at', { ascending: false })
  if (scope === 'curso') query = query.eq('program_id', programId)
  const { data } = await query
  return enrichPosts((data as SocialPost[]) ?? [], viewerId)
}

export async function createPost(input: {
  authorId: string
  authorName: string
  authorProgramId: string | null
  scope: SocialScope
  programId: string | null
  body: string
  images: File[]
}): Promise<void> {
  const postType: SocialPostType = input.images.length > 1 ? 'carrossel' : input.images.length === 1 ? 'imagem' : 'texto'

  const { data: post, error } = await supabase
    .from('social_posts')
    .insert({
      author_id: input.authorId,
      author_name: input.authorName,
      author_program_id: input.authorProgramId,
      scope: input.scope,
      program_id: input.scope === 'curso' ? input.programId : null,
      post_type: postType,
      body: input.body || null,
    })
    .select('*')
    .single()
  if (error) throw error

  if (input.images.length) {
    const media = await Promise.all(
      input.images.map(async (file, idx) => {
        const path = `${input.authorId}/${post.id}-${idx}-${crypto.randomUUID()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('social')
          .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
        if (uploadError) throw uploadError
        const url = supabase.storage.from('social').getPublicUrl(path).data.publicUrl
        return { post_id: post.id, url, order_index: idx }
      }),
    )
    const { error: mediaError } = await supabase.from('social_post_media').insert(media)
    if (mediaError) throw mediaError
  }
}

export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', userId)
  } else {
    await supabase.from('social_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' })
  }
}

export async function getComments(postId: string): Promise<SocialComment[]> {
  const { data } = await supabase.from('social_comments').select('*').eq('post_id', postId).order('created_at')
  return (data as SocialComment[]) ?? []
}

export async function addComment(postId: string, authorId: string, authorName: string, body: string) {
  await supabase.from('social_comments').insert({ post_id: postId, author_id: authorId, author_name: authorName, body })
}

export async function deleteComment(commentId: string) {
  await supabase.from('social_comments').delete().eq('id', commentId)
}

export async function reportPost(postId: string, reporterId: string, reason: string) {
  await supabase.from('social_reports').insert({ post_id: postId, reporter_id: reporterId, reason })
}

export async function deletePost(postId: string) {
  await supabase.from('social_posts').delete().eq('id', postId)
}

export async function setPostPublished(postId: string, published: boolean) {
  await supabase.from('social_posts').update({ published }).eq('id', postId)
}

// ---- Admin moderation ----

export async function getModerationFeed(viewerId: string): Promise<FeedPost[]> {
  const { data } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(200)
  return enrichPosts((data as SocialPost[]) ?? [], viewerId)
}

export interface ReportWithPost extends SocialReport {
  post: SocialPost | null
}

export async function getReports(): Promise<ReportWithPost[]> {
  const { data: reports } = await supabase.from('social_reports').select('*').order('created_at', { ascending: false })
  const reportRows = (reports as SocialReport[]) ?? []
  if (reportRows.length === 0) return []
  const postIds = [...new Set(reportRows.map((r) => r.post_id))]
  const { data: posts } = await supabase.from('social_posts').select('*').in('id', postIds)
  const postMap = new Map(((posts as SocialPost[]) ?? []).map((p) => [p.id, p]))
  return reportRows.map((r) => ({ ...r, post: postMap.get(r.post_id) ?? null }))
}
