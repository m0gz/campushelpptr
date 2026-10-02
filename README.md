# CampusHelp

CampusHelp is a functional React/Vite academic prototype for the university Department of Information Technology. It includes role-based demo authentication, shared localStorage-backed ticket data, and a Postgres-backed API for production-style ticket workflows.

## Run locally

```bash
npm install
npm run dev
```

## Production deployment

This project runs as a full-stack Node app. The backend is in `server/index.js` and serves the built frontend from `dist/` when present.

The deployment must start the server, not only run the frontend build:

```bash
npm install
npm run build
npm start
```

Required environment variables:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/campushelp
SESSION_SECRET=your-production-secret
NODE_ENV=production
```

If you use Neon/Postgres hosting, set `DATABASE_URL` to your Neon connection string. The app automatically enables SSL when the hostname contains `neon`.

Demo accounts:

- User: `user` / `user123`
- IT Staff: `itstaff` / `staff123`
- Administrator: `admin` / `admin123`

This prototype intentionally uses browser localStorage for persistence. It is not production authentication or a production data store.

