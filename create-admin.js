async function createAdmin() {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase credentials in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log('Creating/Updating user admin@gmail.com...');

    // 1. Create or update user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'admin@gmail.com',
        password: 'admin',
        email_confirm: true,
    });

    let userId;
    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('User already exists, updating password...');
            // Try to find the user id first
            const { data: users, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) {
                console.error('Error listing users:', listError);
                return;
            }
            const existingUser = users.users.find(u => u.email === 'admin@gmail.com');

            if (existingUser) {
                userId = existingUser.id;
                const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
                    password: 'admin',
                    email_confirm: true
                });
                if (updateError) {
                    console.error('Error updating password:', updateError);
                    return;
                }
                console.log('Password updated.');
            } else {
                console.error('User registered but could not be found.');
                return;
            }
        } else {
            console.error('Error creating user:', authError);
            return;
        }
    } else {
        userId = authData.user.id;
        console.log('User created successfully. ID:', userId);
    }

    // Wait a moment for the profile trigger to potentially fire
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Ensure profile exists and has role = 'admin'
    console.log('Updating profile role to admin...');
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, email: 'admin@gmail.com', role: 'admin' }, { onConflict: 'id' });

    if (profileError) {
        console.error('Error updating profile role:', profileError);
    } else {
        console.log('Profile updated successfully! You can now log in.');
    }
}

createAdmin().catch(console.error);
