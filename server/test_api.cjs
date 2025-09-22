const fs = require('fs');
const https = require('https');

try {
  // Read the stored token
  const token = JSON.parse(fs.readFileSync('qbo_token.json', 'utf8'));
  console.log('Using realmId:', token.realmId);
  console.log('Environment:', token.environment || 'not specified');

  const url = `https://quickbooks.api.intuit.com/v3/company/${token.realmId}/reports/ProfitAndLoss?start_date=2025-06-01&end_date=2025-06-30&summarize_column_by=Days&minorversion=75`;
  console.log('URL:', url);

  const options = {
    headers: {
      'Authorization': `Bearer ${token.access_token}`,
      'Accept': 'application/json'
    }
  };

  https.get(url, options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response:');
      console.log(data);
    });
  }).on('error', (err) => {
    console.error('Error:', err);
  });

} catch (e) {
  console.error('Error reading token file:', e.message);
}
