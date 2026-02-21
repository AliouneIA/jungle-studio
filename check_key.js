
const https = require('https');

const url = 'https://xrhcaskiudkszbrhuisu.supabase.co/functions/v1/fusion-run';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyaGNhc2tpdWRrc3picmh1aXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTczNDgsImV4cCI6MjA4NjA3MzM0OH0.zjCPDhz0ndX7FucPZNEF64e8lXsL07AXhDR-7K3qAnY';

const data = JSON.stringify({
    prompt: 'test',
    model_slugs: ['gpt-5.2-pro']
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
    }
};

const req = https.request(url, options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    let parts = [];
    res.on('data', (chunk) => parts.push(chunk));
    res.on('end', () => {
        const body = Buffer.concat(parts).toString();
        console.log('Response Body:', body);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
