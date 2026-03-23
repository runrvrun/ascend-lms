"use client"

import { Download, ArrowLeft } from "lucide-react"
import Image from "next/image"

function AscendSeal() {
  return (
    <svg viewBox="0 0 200 200" className="h-36 w-36">
      {/* Outer ring */}
      <circle cx="100" cy="100" r="96" fill="none" stroke="#64748b" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="4 3" />

      {/* Curved text path */}
      <defs>
        <path id="topArc" d="M 20,100 A 80,80 0 0,1 180,100" />
        <path id="bottomArc" d="M 30,110 A 78,78 0 0,0 170,110" />
      </defs>

      {/* Top curved text */}
      <text fontSize="13" fontWeight="700" fill="#334155" letterSpacing="3" fontFamily="sans-serif">
        <textPath href="#topArc" startOffset="50%" textAnchor="middle">
          ASCEND LMS
        </textPath>
      </text>

      {/* Bottom curved text */}
      <text fontSize="10" fontWeight="500" fill="#64748b" letterSpacing="2" fontFamily="sans-serif">
        <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
          YCP
        </textPath>
      </text>

      {/* Center decoration */}
      <circle cx="100" cy="100" r="32" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      {/* A stylised star / badge center */}
      <text x="100" y="107" textAnchor="middle" fontSize="28" fontWeight="800" fill="#1e293b" fontFamily="sans-serif">A</text>
    </svg>
  )
}

export function CertificateView({
  userName,
  pathwayName,
  completedAt,
  pathwayId,
}: {
  userName: string
  pathwayName: string
  completedAt: Date
  pathwayId: string
}) {
  const dateStr = new Date(completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Toolbar – hidden when printing */}
      <div className="flex items-center justify-between px-6 py-3 print:hidden">
        <a
          href={`/pathways/${pathwayId}`}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={15} />
          Back to Pathway
        </a>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Download size={15} />
          Download Certificate
        </button>
      </div>

      {/* Certificate */}
      <div className="flex items-center justify-center p-4 print:p-0 print:block">
        <div
          id="certificate"
          className="relative flex w-full max-w-[900px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl print:max-w-none print:rounded-none print:shadow-none"
          style={{ aspectRatio: "1.414 / 1" }}
        >
          {/* Left panel */}
          <div className="flex flex-[60] flex-col border-r border-slate-200 px-10 py-10 print:px-12 print:py-12">
            {/* Logo */}
            <div className="mb-6">
              <Image
                src="/logo-ycp-navy.svg"
                alt="YCP"
                width={140}
                height={50}
                className="h-12 w-auto object-contain"
              />
            </div>

            {/* Divider */}
            <div className="mb-6 h-px w-full bg-slate-200" />

            {/* Date */}
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">{dateStr}</p>

            {/* Recipient */}
            <h1
              className="mt-3 leading-tight text-slate-900"
              style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1.6rem, 4vw, 2.8rem)", fontStyle: "italic", fontWeight: 700 }}
            >
              {userName}
            </h1>

            <p className="mt-4 text-sm text-slate-500">has successfully completed</p>

            <h2 className="mt-2 font-bold text-slate-900" style={{ fontSize: "clamp(1rem, 2.5vw, 1.4rem)" }}>
              {pathwayName}
            </h2>

            <p className="mt-2 text-xs text-slate-400">Learning Pathway · Ascend LMS by YCP</p>

            {/* Signature */}
            <div className="mt-auto pt-6">
              <div className="mb-2 h-px w-44 bg-slate-400" />
              <p className="text-sm font-semibold text-slate-800">Hiroko Imaeda</p>
              <p className="text-xs text-slate-500">Group CHRO, YCP</p>
            </div>
          </div>

          {/* Right panel */}
          <div className="relative flex flex-[40] flex-col items-center justify-center bg-slate-50 px-6 py-10">
            {/* Diagonal ribbon */}
            <div
              className="absolute right-0 top-0 flex h-28 w-28 items-start justify-end overflow-hidden"
            >
              <div
                className="absolute right-[-36px] top-[22px] w-40 rotate-45 bg-slate-700 py-1.5 text-center"
                style={{ fontSize: "0.5rem", letterSpacing: "0.15em" }}
              >
                <span className="font-bold uppercase tracking-widest text-white">Verified</span>
              </div>
            </div>

            {/* Verified certificate title */}
            <div className="mb-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Verified</p>
              <p className="text-lg font-bold uppercase tracking-[0.15em] text-slate-700">Certificate</p>
            </div>

            {/* Seal */}
            <AscendSeal />

            {/* Verification note */}
            <p className="mt-6 max-w-[160px] text-center text-[0.6rem] leading-relaxed text-slate-400">
              Ascend LMS has confirmed the identity of this individual and their participation in the pathway.
            </p>
          </div>

          {/* Outer border frame */}
          <div className="pointer-events-none absolute inset-2 rounded-xl border border-slate-100" />
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body > * { display: none !important; }
          body > div { display: block !important; }
          .print\\:hidden { display: none !important; }
          #certificate {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            aspect-ratio: unset !important;
          }
        }
      `}</style>
    </div>
  )
}
