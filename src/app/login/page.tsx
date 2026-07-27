import { redirect } from 'next/navigation';

// Redirect /login to root — the landing page at / handles everything
export default function LoginPageRedirect() {
  redirect('/');
}
