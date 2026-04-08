@AGENTS.md

# Orbit Sites Scaffold

A minimal Next.js starter for building customer-facing websites. Designed to be cloned into Vercel Sandboxes where AI agents modify it to build complete sites.

## Tech Stack

- **Next.js 16** — App Router, Server Components, TypeScript
- **Tailwind CSS 4** — Utility-first styling with CSS variables
- **shadcn/ui** — Initialized but no components pre-installed (add as needed)
- **ESLint** — Configured with Next.js rules

## Project Structure

```
src/
  app/
    layout.tsx      Root layout (Geist font, metadata, global styles)
    page.tsx         Home page (empty — start here)
    globals.css      Tailwind config + shadcn/ui theme variables
  components/
    ui/              shadcn/ui components (added via CLI)
  lib/
    utils.ts         cn() utility for merging Tailwind classes
```

## Conventions

1. **Server Components by default.** Only add `"use client"` when you need interactivity (event handlers, useState, useEffect, browser APIs).
2. **Use shadcn/ui** for UI primitives. Add components with:
   ```bash
   npx shadcn@latest add button card dialog input
   ```
   Import from `@/components/ui/button` etc.
3. **Tailwind for styling.** Use utility classes. Theme colors are defined as CSS variables in `globals.css` (e.g. `bg-background`, `text-foreground`, `bg-primary`).
4. **TypeScript strict mode.** All files `.ts` or `.tsx`. No `any` types.
5. **Import alias:** Use `@/` for imports from `src/`.

## Adding a Page

Create `src/app/your-page/page.tsx`:

```tsx
export default function YourPage() {
  return <div>Your content</div>;
}
```

## Adding an API Route

Create `src/app/api/your-route/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ data: "hello" });
}
```

## Adding a Dynamic Route

Create `src/app/blog/[slug]/page.tsx`:

```tsx
export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <div>{slug}</div>;
}
```

## Common Tasks

- **Site metadata** — Edit `metadata` export in `src/app/layout.tsx`
- **Global styles** — Edit `src/app/globals.css`
- **Theme colors** — Modify CSS variables in `:root` and `.dark` blocks in `globals.css`
- **Environment variables** — Add to `.env.local`, reference with `process.env.VAR_NAME`

## Dev Server

```bash
npm run dev
```

Runs on port 3000.
