const URL = 'https://ocawmakqzoegzjbkmvrm.supabase.co/rest/v1/holidays?select=*';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYXdtYWtxem9lZ3pqYmttdnJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NjM5ODEsImV4cCI6MjA4MzQzOTk4MX0.lTNAVqwukbLuURqTj72PiXJK4k3HQtKicAE8KbiAWL4';

async function main() {
  try {
    const res = await fetch(URL, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.statusText}`);
    }
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching old holidays:', err);
  }
}

main();
