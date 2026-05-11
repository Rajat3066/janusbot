const axios = require('axios');

async function fetchDraw(tabbycatUrl, token, tournamentSlug, roundNumber) {
  const headers = { Authorization: `Token ${token}` };
  const base = `${tabbycatUrl}/api/v1/tournaments/${tournamentSlug}`;

  const [pairingsRes, teamsRes, venuesRes] = await Promise.all([
    axios.get(`${base}/rounds/${roundNumber}/pairings`, { headers }),
    axios.get(`${base}/teams`, { headers }),
    axios.get(`${base}/venues`, { headers }),
  ]);

  const teamMap = {};
  teamsRes.data.forEach(t => {
    teamMap[t.url] = t.long_name;
  });

  const venueMap = {};
  venuesRes.data.forEach(v => {
    venueMap[v.url] = v.name;
  });

  const draw = pairingsRes.data.map(pairing => {
    const gov = pairing.teams.find(t => t.side === 'aff');
    const opp = pairing.teams.find(t => t.side === 'neg');
    return {
      room: venueMap[pairing.venue] || `Room ${pairing.id}`,
      gov: teamMap[gov.team] || 'Unknown',
      opp: teamMap[opp.team] || 'Unknown',
    };
  });

  return draw;
}

module.exports = { fetchDraw };