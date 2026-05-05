import https from 'https';

const data = JSON.stringify({
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'test' }]
});

const options = {
  hostname: 'api.venice.ai',
  port: 443,
  path: '/api/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(res.statusCode, body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
