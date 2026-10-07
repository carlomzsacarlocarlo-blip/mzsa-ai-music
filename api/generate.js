import { requireUser, dbFetch } from "./_auth.js";

export const maxDuration = 60;

const allowedGenres=["Pop","Afro Pop","Afrobeats","R&B","Hip-Hop","Rap","Gospel","Worship","Rock","Indie","Electronic","Cinematic","Lo-fi","Acoustic","Reggae","Dance","Country","Soul","Jazz"];
const allowedMoods=["Inspirational","Happy","Sad","Romantic","Energetic","Chill","Dark","Emotional","Epic","Peaceful","Hopeful"];

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  let user, reservation;
  try{
    user=await requireUser(req);
    const body=req.body||{};
    const lyrics=String(body.lyrics||"").trim();
    const genre=String(body.genre||"Pop").trim();
    const mood=String(body.mood||"Inspirational").trim();
    const vocals=String(body.vocals||"Female").trim();
    const language=String(body.language||"English").trim();
    const structure=String(body.structure||"Auto").trim();
    const tempo=String(body.tempo||"").trim();
    const energy=String(body.energy||"").trim();
    const durationMs=Math.min(5*60*1000,Math.max(2*60*1000,Number(body.durationMs)||3*60*1000));

    if(!lyrics) return res.status(400).json({error:"Please enter lyrics or an idea."});
    if(!allowedGenres.includes(genre)) return res.status(400).json({error:"Unsupported genre."});
    if(!allowedMoods.includes(mood)) return res.status(400).json({error:"Unsupported mood."});
    if(lyrics.length>12000) return res.status(400).json({error:"Lyrics or idea is too long."});

    const reserved=await dbFetch("/rest/v1/rpc/reserve_generation","POST",{p_user_id:user.id});
    reservation=reserved?.source;
    if(!reservation) return res.status(500).json({error:"Could not reserve a generation."});

    const apiKey=process.env.ELEVENLABS_API_KEY;
    if(!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured in Vercel.");

    const prompt=[
      "Create a complete original song.",
      "Genre: "+genre,
      "Mood: "+mood,
      "Language: "+language,
      "Vocals: "+vocals,
      "Structure: "+structure,
      tempo ? "Tempo: "+tempo : "",
      energy ? "Energy: "+energy : "",
      "Use the user's lyrics or idea as the creative basis.",
      "Create a cohesive melody, rhythm, bass, harmony, appropriate instrumentation, expressive vocals when enabled, and polished production.",
      lyrics
    ].filter(Boolean).join("\n");

    const response=await fetch("https://api.elevenlabs.io/v1/music",{
      method:"POST",
      headers:{"Content-Type":"application/json","xi-api-key":apiKey},
      body:JSON.stringify({
        prompt,
        model_id:"music_v2_5",
        music_length_ms:durationMs,
        output_format:"mp3_48000_192",
        force_instrumental:vocals==="Instrumental"
      })
    });

    if(!response.ok){
      const errorText=await response.text();
      let message=errorText;
      try{const parsed=JSON.parse(errorText);message=parsed.detail?.message||parsed.detail||parsed.message||errorText;}catch(_){}
      throw new Error("ElevenLabs error: "+message);
    }

    const audioBuffer=Buffer.from(await response.arrayBuffer());
    await dbFetch("/rest/v1/generations","POST",[{
      user_id:user.id,credits_used:1,source:reservation,status:"completed"
    }],{Prefer:"return=minimal"});

    res.setHeader("Content-Type","audio/mpeg");
    res.setHeader("Content-Disposition",'inline; filename="mzsa-ai-song.mp3"');
    res.setHeader("Cache-Control","no-store");
    return res.status(200).send(audioBuffer);
  }catch(e){
    if(user?.id && reservation){
      try{await dbFetch("/rest/v1/rpc/restore_generation","POST",{p_user_id:user.id,p_source:reservation});}catch(_){}
    }
    const status=e.message==="NO_CREDITS"?402:(e.status||500);
    return res.status(status).json({error:e.message==="NO_CREDITS"?"You've used all available generations. Choose a plan to continue.":e.message||"Music generation failed."});
  }
}
