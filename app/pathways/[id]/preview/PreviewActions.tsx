"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Clock, Share2 } from "lucide-react"
import { EnrollmentStatus, PathwayVisibility } from "@prisma/client"
import { enrollPathway } from "../../actions"
import { RequestModal } from "../../PathwayList"
import { SharePathwayModal } from "../../SharePathwayModal"

export function PreviewActions({
  pathway,
  enrollmentStatus,
}: {
  pathway: { id: string; name: string; visibility: PathwayVisibility }
  enrollmentStatus: EnrollmentStatus | null
}) {
  const router = useRouter()
  const [requesting, setRequesting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleEnroll() {
    startTransition(async () => {
      await enrollPathway(pathway.id)
      router.push(`/pathways/${pathway.id}`)
    })
  }

  let primary: React.ReactNode = null
  if (enrollmentStatus === "APPROVED") {
    primary = (
      <a
        href={`/pathways/${pathway.id}`}
        className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
      >
        Go to Pathway
        <ArrowRight size={14} />
      </a>
    )
  } else if (enrollmentStatus === "PENDING") {
    primary = (
      <button disabled className="flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400">
        <Clock size={14} />
        Awaiting Approval
      </button>
    )
  } else if (pathway.visibility === "PUBLIC_APPROVAL") {
    primary = (
      <button
        onClick={() => setRequesting(true)}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Request Enrollment
      </button>
    )
  } else if (pathway.visibility === "PUBLIC_FREE") {
    primary = (
      <button
        onClick={handleEnroll}
        disabled={pending}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Enrolling…" : "Enroll"}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary}
      {pathway.visibility !== "HIDDEN" && (
        <button
          onClick={() => setSharing(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Share2 size={14} />
          Share
        </button>
      )}

      {requesting && (
        <RequestModal
          pathway={pathway}
          onClose={() => { setRequesting(false); router.refresh() }}
        />
      )}
      {sharing && <SharePathwayModal pathway={pathway} onClose={() => setSharing(false)} />}
    </div>
  )
}
