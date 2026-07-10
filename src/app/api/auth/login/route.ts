import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  // Fail loudly (and clearly) when the deployment is missing required config.
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length) {
    return Response.json(
      {
        error: `Server not configured: missing ${missing.join(", ")}. Set these environment variables in your hosting provider and redeploy.`,
      },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signSession({
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });
    await setSessionCookie(token);

    return Response.json({ role: user.role });
  } catch (err) {
    console.error("[login] unexpected error:", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : "Unknown error";
    return Response.json(
      { error: "Login failed on the server.", detail },
      { status: 500 }
    );
  }
}
