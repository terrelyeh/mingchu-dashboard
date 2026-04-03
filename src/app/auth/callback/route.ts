import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const DEMO_WS_ID = "00000000-0000-0000-0000-000000000001"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Auto-join: ensure user is a member of the demo workspace
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Check if already a member
        const { data: existing } = await supabase
          .from("workspace_members")
          .select("id")
          .eq("workspace_id", DEMO_WS_ID)
          .eq("user_id", user.id)
          .maybeSingle()

        if (!existing) {
          // Join demo workspace as admin
          await supabase.from("workspace_members").insert({
            workspace_id: DEMO_WS_ID,
            user_id: user.id,
            role: "admin",
          })
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host")
      const isLocalEnv = process.env.NODE_ENV === "development"
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Auth error — redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
