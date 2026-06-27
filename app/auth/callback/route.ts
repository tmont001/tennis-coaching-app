import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function safeRedirectPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  // Block protocol-relative URLs (//evil.com), absolute URLs, and non-path chars
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) {
    return '/dashboard';
  }
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?error=auth_callback_failed`,
  );
}
