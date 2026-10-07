import { requireUser } from "./_auth.js";
import { getPlan } from "../config.js";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const user=await requireUser(req);
    const plan=getPlan(req.body?.plan);
    if(!plan) return res.status(400).json({error:"Invalid plan."});
    const keyId=process.env.RAZORPAY_KEY_ID, keySecret=process.env.RAZORPAY_KEY_SECRET;
    if(!keyId||!keySecret) return res.status(500).json({error:"Razorpay is not configured."});
    const response=await fetch("https://api.razorpay.com/v1/orders",{
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:"Basic "+Buffer.from(keyId+":"+keySecret).toString("base64") },
      body:JSON.stringify({
        amount:plan.priceINR*100,currency:"INR",receipt:"mzsa_"+Date.now(),
        notes:{product:"MZSA AI Music",plan:req.body.plan,credits:String(plan.credits),user_id:user.id}
      })
    });
    const data=await response.json();
    if(!response.ok) return res.status(response.status).json({error:data.error?.description||"Unable to create Razorpay order."});
    return res.status(200).json({orderId:data.id,amount:data.amount,currency:data.currency,keyId});
  }catch(e){return res.status(e.status||500).json({error:e.message});}
}
