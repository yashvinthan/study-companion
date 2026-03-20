import { redirect } from 'next/navigation';

export default function AuthenticatedAppPage() {
  redirect('/app/dashboard');
}
