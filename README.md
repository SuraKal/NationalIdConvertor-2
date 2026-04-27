# NConvert / Fayda ID Extractor

This project now uses:

- `Vite` + `React` + `TypeScript` for the frontend
- `Express` for the local API layer
- `MySQL` for persistence

## Database

The MySQL database name is `niddb_1`.

Bootstrap it with:

```sql
SOURCE server/sql/niddb_1.sql;
```

## Environment

Copy `.env.example` to `.env` and set your MySQL credentials.

Important variables:

- `MYSQL_DATABASE=niddb_1`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `JWT_SECRET`
- `VITE_API_URL=/api`

## Run locally

Install dependencies:

```sh
npm install
```

Start the API:

```sh
npm run api
```

Start the frontend:

```sh
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3001`.

## Notes

- The old Supabase-based data flow has been replaced in the app with a MySQL-backed API.
- Password reset OTPs are still returned in the API response for local development. Replace that with real email delivery before production use.
