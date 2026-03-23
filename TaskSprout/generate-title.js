export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { durationSecs, timeOfDay } = req.body;

  const minutes = Math.floor(durationSecs / 60);
  const seconds = durationSecs % 60;
  const durStr  = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 40,
        messages: [{
          role: 'user',
          content: `Generate a short, creative memo title (3-5 words max, no quotes, no punctuation) for a ${durStr} voice note recorded in the ${timeOfDay}. Make it feel personal and warm, like a journal entry. Just the title, nothing else.`
        }]
      })
    });

    const data = await response.json();
    const title = data.content?.[0]?.text?.trim() || null;
    res.status(200).json({ title });
  } catch (err) {
    res.status(500).json({ title: null });
  }
}
