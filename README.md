# Student Management System

A full-stack academic management platform for managing students, instructors, courses, enrollments, assessments, grades, attendance, and academic activities through role-specific workspaces.

Built with **NestJS, React, TypeScript, PostgreSQL, and Drizzle ORM**, with a focus on maintainable architecture, secure authentication, automated testing, and a modern user experience.

## Overview

The Student Management System provides a centralized platform for academic administration, instructor workflows, and student activities.

The application uses a workspace-based monorepo, keeping the backend and frontend in one repository while maintaining separate application packages.

### Key Features

- **Authentication and authorization** — JWT-based authentication and role-based access control.
- **Student management** — student profiles and administrative management.
- **Instructor management** — instructor records and department associations.
- **Department management** — organize academic departments.
- **Course management** — manage courses and course offerings.
- **Enrollment management** — manage student course enrollments.
- **Semester management** — organize academic periods.
- **Assessments and grading** — manage assessments, grades, and academic results.
- **Assignments and quizzes** — support assignment workflows, quiz management, submissions, and grading.
- **Attendance management** — support attendance-related academic workflows.
- **Role-specific workspaces** — dedicated experiences for administrators, instructors, and students.
- **Registration approval** — pending registrations can be reviewed and approved by administrators.
- **Responsive interface** — a modern interface designed for desktop and mobile layouts.
- **Theme preferences** — System, Light, and Dark modes.

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | Component-based user interface |
| TypeScript | Static typing |
| Vite | Development server and build tooling |
| Tailwind CSS | Utility-first styling |
| Base UI / shadcn tooling | UI component foundation and development |
| Lucide React | Icons |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| NestJS | Backend application framework |
| TypeScript | Typed application development |
| PostgreSQL | Relational database |
| Drizzle ORM | Database queries and schema management |
| JWT | Authentication |
| Argon2 | Password hashing |
| Vitest | Automated testing |

### Development and Tooling

- npm workspaces for monorepo management
- Drizzle Kit for database migrations
- Oxlint for linting
- Git and GitHub for version control

## Architecture

```text
student-management-system/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   └── modules/
│   ├── drizzle/
│   ├── test/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
├── package.json
└── package-lock.json
```

The backend is organized into feature modules, while the frontend separates pages, reusable components, contexts, hooks, and API communication.

> The directory tree above shows the main structure; individual files and additional modules may vary as the project evolves.

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js version compatible with the project
- npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/ysfhawarydev/learning-management-system.git
cd learning-management-system
```

### 2. Install dependencies

Install dependencies for the npm-workspaces monorepo from the repository root:

```bash
npm install
```

### 3. Configure environment variables

Configure the backend environment using the environment example supplied with the project.

At minimum, the backend needs a PostgreSQL connection string:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/student_management
PORT=3000
```

Replace the example database credentials with your own local PostgreSQL credentials.

**Important:** Preserve any additional environment variables required by the backend configuration, including the JWT signing secret. Use the project's environment example as the source of truth for their exact names.

Never commit `.env` files, production secrets, or database credentials to Git.

### 4. Create the database

Create a PostgreSQL database named:

```text
student_management
```

Make sure the configured database user has the permissions required to run migrations and access the database.

### 5. Apply database migrations

From the repository root, run:

```bash
npm run db:migrate
```

This applies the existing Drizzle migrations to the configured database.

Use the migration generation command when making schema changes:

```bash
npm run db:generate
```

Review generated migrations before applying them.

### 6. Start the applications

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in a separate terminal:

```bash
npm run dev:frontend
```

Configure the frontend API URL if necessary:

```dotenv
VITE_API_URL=http://localhost:3000
```

The frontend defaults to `http://localhost:3000` when `VITE_API_URL` is not specified.

Open the local URL printed by Vite in your terminal.

## Available Commands

Run these commands from the repository root.

| Command | Description |
|---|---|
| `npm run dev:backend` | Start the NestJS development server |
| `npm run start:backend` | Start the backend |
| `npm run dev:frontend` | Start the Vite development server |
| `npm run build` | Build the backend |
| `npm run build:frontend` | Type-check and build the frontend |
| `npm run lint` | Lint the backend |
| `npm run lint:frontend` | Lint the frontend |
| `npm run test` | Run backend unit tests |
| `npm run test:e2e` | Run backend end-to-end tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply database migrations |

For the final verification, run:

```bash
npm run lint
npm run lint:frontend
npm test
npm run test:e2e
npm run build
npm run build:frontend
```

**Testing note:** End-to-end tests use a separate database named `student_management_test`. Configure the test database before running them, and never point destructive test setup at your development or production database.

## Authentication and Authorization

The backend implements JWT authentication and role-based authorization.

Supported roles include:

- **Administrator** — administrative management of academic resources.
- **Instructor** — instructor-oriented teaching and assessment workflows.
- **Student** — student-facing academic activities and personal records.

New registrations may remain pending until administrator approval.

Protected backend endpoints enforce authentication and role requirements independently of frontend navigation. Hiding a page in the frontend is not a substitute for backend authorization.

## Database

PostgreSQL stores the application's academic and account data. Drizzle ORM provides typed database access and schema management.

The data model includes:

- Users and roles
- Student profiles
- Instructor profiles
- Departments
- Courses and course offerings
- Semesters
- Enrollments
- Assessments and grades
- Assignments, quizzes, and related submissions
- Attendance records

The database schema and migration history are maintained in the backend workspace.

## Project Status

The project is under active development.

The backend includes authentication, authorization, academic management modules, and automated unit and end-to-end tests. The frontend provides role-specific workspaces and academic management screens, with additional refinement and integration work continuing as the project evolves.

## Future Improvements

Potential areas for further development include:

- Production deployment and environment configuration
- Expanded reporting and academic analytics
- Additional automated frontend tests
- Accessibility and performance improvements
- Further refinement of academic workflows
- Continuous integration and deployment automation

These are planned improvement areas, not claims that every item is already implemented.

## Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make focused changes.
4. Run the relevant lint checks, tests, and builds.
5. Open a pull request describing the changes.

## Security

- Never commit credentials, API secrets, or private environment files.
- Use strong, unique secrets in production.
- Use a separate PostgreSQL database for automated tests.
- Keep dependencies updated and review security advisories.
- Enforce permissions on the backend for all protected operations.
- Configure production CORS and database access according to the deployment environment.

## License

No license has been specified yet. All rights are reserved by default unless a license is added to the repository.

---

**Developed by Youssef Elhawary**

GitHub: [@ysfhawarydev](https://github.com/ysfhawarydev)
