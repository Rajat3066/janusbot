const axios = require('axios');

async function fetchDraw(tabbycatUrl, token, tournamentSlug, roundNumber) {
  const headers = { Authorization: `Token ${token}` };
  const base = `${tabbycatUrl}/api/v1/tournaments/${tournamentSlug}`;

  const [pairingsRes, teamsRes, venuesRes, motionsRes] = await Promise.all([
    axios.get(`${base}/rounds/${roundNumber}/pairings`, { headers }),
    axios.get(`${base}/teams`, { headers }),
    axios.get(`${base}/venues`, { headers }),
    axios.get(`${base}/motions`, { headers }),
  ]);

  const teamMap = {};
  teamsRes.data.forEach(t => { teamMap[t.url] = t.long_name; });

  const venueMap = {};
  venuesRes.data.forEach(v => { venueMap[v.url] = v.name; });

  const motions = motionsRes.data
    .filter(m => m.rounds.some(r => r.round.includes(`/rounds/${roundNumber}`)))
    .sort((a, b) => {
      const aSeq = a.rounds.find(r => r.round.includes(`/rounds/${roundNumber}`))?.seq || 0;
      const bSeq = b.rounds.find(r => r.round.includes(`/rounds/${roundNumber}`))?.seq || 0;
      return aSeq - bSeq;
    })
    .map(m => ({
      text: m.text,
      reference: m.reference,
      info_slide: m.info_slide_plain
    }));

  const draw = pairingsRes.data.map(pairing => {
    const gov = pairing.teams.find(t => t.side === 'aff');
    const opp = pairing.teams.find(t => t.side === 'neg');
    return {
      room: venueMap[pairing.venue] || `Room ${pairing.id}`,
      gov: teamMap[gov.team] || 'Unknown',
      opp: teamMap[opp.team] || 'Unknown',
    };
  });

  return { draw, motions };
}

module.exports = { fetchDraw };