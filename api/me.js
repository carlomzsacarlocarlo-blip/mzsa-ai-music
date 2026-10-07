import { requireUser, dbFetch } from "./_auth.js";
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await requireUser(req);
    const rows = await dbFetch("/rest/v1/users?id=eq." + encodeURIComponent(user.id) + "&select=id,email,name,plan,free_generations_total,free_generations_used,paid_credits,created_at&limit=1");
    const profile = rows?.[0] || { id:user.id,email:user.email,plan:"free",free_generations_total:3,free_generations_used:0,paid_credits:0 };
    return res.status(200).json({
      user:{id:user.id,email:user.email,name:profile.name || user.user_metadata?.name || ""},
      profile,
      freeRemaining:Math.max(0,Number(profile.free_generations_total || 3)-Number(profile.free_generations_used || 0))
    });
  } catch (e) { return res.status(e.status || 500).json({ error:e.message }); }
}
