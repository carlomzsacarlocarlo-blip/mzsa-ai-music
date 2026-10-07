import crypto from "crypto";
import { requireUser, dbFetch } from "./_auth.js";
import { getPlan } from "../config.js";

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{
    const user=await requireUser(req);
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body||{};
    if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature) return res.status(400).json({error:"Missing payment details."});

    const secret=process.env.RAZORPAY_KEY_SECRET, keyId=process.env.RAZORPAY_KEY_ID;
    if(!secret||!keyId) return res.status(500).json({error:"Razorpay is not configured."});

    const expected=crypto.createHmac("sha256",secret).update(razorpay_order_id+"|"+razorpay_payment_id).digest("hex");
    if(expected.length!==String(razorpay_signature).length || !crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(razorpay_signature)))){
      return res.status(400).json({success:false,error:"Payment verification failed."});
    }

    const auth=Buffer.from(keyId+":"+secret).toString("base64");
    const orderResponse=await fetch("https://api.razorpay.com/v1/orders/"+encodeURIComponent(razorpay_order_id),{
      headers:{Authorization:"Basic "+auth}
    });
    const order=await orderResponse.json();
    if(!orderResponse.ok) return res.status(400).json({error:"Could not confirm Razorpay order."});
    if(order.notes?.user_id!==user.id) return res.status(403).json({error:"Payment does not belong to this account."});

    const plan=getPlan(order.notes?.plan);
    if(!plan || Number(order.amount)!==plan.priceINR*100) return res.status(400).json({error:"Payment amount or plan mismatch."});

    const processed=await dbFetch("/rest/v1/rpc/process_verified_payment","POST",{
      p_user_id:user.id,
      p_order_id:razorpay_order_id,
      p_payment_id:razorpay_payment_id,
      p_amount:plan.priceINR,
      p_plan:plan.name,
      p_credits:plan.credits
    });
    return res.status(200).json({success:true,alreadyProcessed:processed?.processed===false,plan:plan.name,credits:plan.credits});
    return res.status(200).json({success:true,plan:plan.name,credits:plan.credits});
  }catch(e){return res.status(e.status||500).json({success:false,error:e.message||"Payment verification failed."});}
}
