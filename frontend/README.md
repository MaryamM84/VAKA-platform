# VAKA Frontend

The frontend of the VAKA platform is built with Next.js, TypeScript, Tailwind CSS, and ESLint.

## Prerequisites

- Node.js and npm
- Git

## Getting Started

From the repository root, navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Validation

Run ESLint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## Environment Configuration

The initial frontend setup does not require any custom environment variables.

If environment variables are introduced in future development, document their names and purposes here. Do not commit secrets, credentials, or private environment files to Git.

## Project Structure

- `src/app/` — App Router pages and application layout
- `public/` — Static assets
- `package.json` — Dependencies and npm scripts
- `tsconfig.json` — TypeScript configuration

## Development Notes

Use a dedicated feature branch for each task. Submit changes through a Pull Request and follow the team's review process before merging into `main`.