import { NextRequest } from "next/server"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"

export const authOptions = {
  adapter: PrismaAdapter({} as any),
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // For now, allow any login — replace with real DB check later
        if (credentials?.email) {
          return {
            id: "1",
            email: credentials.email as string,
            name: "Ravi",
            image: null,
          }
        }
        return null
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      if (token && session.user) {
        session.user.id = token.sub as string
      }
      return session
    },
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        token.sub = user.id
      }
      return token
    },
  },
}

const { handlers } = NextAuth(authOptions)

// Wrap NextAuth handlers to satisfy Next.js 16 route handler type constraint
async function GET(
  request: NextRequest,
  _context: { params: Promise<{ nextauth: string[] }> }
) {
  return handlers.GET(request as any) as unknown as Response
}

async function POST(
  request: NextRequest,
  _context: { params: Promise<{ nextauth: string[] }> }
) {
  return handlers.POST(request as any) as unknown as Response
}

export { GET, POST }