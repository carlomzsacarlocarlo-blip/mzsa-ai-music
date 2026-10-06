export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ELEVENLABS_API_KEY is not configured in Vercel."
    });
  }

  try {
    const body = req.body || {};

    const lyrics = String(body.lyrics || "").trim();
    const genre = String(body.genre || "Pop").trim();
    const mood = String(body.mood || "Inspirational").trim();

    if (!lyrics) {
      return res.status(400).json({
        error: "Please enter lyrics or an idea."
      });
    }

    const prompt =
      "Create a complete original song. " +
      "Genre: " + genre + ". " +
      "Mood: " + mood + ". " +
      "Use expressive lead vocals, professional modern production, " +
      "clear melody, drums, bass, harmony, and instrumentation " +
      "appropriate for the genre. " +
      "Use these user-provided lyrics or idea as the creative basis: " +
      lyrics;

    const response = await fetch(
      "https://api.elevenlabs.io/v1/music",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          prompt: prompt,
          model_id: "music_v2_5",
          music_length_ms: 60000,
          output_format: "mp3_48000_192",
          force_instrumental: false
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      let message = errorText;

      try {
        const parsed = JSON.parse(errorText);
        message =
          parsed.detail?.message ||
          parsed.detail ||
          parsed.message ||
          errorText;
      } catch (_) {}

      return res.status(response.status).json({
        error: "ElevenLabs error: " + message
      });
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="mzsa-ai-song.mp3"'
    );
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(audioBuffer);

  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Music generation failed."
    });
  }
      }
