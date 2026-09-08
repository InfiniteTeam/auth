import { NextResponse } from 'next/server';
import {
  acceptHydraLoginRequest,
  getHydraLoginRequest,
} from '@/lib/server/hydra';
import { fetchSession } from '@/lib/server/kratos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('login_challenge');
  const selfUrl = process.env.SELF_URL || '';

  if (!challenge) {
    return NextResponse.redirect(`${selfUrl}/error?message=Missing%20login_challenge`);
  }

  try {
    const loginRequest = await getHydraLoginRequest(challenge);

    if (loginRequest.skip && loginRequest.subject) {
      const result = await acceptHydraLoginRequest(challenge, loginRequest.subject, true);
      return NextResponse.redirect(result.redirect_to);
    }

    const session = await fetchSession();

    if (session?.identity) {
      const result = await acceptHydraLoginRequest(challenge, session.identity.id, true);
      return NextResponse.redirect(result.redirect_to);
    }

    const returnTo = encodeURIComponent(`${selfUrl}/oauth2/login?login_challenge=${encodeURIComponent(challenge)}`);
    return NextResponse.redirect(`${selfUrl}/login?return_to=${returnTo}`);
  } catch {
    return NextResponse.redirect(`${selfUrl}/error?message=Login%20failed`);
  }
}