import { NextResponse } from 'next/server';
import {
  acceptHydraLogoutRequest,
  getHydraLogoutRequest,
  rejectHydraConsentRequest,
} from '@/lib/server/hydra';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('logout_challenge');
  const selfUrl = process.env.SELF_URL || '';

  if (!challenge) {
    return NextResponse.redirect(`${selfUrl}/`);
  }

  try {
    await getHydraLogoutRequest(challenge);
    const result = await acceptHydraLogoutRequest(challenge);

    const res = NextResponse.redirect(result.redirect_to);
    res.headers.set(
      'Set-Cookie',
      'ory_kratos_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
    );
    return res;
  } catch {
    return NextResponse.redirect(`${selfUrl}/`);
  }
}