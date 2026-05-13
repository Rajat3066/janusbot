const axios = require('axios');
axios.get('https://floating-refuse-style-joyce.trycloudflare.com/api/v1/tournaments/JH22/teams', {
  headers: { 
    'Authorization': 'Token e3257e092bfe8c9e3cbc27431fbbde4af085e53e',
    'Accept': 'application/json'
  }
}).then(r => console.log('success', JSON.stringify(r.data))).catch(e => console.log('error', e.message));