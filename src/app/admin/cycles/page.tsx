import { redirect } from 'next/navigation';

export default function CyclesRedirect() {
  redirect('/admin/settings#cycles');
}
