export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const url=process.env.SUPABASE_URL, anon=process.env.SUPABASE_ANON_KEY, razorpay=process.env.RAZORPAY_KEY_ID;
  if(!url||!anon||!razorpay) return res.status(500).json({error:"Public configuration is incomplete."});
  return res.status(200).json({supabaseUrl:url,supabaseAnonKey:anon,razorpayKeyId:razorpay});
}
