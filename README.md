# Student Management System

A full-stack Student Management System repository, organized as an npm-workspaces monorepo.

## Repository Structure

```text
student-management-system/
├── backend/             # NestJS API
│   ├── src/              # Application source
│   ├── test/             # End-to-end tests
│   ├── drizzle/          # Database migrations and snapshots
│   ├── .env.example      # Backend environment template
│   └── package.json
├── package.json          # Workspace configuration and root scripts
├── package-lock.json     # Shared npm lockfile
└── README.md
```

## Technology Stack

- **Backend:** NestJS, TypeScript, Node.js
- **Database:** PostgreSQL
- **ORM and migrations:** Drizzle ORM and Drizzle Kit
- **Validation and authentication:** class-validator, JWT, Argon2
- **Testing:** Vitest and Supertest
- **Package management:** npm workspaces

## Prerequisites

Install a compatible Node.js version, npm, and PostgreSQL. Use the Node.js version supported by the project's dependencies.

## Getting Started

### 1. Install dependencies

Run this command from the repository root:

```bash
npm install
```

### 2. Configure environment variables

Copy the backend environment template:

```bash
cp backend/.env.example backend/.env
```

Update `backend/.env` with your local PostgreSQL connection details and the other values required by the template.

Never commit `.env` files or real credentials.

### 3. Prepare the database

Create the PostgreSQL database configured in `DATABASE_URL`.

Review the existing Drizzle migrations before applying them. To apply migrations to the configured database:

```bash
npm run db:migrate
```

**Important:** `db:migrate` targets the database configured for the backend. Verify `DATABASE_URL` before running it, especially when using a shared or production database.

### 4. Start the backend

Development mode with automatic reload:

```bash
npm run dev:backend
```

Build the backend:

```bash
npm run build
```

Start the backend without watch mode:

```bash
npm run start:backend
```

## Available Root Commands

| Command | Purpose |
| --- | --- |
| `npm run dev:backend` | Start the backend in watch mode |
| `npm run start:backend` | Start the backend |
| `npm run build` | Build the backend |
| `npm run lint` | Lint backend source and tests |
| `npm run format` | Format backend source and tests |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run end-to-end tests against the dedicated test database |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply pending Drizzle migrations |

## Testing

Run the unit tests:

```bash
npm run test
```

Run the end-to-end tests:

```bash
npm run test:e2e
```

The root `test:e2e` script rewrites the database name in `DATABASE_URL` to `student_management_test` before launching the backend E2E suite.

Create that dedicated test database before running E2E tests. Confirm the connection points to the intended PostgreSQL server and that the test database exists.

**Never remove the E2E database safety checks or point the test suite at a development or production database.** The E2E suite may create, update, and delete records in its test database.

## Working With npm Workspaces

Run commands from the repository root whenever a root script is available. To run a command directly inside the backend workspace, use:

```bash
npm run <script> --workspace=student-management-system
```

## Version Control

Use Git to track changes. Work on a feature branch, review the diff, run the relevant checks, and commit only after verifying the changes.

## Project Status

The repository currently contains the NestJS backend, authentication and student-management functionality, PostgreSQL schema, Drizzle migrations, and unit and E2E tests. The frontend workspace has not yet been added.
