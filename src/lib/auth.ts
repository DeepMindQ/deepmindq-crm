// Auth is disabled for demo — return a mock session
// TODO: Enable real auth before production

export async function auth() {
  return {
    user: { id: "1", name: "Ravi", email: "ravi@deepmindq.com" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}