export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const response = await fetch('https://vlrggapi.vercel.app/match?q=results', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream API returned status ${response.status}`);
    }

    const json = await response.json();
    const rawMatches = json.data?.segments || json.data || json.segments || [];

    const matches = rawMatches.slice(0, 10).map(m => {
      const teams = m.teams || [];
      const t1 = teams[0] || {};
      const t2 = teams[1] || {};

      const team1 = t1.name || m.team1 || 'TBD';
      const team2 = t2.name || m.team2 || 'TBD';

      // Parse score integers cleanly
      let s1 = parseInt(t1.score ?? m.score1 ?? 0, 10);
      let s2 = parseInt(t2.score ?? m.score2 ?? 0, 10);

      // Determine winner directly from live map scores
      let winnerIdx = -1;
      if (t1.is_winner || s1 > s2) winnerIdx = 0;
      else if (t2.is_winner || s2 > s1) winnerIdx = 1;

      return {
        tournament: m.tournament || m.event || 'VCT MATCH',
        team1,
        team2,
        s1,
        s2,
        winnerIdx
      };
    });

    return res.status(200).json({ success: true, matches });
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch live matches.' });
  }
}
