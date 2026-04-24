# SERCAT UI

SERCAT scheduling app with a Vite React frontend and serverless `/api` backend.

## Local Run

The scheduling engine now runs on the server API. To test the real algorithm, do not run plain Vite by itself.

```bash
cd /Users/venu/Documents/sercat/SERCAT
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

## Preview Env Contract

Preview and local serverless runs expect these variables with no extra spaces around `=`:

```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
JWT_SECRET=<64-char-hex>
BREVO_API_KEY=<brevo-api-key>
APP_URL=https://your-preview-url.vercel.app
CRON_SECRET=<32-char-hex>
EMAIL_FROM=scheduler@sercat.org
EMAIL_REPLY_TO=admin@sercat.org
```

`APP_URL` must include `https://`. The runtime now trims surrounding whitespace, but Vercel and `.env.local` should still store clean values.

## Preview Smoke Test

After updating Preview env vars and redeploying:

1. Open `/api/health` and confirm it returns `200`.
2. Open `/api/auth/me` in a logged-out browser and confirm it returns `401`, not a function crash.
3. Log in with the seeded admin account.
4. Trigger one email flow, such as creating a PI invite or requesting a password reset.

## Notes

- `npm run dev` starts only the Vite frontend. It is useful for UI-only work, but it will not exercise the server scheduling APIs.
- Browser local state storage was versioned after the server-scheduling migration. If you were testing an older build, the app now starts from a clean local snapshot automatically.
- Email delivery requires valid Brevo environment variables in `.env.local` or Vercel.
