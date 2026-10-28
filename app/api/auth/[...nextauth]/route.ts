import NextAuth, { type AuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { loadUserRoles } from "../../../lib/userRoles"

export const runtime = "nodejs"

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

const prisma =
  globalThis.prisma ||
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
  })
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma

// How often a signed-in user's lastActiveAt is refreshed (it's written from the
// session check that runs on page loads, so this caps it to one write per window).
const ACTIVITY_THROTTLE_MS = 15 * 60 * 1000

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          scope: "openid profile email",
        },
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user || !user.password) return null
        if (user.deletedAt) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      // For Azure AD, verify the user exists in our DB
      if (account?.provider === "azure-ad") {
        if (!user.email) return false
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, deletedAt: true },
        })
        if (!existing || existing.deletedAt) return "/auth/error?error=UserNotFound"
        ;(user as any).id = existing.id
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // First sign-in: populate token from the user object
        token.id = (user as any).id ?? user.id
        const loaded = await loadUserRoles(prisma, token.id as string)
        token.roles = loaded?.roles ?? []
        const now = new Date()
        await prisma.user
          .update({ where: { id: token.id as string }, data: { lastLoginAt: now, lastActiveAt: now } })
          .catch((err) => console.error("[auth] failed to record sign-in", err))
      } else if (token.id) {
        // Subsequent requests: refresh roles from DB. Deleted users lose role-gated
        // access immediately; sign-in is already blocked.
        const loaded = await loadUserRoles(prisma, token.id as string)
        token.roles = loaded?.roles ?? []
        if (loaded && (!loaded.lastActiveAt || Date.now() - loaded.lastActiveAt.getTime() > ACTIVITY_THROTTLE_MS)) {
          await prisma.user
            .update({ where: { id: token.id as string }, data: { lastActiveAt: new Date() } })
            .catch((err) => console.error("[auth] failed to record activity", err))
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id
        ;(session.user as any).roles = token.roles
      }
      return session
    },
  },
  pages: {
    signIn: "/",
    error: "/auth/error",
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
