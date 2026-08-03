/**
 * Single source of truth for everything the site says.
 * Edit here, never in the DOM.
 */

export const profile = {
  first: "ALI",
  last: "TARRAF",
  role: "Senior Software Engineer",
  discipline: "Frontend Architecture",
  location: "Beirut, Lebanon",
  available: true,
  email: "ali.tarraf2017@gmail.com",
  phone: "+961 70 421 157",
  linkedin: "https://linkedin.com/in/ali-tarraf-730b9a171",
  github: "https://github.com/Tarraf2020",
  linkedinLabel: "ali-tarraf-730b9a171",
  githubLabel: "Tarraf2020",
} as const;

export const manifesto = [
  { text: "Five+ years of ", em: false },
  { text: "shipping", em: true },
  {
    text: " SaaS platforms that outlive the sprint that made them. I own frontend ",
    em: false,
  },
  { text: "architecture", em: true },
  {
    text: " — the part nobody sees until it holds, or doesn’t. Multi-tenant systems, SSR at scale, ",
    em: false,
  },
  { text: "design systems", em: true },
  {
    text: " that survive six product teams pulling in six directions. Then I mentor the next engineer to do it without me.",
    em: false,
  },
] as const;

export type Metric = {
  value: number;
  suffix: string;
  prefix?: string;
  label: string;
  detail: string;
};

/** Headline numbers — driven by the counter module. */
export const scale: Metric[] = [
  {
    value: 1_000_000,
    suffix: "+",
    label: "Users reached",
    detail: "A music — creator platform, worldwide",
  },
  {
    value: 120_000,
    suffix: "",
    label: "AI platform for the legal industry",
    detail: "Legal research, contract review, and practice management",
  },
  {
    value: 50,
    suffix: "+",
    label: "Companies served",
    detail: "Tenants live on a single codebase",
  },
  {
    value: 6,
    suffix: "",
    label: "Business modules",
    detail: "Consolidated into one unified application",
  },
];

/** Deltas — rendered as particle bars in the IMPACT section. */
export const impact = [
  {
    value: 40,
    dir: "down" as const,
    label: "Latency",
    where: "Numbase Group",
    how: "Replaced legacy patterns with structured design patterns",
  },
  {
    value: 40,
    dir: "down" as const,
    label: "Load time",
    where: "Docclik",
    how: "Frontend optimization + maintainable architecture",
  },
  {
    value: 30,
    dir: "up" as const,
    label: "Scheduling efficiency",
    where: "Docclik",
    how: "Reworked scheduling flow with backend",
  },
  {
    value: 25,
    dir: "up" as const,
    label: "Reliability",
    where: "Skeldus",
    how: "Frontend optimization initiatives",
  },
  {
    value: 25,
    dir: "up" as const,
    label: "Platform performance",
    where: "Docclik",
    how: "Render + payload budget discipline",
  },
  {
    value: 20,
    dir: "up" as const,
    label: "User retention",
    where: "Docclik",
    how: "Faster, clearer scheduling UX",
  },
  {
    value: 15,
    dir: "down" as const,
    label: "Downtime & bugs",
    where: "Skeldus",
    how: "Quality gates and code review culture",
  },
];

export type Role = {
  id: string;
  company: string;
  title: string;
  place: string;
  from: string;
  to: string;
  fromYear: number;
  toYear: number;
  current?: boolean;
  headline: string;
  bullets: string[];
  stack: string[];
};

export const roles: Role[] = [
  {
    id: "sowlutions",
    company: "Sowlutions Inc",
    title: "Senior Software Engineer",
    place: "Lebanon",
    from: "08 / 2024",
    to: "05 / 2026",
    fromYear: 2024,
    toYear: 2026,
    current: true,
    headline:
      "Led a frontend team of 3 across multiple SaaS products, and owned the architecture of a platform serving 120,000 users.",
    bullets: [
      "Led a frontend team of 3 developers across multiple SaaS products, conducting 50+ monthly pull request reviews, mentoring developers, enforcing code quality standards, and driving software development best practices.",
      "Owned the frontend architecture and implementation of Haqq.ai — a multi-tenant legal operations platform consolidating 6 business modules into a unified application serving 50+ companies and 120,000 users.",
      "Designed and implemented 15+ financial management workflows, KPI dashboards, reporting systems, data tables, and analytics interfaces covering expenses, invoices, time tracking, payments and chart of accounts.",
      "Led the redesign and refactoring of major areas of HelloThematic, a creator platform with more than 1 million active users worldwide — usability, performance, and user experience.",
      "Architected scalable frontend solutions with Vue, Nuxt 3 (SSR) and TypeScript, enabling rapid feature delivery across large multi-tenant applications.",
      "Refactored platform components and shipped SEO improvements, strengthening scalability, stability and maintainability.",
      "Collaborated with backend engineers on deployments, CI/CD pipelines, Docker environments, cloud infrastructure, server management, monitoring and production stability.",
      "Contributed to architecture planning, technical decision-making and product strategy, working directly with the CEO and CTO.",
    ],
    stack: [
      "Vue",
      "Nuxt 3",
      "SSR",
      "TypeScript",
      "Docker",
      "CI/CD",
      "Linux",
      "Caddy",
      "VPS Deployment",
    ],
  },
  {
    id: "skeldus",
    company: "Skeldus",
    title: "Frontend Engineer",
    place: "Remote · New York",
    from: "10 / 2023",
    to: "09 / 2024",
    fromYear: 2023,
    toYear: 2024,
    headline:
      "Built the dashboard surface of a cybersecurity and compliance platform — 13+ interfaces, +25% reliability.",
    bullets: [
      "Developed and enhanced frontend functionality for a cybersecurity and compliance SaaS platform, delivering scalable and maintainable solutions with cross-functional teams.",
      "Designed and implemented 13+ customer-facing and internal dashboards, reporting systems and analytics interfaces using React, Next.js, Ant Design and Tailwind CSS.",
      "Built interfaces surfacing compliance analytics, operational reporting, user activity metrics, project progress and security insights to support business decisions.",
      "Improved platform scalability, reliability and performance through frontend optimization initiatives — a 25% increase in reliability and a 15% reduction in downtime and bugs.",
      "Partnered with Product, Design, Data, Compliance and Engineering to deliver customer-facing features and compliance-focused enhancements.",
    ],
    stack: ["React", "Next.js", "Ant Design", "Tailwind CSS", "TypeScript"],
  },
  {
    id: "numbase",
    company: "Numbase Group",
    title: "Frontend Engineer",
    place: "Remote · Qatar",
    from: "08 / 2022",
    to: "09 / 2023",
    fromYear: 2022,
    toYear: 2023,
    headline:
      "Real-time systems and an architecture rewrite that cut latency 40%.",
    bullets: [
      "Developed real-time chat and notification systems with Socket.io, supporting scalability and performance optimization initiatives before launch.",
      "Refactored application architecture by replacing legacy implementation patterns with structured software design patterns — a 40% reduction in latency and materially better maintainability.",
      "Built a drag-and-drop video upload system with persistent progress tracking, letting users keep working while uploads ran in the background.",
    ],
    stack: ["React", "Socket.io", "Node.js", "Design Patterns"],
  },
  {
    id: "docclik",
    company: "Docclik",
    title: "Full-Stack Web Developer",
    place: "Remote · Canada",
    from: "08 / 2021",
    to: "08 / 2022",
    fromYear: 2021,
    toYear: 2022,
    headline:
      "Live scheduling for a healthcare platform connecting thousands of practitioners across Canada.",
    bullets: [
      "Developed live appointment scheduling and calendar functionality for a healthcare platform serving B2B and B2C users, across frontend and backend.",
      "Contributed to a platform connecting thousands of practitioners and several hundred clinics across Canada.",
      "Collaborated with backend developers on scheduling and workflow improvements — 30% more scheduling efficiency, 20% higher user retention.",
      "Improved performance through frontend optimization and maintainable architecture — 40% faster load times, 25% better overall platform performance.",
    ],
    stack: ["React", "Node.js", "MongoDB", "Calendars"],
  },
  {
    id: "coditech",
    company: "Codi Tech",
    title: "Boot Camp Full-Stack Developer",
    place: "Lebanon",
    from: "02 / 2021",
    to: "08 / 2021",
    fromYear: 2021,
    toYear: 2021,
    headline:
      "Where it started — four full-stack builds, an ERP, and a medical management system.",
    bullets: [
      "Completed 4 full-stack development projects focused on solving real business and operational problems.",
      "Built an ERP system for inventory management, sales operations and customer relationship management with a team.",
      "Built an internal medical management system on the MERN stack, focused on scalability, accessibility and security.",
    ],
    stack: ["MERN", "MongoDB", "Express", "React"],
  },
];

export type SkillGroup = { label: string; index: string; items: string[] };

export const skills: SkillGroup[] = [
  {
    label: "Frontend",
    index: "01",
    items: [
      "React",
      "Next.js",
      "Vue.js",
      "Nuxt.js",
      "TypeScript",
      "JavaScript",
      "HTML5",
      "CSS3",
      "Tailwind CSS",
      "Ant Design",
    ],
  },
  {
    label: "Backend",
    index: "02",
    items: ["Node.js", "Express.js", "NestJS", "SQL", "PostgreSQL", "MongoDB"],
  },
  {
    label: "DevOps & Infra",
    index: "03",
    items: [
      "Docker",
      "CI/CD",
      "Nginx",
      "Caddy",
      "Deployments",
      "Load Balancers",
      "Server Management",
    ],
  },
  {
    label: "Architecture",
    index: "04",
    items: [
      "Frontend Architecture",
      "Software Architecture",
      "Design Patterns",
      "Responsive Design",
      "Cross-Browser",
      "Code Reviews",
      "Agile / Scrum",
    ],
  },
  {
    label: "Patterns",
    index: "05",
    items: [
      "Singleton",
      "Observer",
      "Facade",
      "Higher-Order Components",
      "+ More",
    ],
  },
  {
    label: "AI & Productivity",
    index: "06",
    items: [
      "AI-Assisted Architecture Analysis",
      "AI Dev Workflows",
      "Framework Migration Planning",
      "Custom Agents",
      "AI Skills",
      "Integrations",
    ],
  },
  {
    label: "Tooling",
    index: "07",
    items: ["Git", "GitHub", "Postman", "Jest", "Google Analytics", "Mixpanel"],
  },
  {
    label: "Leadership",
    index: "08",
    items: [
      "Technical Leadership",
      "Team Mentoring",
      "Technical Decision-Making",
      "Stakeholder Management",
      "Communication",
    ],
  },
];

/** Nodes for the ARCHITECTURE dependency graph, laid out by depth. */
export const architecture = {
  principles: [
    {
      n: "01",
      title: "Boundaries before features",
      body: "Six business modules on one codebase only works if the seams are decided first. Tenants, domains, shared primitives — draw them, then ship inside them.",
    },
    {
      n: "02",
      title: "The render path is a budget",
      body: "SSR with Nuxt 3, route-level code splitting, payload discipline. Every millisecond is spent on purpose, and measured after.",
    },
    {
      n: "03",
      title: "Patterns are communication",
      body: "Singleton, Observer, Facade, HOC — not academia. They are how three developers agree on the shape of a thing without a meeting.",
    },
    {
      n: "04",
      title: "Review is the architecture",
      body: "50+ pull requests a month. Architecture that lives only in a diagram is a wish; architecture enforced at the diff is real.",
    },
  ],
};

export const beyond = [
  {
    tag: "Community",
    title: "Google Developer Group Organizer",
    when: "2022 — Present",
    body: "Organized and supported DevFest, Google I/O Extended and university technology sessions.",
  },
  {
    tag: "Service",
    title: "Lebanese Civil Defense — Volunteer Firefighter",
    when: "2015 — Present",
    body: "Ten years on call. It recalibrates what you consider a production emergency.",
  },
  {
    tag: "Training",
    title: "Mongo Hero Program",
    when: "09 / 2023",
    body: "Backend development training on Node.js, Express.js and MongoDB under Elie Hannouch.",
  },
  {
    tag: "Discipline",
    title: "Muay Thai · Martial Arts",
    when: "Ongoing",
    body: "Camping, reading, and eight limbs. Repetition until it is instinct — same reason the code looks the way it does.",
  },
];

export const education = {
  degree: "B.Sc. Computer Science",
  school: "American University of Technology",
  years: "2017 — 2020",
  gpa: "3.2",
  extra: "INJAZ Entrepreneurship Program · 2018",
};

export const languages = [
  { name: "Arabic", level: "Native", pct: 100 },
  { name: "English", level: "Full Professional", pct: 90 },
  { name: "French", level: "Elementary", pct: 35 },
];

export type SectionId =
  | "hero"
  | "manifesto"
  | "scale"
  | "architecture"
  | "work"
  | "impact"
  | "stack"
  | "dojo"
  | "beyond"
  | "contact";

export const nav: { id: SectionId; label: string; index: string }[] = [
  { id: "hero", label: "Top", index: "00" },
  { id: "manifesto", label: "Manifesto", index: "01" },
  { id: "scale", label: "Scale", index: "02" },
  { id: "architecture", label: "Architecture", index: "03" },
  { id: "work", label: "Work", index: "04" },
  { id: "impact", label: "Impact", index: "05" },
  { id: "stack", label: "Stack", index: "06" },
  { id: "dojo", label: "The Dojo", index: "07" },
  { id: "beyond", label: "Beyond", index: "08" },
  { id: "contact", label: "Contact", index: "09" },
];
