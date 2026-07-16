import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
import bcrypt from "bcryptjs";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  expectedDailyHours: true,
  active: true,
  createdAt: true,
  hourModuleEnabled: true,
  hourModuleHours: true,
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    name,
    email,
    password,
    role,
    expectedDailyHours,
    active,
    hourModuleEnabled,
    hourModuleHours,
  } = parsed.data;

  const data: Prisma.UserUpdateInput = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email.toLowerCase();
  if (role !== undefined) data.role = role;
  if (expectedDailyHours !== undefined) data.expectedDailyHours = expectedDailyHours;
  if (active !== undefined) data.active = active;
  if (password !== undefined && password !== "") {
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  // Turning the module off clears the interval, so it can't silently reapply later.
  data.hourModuleEnabled = hourModuleEnabled;
  data.hourModuleHours = hourModuleEnabled ? hourModuleHours ?? null : null;

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
    return Response.json({ user });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return Response.json({ error: "User not found" }, { status: 404 });
      }
      if (e.code === "P2002") {
        return Response.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { id } = await params;

  if (id === session.sub) {
    return Response.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    throw e;
  }

  return Response.json({ ok: true });
}
