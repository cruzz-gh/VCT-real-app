export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const sources = [
    'https://vlrggapi.vercel.app/match?q=results',
    'https://vlr.orlandomm.net/api/v1/results'
  ];

  for (const url of sources) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) continue;

      const json = await response.json();
      const rawMatches = json.data?.segments || json.data || json.segments || (Array.isArray(json) ? json : []);

      if (Array.isArray(rawMatches) && rawMatches.length > 0) {
        const matches = [];

        for (const m of rawMatches) {
          if (matches.length >= 10) break;

          const teams = m.teams || [];
          const t1 = teams[0] || {};
          const t2 = teams[1] || {};

          const team1 = t1.name || m.team1 || 'TBD';
          const team2 = t2.name || m.team2 || 'TBD';

          let s1 = parseInt(t1.score ?? m.score1 ?? 0, 10);
          let s2 = parseInt(t2.score ?? m.score2 ?? 0, 10);

          // Extract score if provided as string e.g. "2-1"
          if ((isNaN(s1) || isNaN(s2)) && typeof m.score === 'string') {
            const parts = m.score.split('-').map(p => parseInt(p.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              s1 = parts[0];
              s2 = parts[1];
            }
          }

          if (isNaN(s1)) s1 = 0;
          if (isNaN(s2)) s2 = 0;

          // Determine winner dynamically
          let winnerIdx = -1;
          if (t1.is_winner || s1 > s2) winnerIdx = 0;
          else if (t2.is_winner || s2 > s1) winnerIdx = 1;

          matches.push({
            tournament: m.tournament || m.event || 'VCT MATCH',
            team1,
            team2,
            s1,
            s2,
            winnerIdx
          });
        }

        if (matches.length > 0) {
          return res.status(200).json({ success: true, matches });
        }
      }
    } catch (err) {
      console.warn(`Failed fetching from ${url}:`, err.message);
    }
  }

  // Fallback: Fetch directly from VLR's RSS feed if third-party REST APIs are down
  try {
    const rssRes = await fetch('https://www.vlr.gg/rss');
    if (rssRes.ok) {
      const xmlText = await rssRes.text();
      const matches = [];
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xmlText)) !== null && matches.length < 10) {
        const title = match[1].replace('<![CDATA[', '').replace(']]>', '').trim();
        // Format: "TeamA vs TeamB (ScoreA-ScoreB)"
        const matchData = title.match(/(.*?)\s+vs\s+(.*?)\s+\((\d+)-(\d+)\)/i);
        if (matchData) {
          const [, team1, team2, s1Str, s2Str] = matchData;
          const s1 = parseInt(s1Str, 10);
          const s2 = parseInt(s2Str, 10);
          
          matches.push({
            tournament: 'VCT MATCH',
            team1: team1.trim(),
            team2: team2.trim(),
            s1,
            s2,
            winnerIdx: s1 > s2 ? 0 : (s2 > s1 ? 1 : -1)
          });
        }
      }

      if (matches.length > 0) {
        return res.status(200).json({ success: true, matches });
      }
    }
  } catch (err) {
    console.error('RSS fetch error:', err.message);
  }

  return res.status(500).json({ success: false, error: 'All dynamic sources failed.' });
}
