// Supabase initialization + helpers
// 1) In Supabase → Project Settings → API, copy your Project URL and anon public key
// 2) Paste below, then commit. No secret keys in the frontend!


export const SUPABASE_URL = "https://rftldqrwsvgexfqjeayh.supabase.co"; // <-- paste
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmdGxkcXJ3c3ZnZXhmcWplYXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3OTI3MTEsImV4cCI6MjA3NDM2ODcxMX0.w1Q-N8CFUsMvMquGShexzJhofmfmmG9VmeB7-7jXlw4"; // <-- paste


export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);


export async function ensureAnonAuth() {
const { data: { user } } = await supabase.auth.getUser();
if (user) return user;
const { data, error } = await supabase.auth.signInAnonymously();
if (error) throw error;
return data.user;
}


export function shortAnon(id) {
return `anon-${String(id).slice(0,2)}${String(id).slice(-1).toUpperCase()}`;
}