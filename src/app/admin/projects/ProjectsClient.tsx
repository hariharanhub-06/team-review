"use client";

import * as React from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from "@/components/ui";
import { formatDate, formatDuration, cn } from "@/lib/utils";
import { taskOverdue } from "@/lib/tasks";
import {
  criticalityLabel,
  CRITICALITY_DEFAULT,
  CRITICALITY_MAX,
  CRITICALITY_MIN,
} from "@/lib/scoring";

/** 1..10, for the criticality dropdowns. */
const CRITICALITY_OPTIONS = Array.from(
  { length: CRITICALITY_MAX - CRITICALITY_MIN + 1 },
  (_, i) => CRITICALITY_MIN + i
);

/* ---------------- Types (serialized shapes) ---------------- */
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "REJECTED";

interface Member {
  id: string;
  name: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: TaskStatus;
  criticality: number;
  completedAt: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  hoursWorked: number;
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  deliverables: string | null;
  onHold: boolean;
  holdSince: string | null;
  heldDays: number;
  createdAt: string;
  _count: { tasks: number };
  tasks: Task[];
}

interface Props {
  initialProjects: Project[];
  members: Member[];
}

/* ---------------- Helpers ---------------- */
/** ISO string (or Date) -> yyyy-mm-dd for <input type="date">. */
function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function isOverdue(task: Task, project: Project): boolean {
  return taskOverdue(task.endDate, task.status, project).overdue;
}

interface TaskSummary {
  total: number;
  done: number;
  overdue: number;
  inReview: number;
}

function summarize(project: Project): TaskSummary {
  return project.tasks.reduce<TaskSummary>(
    (acc, t) => {
      acc.total += 1;
      if (t.status === "DONE") acc.done += 1;
      if (t.status === "IN_REVIEW") acc.inReview += 1;
      if (isOverdue(t, project)) acc.overdue += 1;
      return acc;
    },
    { total: 0, done: 0, overdue: 0, inReview: 0 }
  );
}

/* ---------------- Modal ---------------- */
function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
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
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full rounded-lg border border-border bg-card shadow-lg",
          // The task table needs real width — otherwise the title column
          // collapses to one word per line and every edit needs a sideways scroll.
          wide ? "max-w-[min(96vw,1400px)]" : "max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Project form ---------------- */
interface ProjectFormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  deliverables: string;
}

function emptyProjectForm(): ProjectFormState {
  return {
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    deliverables: "",
  };
}

/* ---------------- Main ---------------- */
export default function ProjectsClient({ initialProjects, members }: Props) {
  const [projects, setProjects] = React.useState<Project[]>(initialProjects);
  const [error, setError] = React.useState<string | null>(null);

  // Project modal state
  const [projectModalOpen, setProjectModalOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<Project | null>(
    null
  );
  const [projectForm, setProjectForm] = React.useState<ProjectFormState>(
    emptyProjectForm()
  );
  const [savingProject, setSavingProject] = React.useState(false);

  // Manage-tasks modal
  const [manageProjectId, setManageProjectId] = React.useState<string | null>(
    null
  );

  const manageProject = projects.find((p) => p.id === manageProjectId) ?? null;

  async function refetchProjects() {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects as Project[]);
    }
  }

  /* --- Project handlers --- */
  function openNewProject() {
    setEditingProject(null);
    setProjectForm(emptyProjectForm());
    setError(null);
    setProjectModalOpen(true);
  }

  function openEditProject(p: Project) {
    setEditingProject(p);
    setProjectForm({
      name: p.name,
      description: p.description ?? "",
      startDate: toInputDate(p.startDate),
      endDate: toInputDate(p.endDate),
      deliverables: p.deliverables ?? "",
    });
    setError(null);
    setProjectModalOpen(true);
  }

  async function submitProject(e: React.FormEvent) {
    e.preventDefault();
    setSavingProject(true);
    setError(null);
    const payload = {
      name: projectForm.name,
      description: projectForm.description,
      startDate: projectForm.startDate || null,
      endDate: projectForm.endDate || null,
      deliverables: projectForm.deliverables,
    };
    const url = editingProject
      ? `/api/projects/${editingProject.id}`
      : "/api/projects";
    const method = editingProject ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSavingProject(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save project");
      return;
    }
    setProjectModalOpen(false);
    await refetchProjects();
  }

  async function toggleHold(p: Project) {
    setError(null);
    const res = await fetch(`/api/projects/${p.id}/hold`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hold: !p.onHold }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update hold status");
      return;
    }
    await refetchProjects();
  }

  async function deleteProject(p: Project) {
    if (
      !window.confirm(
        `Delete project "${p.name}"? This removes its ${p._count.tasks} task(s) and related work entries.`
      )
    )
      return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete project");
      return;
    }
    if (manageProjectId === p.id) setManageProjectId(null);
    await refetchProjects();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={openNewProject}>➕ New Project</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Grid of project cards */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No projects yet. Create your first project to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const s = summarize(p);
            return (
              <Card
                key={p.id}
                className={cn(
                  "flex flex-col",
                  p.onHold && "border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/5"
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="break-words">{p.name}</CardTitle>
                    {p.onHold && (
                      <Badge tone="warning" className="mt-1">
                        ⏸ On Hold
                      </Badge>
                    )}
                    {!p.onHold && p.heldDays > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.heldDays}d previously on hold (excluded from overdue)
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={p.onHold ? "Resume project" : "Put on hold"}
                      aria-label={p.onHold ? "Resume project" : "Put on hold"}
                      onClick={() => toggleHold(p)}
                    >
                      {p.onHold ? "▶️" : "⏸"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      aria-label="Edit project"
                      onClick={() => openEditProject(p)}
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      aria-label="Delete project"
                      onClick={() => deleteProject(p)}
                    >
                      🗑
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  {p.description && (
                    <p className="text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    📅 {formatDate(p.startDate)} → {formatDate(p.endDate)}
                  </p>

                  {p.deliverables && (
                    <p className="text-sm">
                      <span className="font-medium">Deliverables: </span>
                      <span className="text-muted-foreground">
                        {p.deliverables}
                      </span>
                    </p>
                  )}

                  {/* Task summary */}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                    <Badge tone="default">{s.total} tasks</Badge>
                    <Badge tone="success">{s.done} done</Badge>
                    {s.inReview > 0 && (
                      <Badge tone="warning">{s.inReview} to approve</Badge>
                    )}
                    {s.overdue > 0 && (
                      <Badge tone="destructive">{s.overdue} overdue</Badge>
                    )}
                  </div>

                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setManageProjectId(p.id)}
                    >
                      Manage Tasks
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Project create/edit modal */}
      <Modal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={editingProject ? "Edit Project" : "New Project"}
      >
        <form onSubmit={submitProject} className="space-y-4">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm({ ...projectForm, name: e.target.value })
              }
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              value={projectForm.description}
              onChange={(e) =>
                setProjectForm({ ...projectForm, description: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-start">Start date</Label>
              <Input
                id="p-start"
                type="date"
                value={projectForm.startDate}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="p-end">End date</Label>
              <Input
                id="p-end"
                type="date"
                value={projectForm.endDate}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, endDate: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="p-deliv">Deliverables</Label>
            <Textarea
              id="p-deliv"
              value={projectForm.deliverables}
              onChange={(e) =>
                setProjectForm({ ...projectForm, deliverables: e.target.value })
              }
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingProject}>
              {savingProject ? "Saving…" : editingProject ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage tasks modal */}
      <Modal
        open={manageProject !== null}
        onClose={() => setManageProjectId(null)}
        title={manageProject ? `Tasks — ${manageProject.name}` : "Tasks"}
        wide
      >
        {manageProject && (
          <ManageTasks
            project={manageProject}
            members={members}
            onChanged={refetchProjects}
          />
        )}
      </Modal>
    </div>
  );
}

/* ---------------- Manage Tasks panel ---------------- */
interface TaskFormState {
  title: string;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  assigneeId: string;
  criticality: number;
}

function emptyTaskForm(): TaskFormState {
  return {
    title: "",
    startDate: "",
    endDate: "",
    status: "TODO",
    assigneeId: "",
    criticality: CRITICALITY_DEFAULT,
  };
}

function ManageTasks({
  project,
  members,
  onChanged,
}: {
  project: Project;
  members: Member[];
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = React.useState<TaskFormState>(emptyTaskForm());
  const [adding, setAdding] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Inline edit of an existing task's title / dates / criticality.
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState({
    title: "",
    startDate: "",
    endDate: "",
    criticality: CRITICALITY_DEFAULT,
  });

  const tasks = project.tasks;

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setErr(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: form.title,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
        assigneeId: form.assigneeId || null,
        criticality: form.criticality,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed to add task");
      return;
    }
    setForm(emptyTaskForm());
    await onChanged();
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    setBusyId(task.id);
    setErr(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr("Failed to update status");
      return;
    }
    await onChanged();
  }

  async function approveTask(task: Task) {
    await changeStatus(task, "DONE");
  }

  async function rejectTask(task: Task) {
    const note = window.prompt(
      `Reject "${task.title}"? Optionally add a reason for the member:`,
      ""
    );
    if (note === null) return; // cancelled
    setBusyId(task.id);
    setErr(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", reviewNote: note }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr("Failed to reject task");
      return;
    }
    await onChanged();
  }

  async function changeAssignee(task: Task, assigneeId: string) {
    setBusyId(task.id);
    setErr(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    });
    setBusyId(null);
    if (!res.ok) {
      setErr("Failed to update assignee");
      return;
    }
    await onChanged();
  }

  function startEdit(task: Task) {
    setErr(null);
    setEditId(task.id);
    setEditForm({
      title: task.title,
      startDate: toInputDate(task.startDate),
      endDate: toInputDate(task.endDate),
      criticality: task.criticality,
    });
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit(task: Task) {
    const title = editForm.title.trim();
    if (!title) {
      setErr("Title is required");
      return;
    }
    setBusyId(task.id);
    setErr(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        criticality: editForm.criticality,
      }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed to update task");
      return;
    }
    setEditId(null);
    await onChanged();
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    setBusyId(task.id);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      setErr("Failed to delete task");
      return;
    }
    await onChanged();
  }

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Task table */}
      <div className="overflow-x-auto">
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No tasks yet.
          </p>
        ) : (
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="w-[28%] min-w-[220px] py-2 pr-3 font-medium">Title</th>
                <th className="py-2 pr-3 font-medium">Dates</th>
                <th
                  className="py-2 pr-3 font-medium"
                  title="How critical the task is, 1–10. Drives the assignee's impact score."
                >
                  Critical
                </th>
                <th className="py-2 pr-3 text-right font-medium">Hours</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Assignee</th>
                <th className="py-2 pr-3 font-medium">Approval</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const overdue = isOverdue(t, project);
                const editing = editId === t.id;
                return (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-b border-border align-top",
                      overdue && !editing && "border-l-2 border-l-destructive",
                      editing && "bg-muted/30"
                    )}
                  >
                    <td className="py-2 pr-3">
                      {editing ? (
                        <Input
                          className="h-8 w-full py-1 text-xs"
                          value={editForm.title}
                          disabled={busyId === t.id}
                          aria-label="Task title"
                          autoFocus
                          onChange={(e) =>
                            setEditForm({ ...editForm, title: e.target.value })
                          }
                        />
                      ) : (
                        <>
                          <span
                            className={cn(
                              "font-medium",
                              overdue && "text-destructive"
                            )}
                          >
                            {t.title}
                          </span>
                          {overdue && (
                            <span className="ml-2 text-xs text-destructive">
                              overdue
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            className="h-8 w-[130px] py-1 text-xs"
                            value={editForm.startDate}
                            disabled={busyId === t.id}
                            aria-label="Start date"
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                startDate: e.target.value,
                              })
                            }
                          />
                          <span>→</span>
                          <Input
                            type="date"
                            className="h-8 w-[130px] py-1 text-xs"
                            value={editForm.endDate}
                            disabled={busyId === t.id}
                            aria-label="End date"
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                endDate: e.target.value,
                              })
                            }
                          />
                        </div>
                      ) : (
                        <>
                          {formatDate(t.startDate)} → {formatDate(t.endDate)}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {editing ? (
                        <Select
                          className="h-8 w-[130px] py-1 text-xs"
                          value={String(editForm.criticality)}
                          disabled={busyId === t.id}
                          aria-label="Criticality"
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              criticality: Number(e.target.value),
                            })
                          }
                        >
                          {CRITICALITY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c} · {criticalityLabel(c).label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge
                          tone={criticalityLabel(t.criticality).tone}
                          title={`${criticalityLabel(t.criticality).label} — ${
                            t.criticality
                          }/10 impact points`}
                        >
                          {t.criticality}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {formatDuration(t.hoursWorked)}
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        className="h-8 w-[140px] py-1 text-xs"
                        value={t.status}
                        disabled={busyId === t.id}
                        onChange={(e) =>
                          changeStatus(t, e.target.value as TaskStatus)
                        }
                      >
                        <option value="TODO">To do</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="IN_REVIEW">In review</option>
                        <option value="DONE">Done</option>
                        <option value="REJECTED">Rejected</option>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        className="h-8 w-[150px] py-1 text-xs"
                        value={t.assigneeId ?? ""}
                        disabled={busyId === t.id}
                        onChange={(e) => changeAssignee(t, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      {t.status === "IN_REVIEW" ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="success"
                            disabled={busyId === t.id}
                            onClick={() => approveTask(t)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId === t.id}
                            onClick={() => rejectTask(t)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : t.status === "DONE" ? (
                        <span className="text-xs text-[hsl(var(--success))]">Approved</span>
                      ) : t.status === "REJECTED" ? (
                        <span className="text-xs text-destructive">Rejected</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {editing ? (
                          <>
                            <Button
                              size="sm"
                              disabled={busyId === t.id}
                              onClick={() => saveEdit(t)}
                            >
                              {busyId === t.id ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === t.id}
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit task"
                              aria-label="Edit task"
                              disabled={busyId === t.id}
                              onClick={() => startEdit(t)}
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete task"
                              aria-label="Delete task"
                              disabled={busyId === t.id}
                              onClick={() => removeTask(t)}
                            >
                              🗑
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add task form */}
      <form
        onSubmit={addTask}
        className="grid grid-cols-1 gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-7"
      >
        <div className="lg:col-span-2">
          <Label htmlFor="t-title">Title</Label>
          <Input
            id="t-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="t-start">Start</Label>
          <Input
            id="t-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="t-end">End</Label>
          <Input
            id="t-end"
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="t-status">Status</Label>
          <Select
            id="t-status"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as TaskStatus })
            }
          >
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="IN_REVIEW">In review</option>
            <option value="DONE">Done</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="t-assignee">Assignee</Label>
          <Select
            id="t-assignee"
            value={form.assigneeId}
            onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="t-crit" title="1 = trivial, 10 = mission-critical">
            Criticality
          </Label>
          <Select
            id="t-crit"
            value={String(form.criticality)}
            onChange={(e) =>
              setForm({ ...form, criticality: Number(e.target.value) })
            }
          >
            {CRITICALITY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c} · {criticalityLabel(c).label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end lg:col-span-7">
          <Button type="submit" size="sm" disabled={adding}>
            {adding ? "Adding…" : "➕ Add Task"}
          </Button>
        </div>
      </form>
    </div>
  );
}
