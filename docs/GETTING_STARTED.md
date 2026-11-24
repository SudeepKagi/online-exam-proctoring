# Getting Started with ProctorNet

This guide helps you set up ProctorNet for local development and testing.

## Prerequisites

Before starting, install the following software on your computer:

- **Node.js**: Version 22.0.0 or higher.
- **PostgreSQL**: Version 15 or higher.
- **Redis**: Version 7 or higher.
- **Git**: For version control.

## Installation Steps

### 1. Clone the Repository
Clone the codebase and navigate into the project directory:

```bash
git clone https://github.com/SudeepKagi/online-exam-proctoring.git
cd online-exam-proctoring
```

### 2. Configure Environment Variables
Copy the sample environment configuration file:

```bash
cp .env.example .env
```

Open `.env` and verify your local PostgreSQL and Redis connection URLs. For local testing, cloud storage and facial matching fallback to deterministic development drivers automatically.

### 3. Install Dependencies
Install all required Node.js packages across backend and frontend workspaces:

```bash
npm install
```

### 4. Apply Database Migrations
Initialize your database schema using Prisma:

```bash
npm run db:migrate
```

### 5. Seed Initial Data
Seed the default administrator account into your database:

```bash
npm run db:seed
```

### 6. Start the Development Servers
Start both the backend API server and frontend development server concurrently:

```bash
npm run dev
```

The application opens at `http://localhost:5173`. The backend API runs at `http://localhost:5000`.

## Seeded Accounts for Testing

After seeding, the database contains standard test accounts for each role:

| Role | Email |
| :--- | :--- |
| **Admin** | `admin@proctornet.local` |
| **Faculty** | `faculty@proctornet.local` |
| **Invigilator** | `invigilator@proctornet.local` |
| **Student** | `student@proctornet.local` |

Passwords for local seeded accounts are configured in your `.env` file.

## Common Next Steps

- Explore the [User Guide](USER_GUIDE.md) to learn role workflows.
- Read the [Architecture Guide](ARCHITECTURE.md) to understand backend services.
- Review [Testing Instructions](TESTING.md) to run automated test suites.
