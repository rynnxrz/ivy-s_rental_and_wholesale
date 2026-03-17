void (async () => {
    const https = await import('node:https');

    https.get('https://bfizqdyngujjdmaaoggg.supabase.co/rest/v1/', (res) => {
        console.log('Status Code:', res.statusCode);
        res.on('data', (d) => {
            process.stdout.write(d);
        });
    }).on('error', (e) => {
        console.error('HTTPS Error:', e);
    });
})();
