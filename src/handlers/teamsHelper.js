const axios = require('axios');

async function fetchTeams(appsScriptUrl) {
  const res = await axios.get(`${appsScriptUrl}?page=bot`);
  const settings = res.data;
  
  const teamsRes = await axios.get(`${appsScriptUrl}?page=teams_data`);
  const teams = JSON.parse(teamsRes.data);
  
  const teamMap = {};
  teams.forEach(t => {
    teamMap[t[0]] = {
      name: t[0],
      id1: t[1],
      id2: t[2],
      id3: t[3]
    };
  });
  
  return teamMap;
}

module.exports = { fetchTeams };