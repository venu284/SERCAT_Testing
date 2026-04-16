# SERCAT UI

SERCAT scheduling app with a Vite React frontend and serverless `/api` backend.

## Local Run

The scheduling engine now runs on the server API. To test the real algorithm, do not run plain Vite by itself.

```bash
cd /Users/venu/Documents/SERCAT_Testing/SERCAT_Testing
npm install
npm run db:push
npm run db:seed
npx vercel dev
```

Open:

```text
http://localhost:3000
```

Default seeded admin login:

```text
Email: admin@sercat.org
Password: Admin@123
```

## Verification

Run the repo verification stack with:

```bash
npm run check
```

## Notes

- `npm run dev` starts only the Vite frontend. It is useful for UI-only work, but it will not exercise the server scheduling APIs.
- Browser local state storage was versioned after the server-scheduling migration. If you were testing an older build, the app now starts from a clean local snapshot automatically.
- Email delivery requires valid environment variables in `.env.local`.
