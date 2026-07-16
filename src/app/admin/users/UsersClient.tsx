"use client";

import * as React from "react";
import {
  Button,
  Input,
  Select,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  StatusBadge,
} from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  expectedDailyHours: number;
  active: boolean;
  createdAt: string;
  hourModuleEnabled: boolean;
  hourModuleHours: number | null;
}

interface HistoryRow {
  date: string;
  loginAt: string | null;
  logoutAt: string | null;
  status: string | null;
  plannedWork: string | null;
  workCompleted: string | null;
  remarks: string | null;
  loginHours: number;
  workEntriesCount: number;
  workHours: number;
}

interface HistoryData {
  user: { id: string; name: string; email: string };
  history: HistoryRow[];
}

/* ---------------- Modal ---------------- */
function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className={
          "my-8 w-full max-w-lg rounded-lg border border-border bg-card text-card-foreground shadow-lg " +
          (className ?? "")
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Form types ---------------- */
interface FormState {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "MEMBER";
  expectedDailyHours: string;
  active: boolean;
  hourModuleEnabled: boolean;
  hourModuleHours: string;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  role: "MEMBER",
  expectedDailyHours: "8",
  active: true,
  hourModuleEnabled: false,
  hourModuleHours: "1",
};

export function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  const [users, setUsers] = React.useState<User[]>(initialUsers);

  // Create / edit modal
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<User | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyData, setHistoryData] = React.useState<HistoryData | null>(null);

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function refreshUsers() {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = (await res.json()) as { users: User[] };
      setUsers(data.users);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      expectedDailyHours: String(u.expectedDailyHours),
      active: u.active,
      hourModuleEnabled: u.hourModuleEnabled,
      hourModuleHours: u.hourModuleHours ? String(u.hourModuleHours) : "1",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    // The hour module only applies to members — an admin has no daily log to split.
    const hourModuleEnabled = form.role === "MEMBER" && form.hourModuleEnabled;

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      expectedDailyHours: Number(form.expectedDailyHours),
      hourModuleEnabled,
      hourModuleHours: hourModuleEnabled ? Number(form.hourModuleHours) : null,
    };

    if (editing) {
      payload.active = form.active;
      if (form.password.trim() !== "") payload.password = form.password;
    } else {
      payload.password = form.password;
    }

    try {
      const res = await fetch(
        editing ? `/api/users/${editing.id}` : "/api/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(data.error ?? "Something went wrong");
        return;
      }
      await refreshUsers();
      setFormOpen(false);
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(u: User) {
    if (u.id === currentUserId) return;
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(data.error ?? "Failed to delete user");
        return;
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch {
      window.alert("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function openHistory(u: User) {
    setHistoryOpen(true);
    setHistoryData(null);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/users/${u.id}/history`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setHistoryError(data.error ?? "Failed to load history");
        return;
      }
      setHistoryData((await res.json()) as HistoryData);
    } catch {
      setHistoryError("Network error. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <Button onClick={openCreate}>➕ New User</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Expected Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No users yet.
                    </td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {u.name}
                      {u.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "ADMIN" ? "info" : "default"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.expectedDailyHours}h
                      {u.hourModuleEnabled && u.hourModuleHours && (
                        <Badge
                          tone="info"
                          className="ml-2"
                          title={`Hour module on — reports every ${u.hourModuleHours}h from login`}
                        >
                          ⏱️ {u.hourModuleHours}h
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.active ? "success" : "destructive"}>
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          aria-label="Edit user"
                          onClick={() => openEdit(u)}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="History"
                          aria-label="View history"
                          onClick={() => openHistory(u)}
                        >
                          🕘
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            u.id === currentUserId
                              ? "You cannot delete your own account"
                              : "Delete"
                          }
                          aria-label="Delete user"
                          disabled={u.id === currentUserId || deletingId === u.id}
                          onClick={() => deleteUser(u)}
                        >
                          🗑
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? "Edit User" : "New User"}
      >
        <form onSubmit={submitForm} className="space-y-4">
          <div>
            <Label htmlFor="u-name">Name</Label>
            <Input
              id="u-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="u-password">Password</Label>
            <Input
              id="u-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editing ? "Leave blank to keep current" : ""}
              required={!editing}
              autoComplete="new-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="u-role">Role</Label>
              <Select
                id="u-role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as "ADMIN" | "MEMBER" })
                }
              >
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="u-hours">Expected Daily Hours</Label>
              <Input
                id="u-hours"
                type="number"
                min={0}
                max={24}
                step="0.5"
                value={form.expectedDailyHours}
                onChange={(e) =>
                  setForm({ ...form, expectedDailyHours: e.target.value })
                }
                required
              />
            </div>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          )}

          {/* Hour module — members only; an admin has no daily log to split. */}
          {form.role === "MEMBER" && (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  role="switch"
                  className="mt-0.5 h-4 w-4 rounded border-input"
                  checked={form.hourModuleEnabled}
                  onChange={(e) =>
                    setForm({ ...form, hourModuleEnabled: e.target.checked })
                  }
                />
                <span>
                  <span className="font-medium">Hour Module</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Splits their day into fixed windows from their login time. They
                    report what they did in each one, and each window locks when it
                    passes.
                  </span>
                </span>
              </label>

              {form.hourModuleEnabled && (
                <div>
                  <Label htmlFor="u-hm-hours">Time frame (hours)</Label>
                  <Input
                    id="u-hm-hours"
                    type="number"
                    min={1}
                    max={24}
                    step="1"
                    value={form.hourModuleHours}
                    onChange={(e) =>
                      setForm({ ...form, hourModuleHours: e.target.value })
                    }
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    A whole number from 1 to 24. With 1, a 09:36 login gives 09:36–10:36,
                    10:36–11:36, and so on.
                  </p>
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* History modal */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={
          historyData
            ? `History — ${historyData.user.name}`
            : "History"
        }
        className="max-w-4xl"
      >
        {historyLoading && (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        )}
        {historyError && (
          <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
            {historyError}
          </p>
        )}
        {historyData && !historyLoading && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {historyData.user.email} · last {historyData.history.length}{" "}
              {historyData.history.length === 1 ? "day" : "days"}
            </p>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Login</th>
                    <th className="px-3 py-2 font-medium">Logout</th>
                    <th className="px-3 py-2 font-medium">Hours</th>
                    <th className="px-3 py-2 font-medium">Work Hrs</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Work / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.history.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No history yet.
                      </td>
                    </tr>
                  )}
                  {historyData.history.map((h, i) => (
                    <tr key={i} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(h.date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {h.loginAt ? formatTime(h.loginAt) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {h.logoutAt ? formatTime(h.logoutAt) : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{h.loginHours}h</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {h.workHours}h
                        {h.workEntriesCount > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({h.workEntriesCount})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={h.status} />
                      </td>
                      <td className="px-3 py-2 max-w-xs text-muted-foreground">
                        {h.workCompleted && <div>{h.workCompleted}</div>}
                        {h.remarks && (
                          <div className="text-xs italic">{h.remarks}</div>
                        )}
                        {!h.workCompleted && !h.remarks && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
