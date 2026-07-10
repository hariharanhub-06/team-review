import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "MEMBER"]),
  expectedDailyHours: z.coerce.number().min(0).max(24).default(8),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  expectedDailyHours: z.coerce.number().min(0).max(24).optional(),
  active: z.boolean().optional(),
});

export const markLoginSchema = z.object({
  plannedWork: z.string().min(1, "Planned work is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const workEntrySchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().optional().nullable(),
  taskDescription: z.string().min(1),
  hoursWorked: z.coerce.number().min(0).max(24),
});

export const markLogoutSchema = z.object({
  workCompleted: z.string().min(1, "Work completed is required"),
  remarks: z.string().optional().default(""),
});

export const saveEntriesSchema = z.object({
  entries: z.array(workEntrySchema),
});

export const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  deliverables: z.string().optional().default(""),
});

export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "REJECTED",
] as const;

export const taskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES).default("TODO"),
  assigneeId: z.string().optional().nullable(),
  reviewNote: z.string().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type WorkEntryInput = z.infer<typeof workEntrySchema>;
