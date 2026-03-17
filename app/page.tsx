"use client"

import { signIn, signOut, useSession } from "next-auth/react"

export default function Home() {
  const { data: session } = useSession()

  if (!session) {
    return (
      <button onClick={() => signIn("azure-ad")}>
        Sign in with Microsoft
      </button>
    )
  }

  return (
    <>
      <p>{session.user?.email}</p>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  )
}