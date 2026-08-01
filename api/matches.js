export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Fetch VLR's live results HTML directly
    const response = await fetch('https://www.vlr.gg/matches/results', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`VLR responded with status ${response.status}`);
    }

    const html = await response.text();
    const matches = [];

    // Regex to capture match cards from VLR.gg HTML
    const cardRegex = /<a[^>]*class="[^"]*match-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let cardMatch;

    while ((cardMatch = cardRegex.exec(html)) !== null && matches.length < 10) {
      const cardHtml = cardMatch[1];

      // Extract Tournament / Event
      const eventMatch = cardHtml.match(/class="match-item-event-series[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                         cardHtml.match(/class="match-item-event[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      let tournament = eventMatch ? eventMatch[1].replace(/<[^>]+>/g, '').trim() : 'VCT MATCH';
      tournament = tournament.replace(/\s+/g, ' ');

      // Extract Team Names
      const teamMatches = [...cardHtml.matchAll(/class="match-item-vs-team-name[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
      const team1 = teamMatches[0] ? teamMatches[0][1].replace(/<[^>]+>/g, '').trim() : null;
      const team2 = teamMatches[1] ? teamMatches[1][1].replace(/<[^>]+>/g, '').trim() : null;

      // Extract Scores
      const scoreMatches = [...cardHtml.matchAll(/class="match-item-vs-team-score[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
      const s1Raw = scoreMatches[0] ? scoreMatches[0][1].replace(/<[^>]+>/g, '').trim() : null;
      const s2Raw = scoreMatches[1] ? scoreMatches[1][1].replace(/<[^>]+>/g, '').trim() : null;

      const s1 = parseInt(s1Raw, 10);
      const s2 = parseInt(s2Raw, 10);

      if (team1 && team2 && !isNaN(s1) && !isNaN(s2)) {
        // Determine winner index based on score
        let winnerIdx = -1;
        if (s1 > s2) winnerIdx = 0;
        else if (s2 > s1) winnerIdx = 1;

        matches.push({
          tournament: tournament.toUpperCase(),
          team1,
          team2,
          s1,
          s2,
          winnerIdx
        });
      }
    }

    if (matches.length > 0) {
      return res.status(200).json({ success: true, matches });
    }

    throw new Error('No valid matches parsed from HTML.');

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
