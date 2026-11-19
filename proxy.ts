import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (process.env.VISUAL_TEST_MODE === "true" && request.nextUrl.pathname.startsWith("/test-preview")) {
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/auth/callback") || request.nextUrl.pathname.startsWith("/auth/confirm");
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (user && isPublic) return NextResponse.redirect(new URL("/dashboard", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
