import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/fr/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.status = (user as any).status
        token.language = (user as any).language
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
        token.username = (user as any).username
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).status = token.status
        ;(session.user as any).language = token.language
        ;(session.user as any).firstName = token.firstName
        ;(session.user as any).lastName = token.lastName
        ;(session.user as any).username = token.username
      }
      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
        const url = `${base}/api/auth/verify-password`
        console.log('[authorize] fetching', url)

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
            }),
          })

          console.log('[authorize] status', res.status)
          const data = await res.json()
          console.log('[authorize] data', JSON.stringify(data))

          if (!data.valid) return null
          return data.user
        } catch (err) {
          console.error('[authorize] fetch failed:', err)
          return null
        }
      },
    }),
  ],
})
