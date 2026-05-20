import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://zdertmpzervgjicuwsfz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZXJ0bXB6ZXJ2Z2ppY3V3c2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDY2MjgsImV4cCI6MjA5NDc4MjYyOH0.GZlAp8JYUCAOFqLt2sv4gqXtgVy1MsqxKwuIgzf8Flc'
);

async function run() {
  const { data, error } = await supabase.from('users').upsert({
    phone: '8885490495',
    pass: 'Mystore@karthi@2025',
    role: 'admin',
    name: 'Super Admin',
    status: 'active',
    subscription: 'active'
  }, { onConflict: 'phone' });

  if (error) {
    console.error('Error inserting admin:', error.message);
  } else {
    console.log('Successfully injected admin account!');
  }
}
run();
