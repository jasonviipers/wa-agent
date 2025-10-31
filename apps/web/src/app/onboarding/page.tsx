import { Onboarding } from '@/components/onboarding';
import { auth } from '@wagents/auth';
import { db, eq } from '@wagents/db';
import { organization } from '@wagents/db/schema/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: "Onboarding | WhatsApp AI",
  description: "Complete your workspace setup",
};

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect('/auth/sign-in');
  }

  return (
    <div>
      <Onboarding session={session} organizations={[]} />
    </div>
  )
}
