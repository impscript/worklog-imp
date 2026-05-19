import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mcrmkyppxoityveebgex.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcm1reXBweG9pdHl2ZWViZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTQwNTAsImV4cCI6MjA5NDY5MDA1MH0.l_i-trILv4NYsUIalQEOuy4-wW7y7XZiVrhMjEQ7Mzs'
);

async function cleanupDuplicates() {
  console.log('=== Checking for duplicate users by nickname ===\n');

  // Fetch all users ordered by created_at
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, emp_id, nickname, full_name, created_at')
    .order('nickname')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Total users in DB: ${allUsers.length}`);
  console.log('All users:');
  allUsers.forEach(u => console.log(`  - [${u.created_at?.slice(0,19)}] ${u.nickname} | ${u.emp_id} | ${u.full_name} | id=${u.id}`));

  // Group by lowercase nickname
  const groups = {};
  for (const user of allUsers) {
    const key = (user.nickname || '').toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(user);
  }

  // Find duplicates
  const duplicateGroups = Object.entries(groups).filter(([, users]) => users.length > 1);
  
  if (duplicateGroups.length === 0) {
    console.log('\n✅ No duplicates found!');
    return;
  }

  console.log(`\n⚠️  Found ${duplicateGroups.length} duplicate nickname group(s):`);
  
  for (const [nickname, users] of duplicateGroups) {
    console.log(`\n  Nickname: "${nickname}" — ${users.length} records`);
    users.forEach((u, i) => console.log(`    [${i}] ${u.created_at?.slice(0,19)} | emp_id=${u.emp_id} | id=${u.id}`));
    
    // Keep the OLDEST (first created = likely the real seeded user), delete the rest
    const [keepUser, ...toDelete] = users; // sorted ascending by created_at
    console.log(`  → Keeping: id=${keepUser.id} (oldest)`);
    
    for (const dup of toDelete) {
      console.log(`  → Deleting: id=${dup.id} (duplicate)`);
      const { error: delErr } = await supabase.from('users').delete().eq('id', dup.id);
      if (delErr) {
        console.error(`    ❌ Failed to delete: ${delErr.message}`);
      } else {
        console.log(`    ✅ Deleted successfully`);
      }
    }
  }

  console.log('\n=== Cleanup complete ===');
}

cleanupDuplicates();
