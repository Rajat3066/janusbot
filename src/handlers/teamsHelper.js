const axios = require('axios');

async function fetchTeams(appsScriptUrl) {
  const res = await axios.get(`${appsScriptUrl}?page=teams_data`, {
    maxRedirects: 5,
    headers: { 'Accept': 'application/json' }
  });
  
  let teams;
  if (typeof res.data === 'string') {
    teams = JSON.parse(res.data);
  } else {
    teams = res.data;
  }

  const teamMap = {};
  teams.forEach(t => {
    if (t[0]) {
      teamMap[t[0]] = {
        name: t[0],
        id1: t[1],
        id2: t[2],
        id3: t[3]
      };
    }
  });

  return teamMap;
}

module.exports = { fetchTeams };