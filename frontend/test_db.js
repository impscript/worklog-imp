import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mcrmkyppxoityveebgex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcm1reXBweG9pdHl2ZWViZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTQwNTAsImV4cCI6MjA5NDY5MDA1MH0.l_i-trILv4NYsUIalQEOuy4-wW7y7XZiVrhMjEQ7Mzs'
);

async function run() {
  console.log('Testing tb_map_user_role table...');
  const { data, error } = await supabase.from('tb_map_user_role').select('name');
  if (error) {
    console.error('Error:', error);
  } else {
    const names = [...new Set(data.map(d => d.name))];
    console.log('Unique names in tb_map_user_role:', names);
  }
}

run();
