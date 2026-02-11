const https = require('https');

const url = 'https://drako-base-3.pages.dev/api/health';

console.log(`Checking ${url}...`);

const req = https.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    if (res.statusCode === 200) {
        console.log('✅ Health Check Passed');
        process.exit(0);
    } else {
        console.log(`❌ Health Check Failed: ${res.statusCode}`);
        process.exit(1);
    }
});

req.on('error', (e) => {
    console.error(`❌ Connection Error: ${e.message}`);
    process.exit(1);
});

req.end();
