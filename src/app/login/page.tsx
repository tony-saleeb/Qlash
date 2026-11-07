import { redirect } from 'next/navigation';

export default function LoginPage() {
  redirect('/?host=1&mode=login');
}
