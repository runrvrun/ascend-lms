import NextAuth, { type AuthOptions } from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { PrismaClient, Division, JobTitle } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

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
          prompt: "login",
          scope: "openid profile email",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user }: { user: any; account?: any }) {
      if (!user.email) {
        return false
      }

      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        include: { roles: true },
      })

      if (!existing) {
        return "/auth/error?error=UserNotFound"
      }

      ;(user as any).id = existing.id
      ;(user as any).roles = existing.roles.map((roleItem) => roleItem.role)

      return true
    },
    async session({ session, user }: { session: any; user: any }) {
      if (session.user) {
        session.user.id = user.id
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { roles: true },
        })
        session.user.roles = dbUser?.roles.map((r) => r.role) ?? []
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
