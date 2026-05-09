# CAI Circle

Private vendor intelligence platform for Friends of CAI.

---

## Setup in 4 steps

### 1. Run the database schema
Open Supabase → SQL Editor, paste the contents of `schema.sql`, and click Run.

### 2. Set up environment variables
Copy `.env.example` to `.env` and fill in your values (already pre-filled in the example).

### 3. Install and run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

### 4. Deploy to Vercel
Push this folder to a GitHub repository, then:
1. Go to vercel.com → New Project → import your repo
2. Add the two environment variables from your `.env` file under Settings → Environment Variables
3. Deploy — done. You'll get a live URL to share with your group.

---

## Make yourself admin
After creating your account in the app, go to Supabase → SQL Editor and run:
```sql
update public.profiles set is_admin = true where username = 'your_username_here';
```

---

## Deploy the AI Summary feature (optional)
Requires the Supabase CLI.
```bash
npm install -g supabase
supabase login
supabase link --project-ref lktwqdgteniecauqrlgi
supabase secrets set ANTHROPIC_API_KEY=your_anthropic_secret_key_here
supabase functions deploy ai-summary
```

---

## Adding new categories
Edit `src/config/categories.js`. Instructions are written directly in that file.

## Adding new rating dimensions
Edit `src/config/categories.js` — the `RATING_DIMS` array at the bottom. Same pattern.

---

## Tech stack
- **Frontend**: React + Vite
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (username-based)
- **Map**: Leaflet + OpenStreetMap (free, no API key)
- **AI Summaries**: Anthropic Claude via Supabase Edge Function
- **Hosting**: Vercel (free)
