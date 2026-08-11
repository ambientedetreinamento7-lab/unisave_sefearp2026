import { notifyReaction } from './notifications'
import { supabase } from './supabase'
import type {
  SocialComment,
  SocialLike,
  SocialPollOption,
  SocialPollVote,
  SocialPost,
  SocialPostMedia,
  SocialPostType,
  SocialReport,
  SocialScope,
  SocialStory,
  SocialStoryReaction,
  SocialStoryView,
} from '../types/database'

export interface PollOptionResult extends SocialPollOption {
  voteCount: number
}

export interface PollResult {
  options: PollOptionResult[]
  totalVotes: number
  myVoteOptionId: string | null
}

export interface FeedPost extends SocialPost {
  media: SocialPostMedia[]
  likeCount: number
  commentCount: number
  likedByMe: boolean
  poll: PollResult | null
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
  const pollIds = posts.filter((p) => p.post_type === 'enquete').map((p) => p.id)

  const [{ data: media }, { data: likes }, { data: comments }, pollOptionsRes, pollVotesRes] = await Promise.all([
    supabase.from('social_post_media').select('*').in('post_id', ids).order('order_index'),
    supabase.from('social_likes').select('*').in('post_id', ids),
    supabase.from('social_comments').select('id, post_id').in('post_id', ids),
    pollIds.length
      ? supabase.from('social_poll_options').select('*').in('post_id', pollIds).order('order_index')
      : Promise.resolve({ data: [] as SocialPollOption[] }),
    pollIds.length
      ? supabase.from('social_poll_votes').select('*').in('post_id', pollIds)
      : Promise.resolve({ data: [] as SocialPollVote[] }),
  ])

  const mediaByPost = groupByPostId((media as SocialPostMedia[]) ?? [])
  const likesByPost = groupByPostId((likes as SocialLike[]) ?? [])
  const commentsByPost = groupByPostId((comments as { post_id: string }[]) ?? [])
  const optionsByPost = groupByPostId((pollOptionsRes.data as SocialPollOption[]) ?? [])
  const votesByPost = groupByPostId((pollVotesRes.data as SocialPollVote[]) ?? [])

  return posts.map((p) => {
    const votes = votesByPost[p.id] ?? []
    const poll: PollResult | null =
      p.post_type === 'enquete'
        ? {
            options: (optionsByPost[p.id] ?? []).map((opt) => ({
              ...opt,
              voteCount: votes.filter((v) => v.option_id === opt.id).length,
            })),
            totalVotes: votes.length,
            myVoteOptionId: votes.find((v) => v.user_id === viewerId)?.option_id ?? null,
          }
        : null

    return {
      ...p,
      media: mediaByPost[p.id] ?? [],
      likeCount: (likesByPost[p.id] ?? []).length,
      likedByMe: (likesByPost[p.id] ?? []).some((l) => l.user_id === viewerId),
      commentCount: (commentsByPost[p.id] ?? []).length,
      poll,
    }
  })
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

export async function createVideoPost(input: {
  authorId: string
  authorName: string
  authorProgramId: string | null
  scope: SocialScope
  programId: string | null
  body: string
  vimeoId: string
}): Promise<void> {
  const { error } = await supabase.from('social_posts').insert({
    author_id: input.authorId,
    author_name: input.authorName,
    author_program_id: input.authorProgramId,
    scope: input.scope,
    program_id: input.scope === 'curso' ? input.programId : null,
    post_type: 'video' as SocialPostType,
    body: input.body || null,
    vimeo_id: input.vimeoId,
  })
  if (error) throw error
}

export async function createPollPost(input: {
  authorId: string
  authorName: string
  authorProgramId: string | null
  scope: SocialScope
  programId: string | null
  question: string
  options: string[]
}): Promise<void> {
  const { data: post, error } = await supabase
    .from('social_posts')
    .insert({
      author_id: input.authorId,
      author_name: input.authorName,
      author_program_id: input.authorProgramId,
      scope: input.scope,
      program_id: input.scope === 'curso' ? input.programId : null,
      post_type: 'enquete' as SocialPostType,
      body: input.question,
    })
    .select('*')
    .single()
  if (error) throw error

  const options = input.options.map((label, idx) => ({ post_id: post.id, label, order_index: idx }))
  const { error: optionsError } = await supabase.from('social_poll_options').insert(options)
  if (optionsError) throw optionsError
}

export async function voteInPoll(postId: string, optionId: string, userId: string) {
  await supabase.from('social_poll_votes').insert({ post_id: postId, option_id: optionId, user_id: userId })
}

export async function closePoll(postId: string) {
  await supabase.rpc('close_poll', { p_post_id: postId })
}

export async function toggleLike(
  postId: string,
  userId: string,
  userName: string,
  currentlyLiked: boolean,
  authorId: string,
) {
  if (currentlyLiked) {
    await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', userId)
  } else {
    await supabase
      .from('social_likes')
      .upsert({ post_id: postId, user_id: userId, user_name: userName }, { onConflict: 'post_id,user_id' })
    if (authorId !== userId) await notifyReaction(authorId, userName, 'post')
  }
}

export async function getPostLikers(postId: string): Promise<SocialLike[]> {
  const { data } = await supabase.from('social_likes').select('*').eq('post_id', postId).order('created_at')
  return (data as SocialLike[]) ?? []
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

// ---- Fase D: stories (foto/vídeo, expiram em 24h) ----

export interface StoryWithReactions extends SocialStory {
  reactionCount: number
  reactedByMe: boolean
}

export interface StoryGroup {
  authorId: string
  authorName: string
  authorProgramId: string | null
  stories: StoryWithReactions[]
  allSeen: boolean
}

export async function getActiveStoryGroups(viewerId: string): Promise<StoryGroup[]> {
  const { data: stories } = await supabase
    .from('social_stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true })
  const storyRows = (stories as SocialStory[]) ?? []
  if (storyRows.length === 0) return []

  const storyIds = storyRows.map((s) => s.id)
  const [{ data: views }, { data: reactions }] = await Promise.all([
    supabase.from('social_story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', storyIds),
    supabase.from('social_story_reactions').select('*').in('story_id', storyIds),
  ])
  const seenIds = new Set(((views as { story_id: string }[]) ?? []).map((v) => v.story_id))
  const reactionRows = (reactions as SocialStoryReaction[]) ?? []

  const groups = new Map<string, StoryGroup>()
  for (const s of storyRows) {
    if (!groups.has(s.author_id)) {
      groups.set(s.author_id, {
        authorId: s.author_id,
        authorName: s.author_name,
        authorProgramId: s.author_program_id,
        stories: [],
        allSeen: true,
      })
    }
    const group = groups.get(s.author_id)!
    const storyReactions = reactionRows.filter((r) => r.story_id === s.id)
    group.stories.push({
      ...s,
      reactionCount: storyReactions.length,
      reactedByMe: storyReactions.some((r) => r.user_id === viewerId),
    })
    if (!seenIds.has(s.id)) group.allSeen = false
  }
  return Array.from(groups.values())
}

export async function toggleStoryReaction(
  storyId: string,
  userId: string,
  userName: string,
  currentlyReacted: boolean,
  authorId: string,
) {
  if (currentlyReacted) {
    await supabase.from('social_story_reactions').delete().eq('story_id', storyId).eq('user_id', userId)
  } else {
    await supabase
      .from('social_story_reactions')
      .upsert({ story_id: storyId, user_id: userId, user_name: userName }, { onConflict: 'story_id,user_id' })
    if (authorId !== userId) await notifyReaction(authorId, userName, 'story')
  }
}

export async function getStoryReactors(storyId: string): Promise<SocialStoryReaction[]> {
  const { data } = await supabase.from('social_story_reactions').select('*').eq('story_id', storyId).order('created_at')
  return (data as SocialStoryReaction[]) ?? []
}

export async function createImageStory(input: {
  authorId: string
  authorName: string
  authorProgramId: string | null
  image: File
}): Promise<void> {
  const path = `${input.authorId}/story-${Date.now()}-${crypto.randomUUID()}-${input.image.name}`
  const { error: uploadError } = await supabase.storage
    .from('social')
    .upload(path, input.image, { upsert: true, contentType: input.image.type || 'image/jpeg' })
  if (uploadError) throw uploadError
  const url = supabase.storage.from('social').getPublicUrl(path).data.publicUrl

  const { error } = await supabase.from('social_stories').insert({
    author_id: input.authorId,
    author_name: input.authorName,
    author_program_id: input.authorProgramId,
    media_type: 'imagem',
    image_url: url,
  })
  if (error) throw error
}

export async function createVideoStory(input: {
  authorId: string
  authorName: string
  authorProgramId: string | null
  vimeoId: string
}): Promise<void> {
  const { error } = await supabase.from('social_stories').insert({
    author_id: input.authorId,
    author_name: input.authorName,
    author_program_id: input.authorProgramId,
    media_type: 'video',
    vimeo_id: input.vimeoId,
  })
  if (error) throw error
}

export async function recordStoryView(storyId: string, viewerId: string, viewerName: string) {
  await supabase
    .from('social_story_views')
    .upsert({ story_id: storyId, viewer_id: viewerId, viewer_name: viewerName }, { onConflict: 'story_id,viewer_id' })
}

export async function getStoryViewers(storyId: string): Promise<SocialStoryView[]> {
  const { data } = await supabase.from('social_story_views').select('*').eq('story_id', storyId).order('viewed_at')
  return (data as SocialStoryView[]) ?? []
}

export async function deleteStory(storyId: string) {
  await supabase.from('social_stories').delete().eq('id', storyId)
}
