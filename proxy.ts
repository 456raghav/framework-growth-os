import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the user's auth session on every request. Server Components
// can't write cookies themselves, so this middleware is the actual
// mechanism that keeps sessions alive and passes the refreshed token
// to both the server (via request cookies) and the browser (via the
// response). Without this, sessions would silently expire mid-use.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This call refreshes the token if needed — do not remove, even
  // though the return value isn't used directly here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isWidgetOrPublicApi =
    request.nextUrl.pathname.startsWith("/widget") ||
    request.nextUrl.pathname.startsWith("/api/chat") ||
    request.nextUrl.pathname.startsWith("/api/embed-config") ||
    request.nextUrl.pathname.startsWith("/api/cron");

  // Protect dashboard routes — redirect to /login if not authenticated.
  // Widget, public chat API, and cron routes stay open (visitors never
  // log in, and the cron job authenticates via its own secret, not a
  // user session).
  if (!user && !isLoginPage && !isWidgetOrPublicApi) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // If already logged in and visiting /login, send them to the dashboard
  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - public assets (images, embed.js)
     */
    "/((?!_next/static|_next/image|favicon.ico|embed.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
