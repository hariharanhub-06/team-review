import { PrismaClient, Role, TaskStatus, DayStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@teams.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin";

  // --- Admin ---
  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {},
    create: {
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: Role.ADMIN,
    },
  });

  // --- Sample members ---
  const members = [];
  const sample = [
    { name: "Alice Johnson", email: "alice@teams.local" },
    { name: "Bob Smith", email: "bob@teams.local" },
    { name: "Carol Nguyen", email: "carol@teams.local" },
  ];
  for (const s of sample) {
    const m = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        passwordHash: await bcrypt.hash("password123", 10),
        role: Role.MEMBER,
        expectedDailyHours: 8,
      },
    });
    members.push(m);
  }

  // --- Projects ---
  const projectDefs = [
    {
      name: "Website Redesign",
      description: "Revamp the marketing website with a new design system.",
      startDate: daysAgo(20),
      endDate: daysAgo(-10),
      deliverables: "Design system, homepage, pricing page, blog.",
    },
    {
      name: "Mobile App",
      description: "Cross-platform mobile app MVP.",
      startDate: daysAgo(15),
      endDate: daysAgo(-25),
      deliverables: "Auth, dashboard, notifications.",
    },
    {
      name: "Data Pipeline",
      description: "ETL pipeline for analytics.",
      startDate: daysAgo(30),
      endDate: daysAgo(3), // ended already -> used for overdue tasks
      deliverables: "Ingestion, transforms, reporting tables.",
    },
  ];

  const projects = [];
  for (const p of projectDefs) {
    // upsert by name-ish: find first, else create
    const existing = await prisma.project.findFirst({ where: { name: p.name } });
    const proj = existing
      ? existing
      : await prisma.project.create({ data: p });
    projects.push(proj);
  }

  // --- Tasks (some overdue, some on-time) ---
  const existingTasks = await prisma.task.count();
  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        {
          projectId: projects[0].id,
          title: "Build design system",
          startDate: daysAgo(20),
          endDate: daysAgo(5),
          status: TaskStatus.DONE,
          completedAt: daysAgo(6),
          assigneeId: members[0].id,
        },
        {
          projectId: projects[0].id,
          title: "Homepage layout",
          startDate: daysAgo(10),
          endDate: daysAgo(-5),
          status: TaskStatus.IN_PROGRESS,
          assigneeId: members[0].id,
        },
        {
          projectId: projects[1].id,
          title: "Auth flow",
          startDate: daysAgo(14),
          endDate: daysAgo(-2),
          status: TaskStatus.IN_PROGRESS,
          assigneeId: members[1].id,
        },
        {
          projectId: projects[2].id,
          title: "Ingestion job",
          startDate: daysAgo(28),
          endDate: daysAgo(4), // overdue: past end, not done
          status: TaskStatus.IN_PROGRESS,
          assigneeId: members[2].id,
        },
        {
          projectId: projects[2].id,
          title: "Reporting tables",
          startDate: daysAgo(20),
          endDate: daysAgo(2),
          status: TaskStatus.DONE,
          completedAt: daysAgo(1), // completed late
          assigneeId: members[2].id,
        },
      ],
    });
  }

  // --- Daily logs + work entries for the past 10 days ---
  const existingLogs = await prisma.dailyLog.count();
  if (existingLogs === 0) {
    for (const m of members) {
      for (let d = 10; d >= 1; d--) {
        // skip some days to create realistic consistency gaps
        if ((d + m.name.length) % 4 === 0) continue;
        const date = daysAgo(d);
        const login = new Date(date);
        login.setUTCHours(9, Math.floor((m.name.length * 7) % 60), 0, 0);
        const logout = new Date(date);
        logout.setUTCHours(17 + (d % 3), 30, 0, 0);

        const proj = projects[(d + m.name.length) % projects.length];
        const proj2 = projects[(d + 1) % projects.length];
        const h1 = 3 + ((d * 7 + m.name.length) % 4);
        const h2 = 2 + (d % 3);

        await prisma.dailyLog.create({
          data: {
            userId: m.id,
            date,
            loginAt: login,
            logoutAt: logout,
            plannedWork: `Work on ${proj.name} and ${proj2.name}.`,
            workCompleted: `Progressed on ${proj.name}; addressed review comments.`,
            status: d % 5 === 0 ? DayStatus.BLOCKED : d % 2 === 0 ? DayStatus.COMPLETED : DayStatus.IN_PROGRESS,
            remarks: d % 3 === 0 ? "Waiting on design assets." : "",
            workEntries: {
              create: [
                { projectId: proj.id, taskDescription: "Implementation & testing", hoursWorked: h1 },
                { projectId: proj2.id, taskDescription: "Code review & docs", hoursWorked: h2 },
              ],
            },
          },
        });
      }
    }
  }

  console.log("Seed complete.");
  console.log(`Admin: ${admin.email}`);
  console.log("Sample members password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
