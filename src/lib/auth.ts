// Mock auth module — no next-auth or bcryptjs imports

export const handlers = { GET: async () => new Response(null), POST: async () => new Response(null) }
export const auth = async () => ({
  user: { id: "demo-1", name: "Ravi Shanker", email: "ravi@deepmindq.com", role: "admin" },
})
export const signIn = async () => ({ ok: true, error: undefined })
export const signOut = async () => ({})