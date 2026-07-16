import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Hour module: an interval is required when the switch is on, and cleared when
 * it's off, so a disabled module can never leave a stale interval behind.
 */
const hourModuleFields = {
  hourModuleEnabled: z.boolean().default(false),
  hourModuleHours: z.coerce
    .number()
    .int("Time frame must be a whole number of hours")
    .min(1, "Time frame must be between 1 and 24 hours")
    .max(24, "Time frame must be between 1 and 24 hours")
    .nullable()
    .optional(),
};

const requireIntervalWhenEnabled = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine(
    (
      data: { hourModuleEnabled?: boolean; hourModuleHours?: number | null },
      ctx: z.RefinementCtx
    ) => {
      if (data.hourModuleEnabled && data.hourModuleHours == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hourModuleHours"],
          message: "Set a time frame (1-24 hours) for the hour module",
        });
      }
    }
  );

export const userCreateSchema = requireIntervalWhenEnabled(
  z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["ADMIN", "MEMBER"]),
    expectedDailyHours: z.coerce.number().min(0).max(24).default(8),
    ...hourModuleFields,
  })
);

export const userUpdateSchema = requireIntervalWhenEnabled(
  z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional().or(z.literal("")),
    role: z.enum(["ADMIN", "MEMBER"]).optional(),
    expectedDailyHours: z.coerce.number().min(0).max(24).optional(),
    active: z.boolean().optional(),
    ...hourModuleFields,
  })
);

/** A member reporting what they did in one hour-module window. */
export const hourSlotSchema = z.object({
  startAt: z.string().datetime(),
  content: z.string().max(2000, "Keep it under 2000 characters"),
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
  criticality: z.coerce
    .number()
    .int()
    .min(1, "Criticality must be between 1 and 10")
    .max(10, "Criticality must be between 1 and 10")
    .default(5),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type WorkEntryInput = z.infer<typeof workEntrySchema>;
