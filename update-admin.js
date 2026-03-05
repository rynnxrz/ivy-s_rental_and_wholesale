const { createClient } = require('@supabase/supabase-js');

async function updateAdminPassword() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) return console.error('List error:', listError);

    const existingUser = users.users.find(u => u.email === 'admin@gmail.com');

    if (!existingUser) {
        console.log('User admin@gmail.com not found. Try creating it instead.');
        return;
    }

    console.log(`Found user: ${existingUser.id}, updating password and role...`);

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: 'admin',
        email_confirm: true
    });

    if (updateError) {
        console.error('Password update error:', updateError);
        return;
    }

    // ensure admin role
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: existingUser.id, email: 'admin@gmail.com', role: 'admin' }, { onConflict: 'id' });

    if (profileError) {
        console.error('Profile role update error:', profileError);
    } else {
        console.log('Successfully updated password to "admin" and role to "admin".');
    }
}

updateAdminPassword().catch(console.error);
