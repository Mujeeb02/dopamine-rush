const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://jeghkvlxzmewjwihsvma.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplZ2hrdmx4em1ld2p3aWhzdm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NDYyODksImV4cCI6MjA2NzUyMjI4OX0.93pQBY0vmeROY3gc3RFvO4gE_t8Qt52Xa81AsLRU78E";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function debugLeaderboard() {
  console.log('🔍 Debugging Leaderboard Database Connection...\n');
  
  try {
    // Test 1: Basic connection test
    console.log('1️⃣ Testing basic connection...');
    const { data: testData, error: testError } = await supabase
      .from('game_scores')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection failed:', testError);
      return;
    }
    console.log('✅ Connection successful\n');
    
    // Test 2: Check if table exists and has data
    console.log('2️⃣ Checking game_scores table...');
    const { data: scores, error: scoresError } = await supabase
      .from('game_scores')
      .select('*')
      .limit(10);
    
    if (scoresError) {
      console.error('❌ Error fetching scores:', scoresError);
      return;
    }
    
    console.log(`📊 Found ${scores.length} scores in database`);
    if (scores.length > 0) {
      console.log('Sample score:', scores[0]);
    } else {
      console.log('⚠️  No scores found - this might be the issue!');
    }
    console.log('');
    
    // Test 3: Check profiles table
    console.log('3️⃣ Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }
    
    console.log(`👥 Found ${profiles.length} profiles in database`);
    if (profiles.length > 0) {
      console.log('Sample profile:', profiles[0]);
    }
    console.log('');
    
    // Test 4: Test the exact query from Leaderboard component
    console.log('4️⃣ Testing exact Leaderboard query...');
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('game_scores')
      .select('*')
      .order('score', { ascending: false });
    
    if (leaderboardError) {
      console.error('❌ Error in leaderboard query:', leaderboardError);
      return;
    }
    
    console.log(`🏆 Leaderboard query returned ${leaderboardData.length} scores`);
    if (leaderboardData.length > 0) {
      console.log('Top score:', leaderboardData[0]);
    }
    console.log('');
    
    // Test 5: Check RLS policies
    console.log('5️⃣ Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'game_scores' })
      .catch(() => ({ data: null, error: 'RPC not available' }));
    
    if (policiesError) {
      console.log('ℹ️  Could not check RLS policies via RPC');
    } else if (policies) {
      console.log('RLS Policies:', policies);
    }
    
    console.log('\n🎯 Summary:');
    if (scores.length === 0) {
      console.log('❌ No data in database - you need to play the game and score points first!');
      console.log('💡 Try playing the game and scoring some points, then check again.');
    } else {
      console.log('✅ Database has data - the issue might be in the frontend code');
      console.log('💡 Check the browser console for any JavaScript errors');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

debugLeaderboard(); 