export const PLANS = {
  basic: { name: "Basic", priceINR: 30, credits: Number(process.env.BASIC_CREDITS || 3) },
  pro: { name: "Pro", priceINR: 88, credits: Number(process.env.PRO_CREDITS || 15) },
  ultra: { name: "Ultra Max Pro", priceINR: 1000, credits: Number(process.env.ULTRA_CREDITS || 200) }
};
export function getPlan(plan) { return PLANS[String(plan || "").toLowerCase()] || null; }
