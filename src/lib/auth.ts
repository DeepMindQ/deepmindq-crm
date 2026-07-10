import { getServerSession } from "next-auth/next"
export const auth = () => getServerSession()