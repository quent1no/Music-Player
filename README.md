# Shared Music Player — GitHub Pages + Supabase


A no-server, real-time shared music library and player. Host the static site on **GitHub Pages**; use **Supabase** for Auth, Database (Postgres + Realtime), and Storage.


## What you’ll set up
- Supabase project (free tier)
- Anonymous Auth
- Storage bucket `uploads` (public read; authed write)
- Tables: `tracks`, `state` (optional sync), `presence` (optional online count)
- Row-Level Security policies (copy-paste provided)


---


## 1) Create a Supabase project
- Go to https://supabase.com → **New project** (free tier)
- Note **Project URL** and **anon public key** (Settings → API)


## 2) Enable Anonymous Auth
- Dashboard → **Authentication → Providers → Anonymous** → **Enable**


## 3) Create a Storage bucket
- Dashboard → **Storage → Create bucket**: name `uploads` (Private is fine — policies expose reads)


## 4) Create tables & policies
- Dashboard → **SQL Editor** → paste the contents of `supabase.sql` → **Run**
- This will: create `tracks`, `state`, `presence`; enable RLS; add policies; and open storage policies.


## 5) Add your keys to the frontend
Open `assets/supabase.js` and paste your values:


```js
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const SUPABASE_ANON = "YOUR_ANON_PUBLIC_KEY";
