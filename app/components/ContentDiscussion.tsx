"use client"

import { useEffect, useState, useTransition, useRef } from "react"
import { MessageCircle, Send, CornerDownRight, X } from "lucide-react"
import { getComments, postComment } from "../discussions/actions"

type CommentUser = { id: string; name: string | null; image: string | null }
type ReplyUser = { id: string; name: string | null }

type Reply = {
  id: string
  body: string
  userId: string
  parentId: string
  replyToUserId: string | null
  createdAt: Date | string
  user: CommentUser
  replyToUser: ReplyUser | null
}

type TopComment = {
  id: string
  body: string
  userId: string
  parentId: string | null
  createdAt: Date | string
  user: CommentUser
  replies: Reply[]
}

function timeAgo(date: Date | string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function Avatar({ name, image, size = 8 }: { name: string | null; image: string | null; size?: number }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")

  const cls = `h-${size} w-${size} shrink-0 rounded-full object-cover ring-1 ring-slate-200`

  if (image) return <img src={image} alt={name ?? ""} className={cls} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }} />
  return (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600`}>
      {initials}
    </div>
  )
}

function CommentInput({
  placeholder,
  onSubmit,
  autoFocus = false,
  onCancel,
}: {
  placeholder: string
  onSubmit: (body: string) => Promise<void>
  autoFocus?: boolean
  onCancel?: () => void
}) {
  const [value, setValue] = useState("")
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed || pending) return
    startTransition(async () => {
      await onSubmit(trimmed)
      setValue("")
    })
  }

  return (
    <div className="flex gap-2">
      <div className="flex flex-1 flex-col gap-1.5">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">⌘ + Enter to post</span>
          <div className="flex gap-2">
            {onCancel && (
              <button onClick={onCancel} className="rounded-lg px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || pending}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              <Send size={11} />
              {pending ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReplyItem({
  reply,
  currentUserId,
  onReply,
}: {
  reply: Reply
  currentUserId: string
  onReply: (replyToUserId: string, replyToName: string) => void
}) {
  return (
    <div className="flex gap-2 pl-8 pt-2">
      <CornerDownRight size={13} className="mt-1 shrink-0 text-slate-300" />
      <Avatar name={reply.user.name} image={reply.user.image} size={7} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-xs font-semibold text-slate-800">{reply.user.name ?? "User"}</span>
          {reply.replyToUser && reply.replyToUser.id !== reply.userId && (
            <span className="text-xs text-blue-500">@{reply.replyToUser.name ?? "User"}</span>
          )}
          <span className="text-xs text-slate-400">{timeAgo(reply.createdAt)}</span>
        </div>
        <p className="mt-0.5 text-sm text-slate-700">{reply.body}</p>
        <button
          onClick={() => onReply(reply.userId, reply.user.name ?? "User")}
          className="mt-1 text-xs font-medium text-slate-400 hover:text-blue-500"
        >
          Reply
        </button>
      </div>
    </div>
  )
}

function CommentThread({
  comment,
  currentUserId,
  onPost,
}: {
  comment: TopComment
  currentUserId: string
  onPost: (parentId: string, body: string, replyToUserId: string | null) => Promise<void>
}) {
  const [replyingTo, setReplyingTo] = useState<{ userId: string; name: string } | null>(null)

  function startReply(userId: string, name: string) {
    setReplyingTo({ userId, name })
  }

  async function submitReply(body: string) {
    await onPost(comment.id, body, replyingTo?.userId ?? comment.userId)
    setReplyingTo(null)
  }

  return (
    <div className="border-b border-slate-100 px-5 py-4 last:border-0">
      {/* Top-level comment */}
      <div className="flex gap-2.5">
        <Avatar name={comment.user.name} image={comment.user.image} size={8} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="text-sm font-semibold text-slate-800">{comment.user.name ?? "User"}</span>
            <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-700">{comment.body}</p>
          <button
            onClick={() => startReply(comment.userId, comment.user.name ?? "User")}
            className="mt-1 text-xs font-medium text-slate-400 hover:text-blue-500"
          >
            Reply
          </button>
        </div>
      </div>

      {/* Replies */}
      {comment.replies.map((r) => (
        <ReplyItem
          key={r.id}
          reply={r}
          currentUserId={currentUserId}
          onReply={startReply}
        />
      ))}

      {/* Inline reply box */}
      {replyingTo && (
        <div className="mt-3 pl-8">
          <div className="mb-1.5 flex items-center gap-1 text-xs text-blue-500">
            <CornerDownRight size={11} />
            Replying to <span className="font-semibold">@{replyingTo.name}</span>
            <button onClick={() => setReplyingTo(null)} className="ml-1 rounded p-0.5 hover:bg-slate-100">
              <X size={11} />
            </button>
          </div>
          <CommentInput
            placeholder={`Reply to @${replyingTo.name}…`}
            onSubmit={submitReply}
            onCancel={() => setReplyingTo(null)}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}

export function ContentDiscussion({
  contentId,
  pathwayId,
  currentUserId,
}: {
  contentId: string
  pathwayId: string
  currentUserId: string
}) {
  const [comments, setComments] = useState<TopComment[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const data = await getComments(contentId, pathwayId)
    setComments(data as TopComment[])
    setLoading(false)
  }

  useEffect(() => { load() }, [contentId, pathwayId])

  async function handlePost(parentId: string | null, body: string, replyToUserId: string | null) {
    await postComment(contentId, pathwayId, body, parentId, replyToUserId)
    await load()
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-6">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle size={16} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">
          Discussion
          {comments.length > 0 && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {comments.length + comments.reduce((s, c) => s + c.replies.length, 0)}
            </span>
          )}
        </h3>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* New comment input */}
        <div className="border-b border-slate-100 px-5 py-4">
          <CommentInput
            placeholder="Add a comment… (⌘+Enter to post)"
            onSubmit={(body) => handlePost(null, body, null)}
          />
        </div>

        {/* Comment list */}
        {loading ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            No comments yet. Be the first to start the discussion!
          </div>
        ) : (
          <div>
            {comments.map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                currentUserId={currentUserId}
                onPost={handlePost}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
