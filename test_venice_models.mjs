import https from 'https';

const options = {
  hostname: 'api.venice.ai',
  port: 443,
  path: '/api/v1/models',
  method: 'GET'
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const textModels = parsed.data.filter(m => m.id.includes('llama') || m.type === 'text' || !m.id.includes('image')).map(m => m.id);
      console.log("Model IDs:", parsed.data.map(m=>m.id).join(", "));
    } catch(e) { console.error(e); }
  });
});

req.end();
