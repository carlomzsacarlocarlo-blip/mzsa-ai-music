export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({
      error: "Razorpay keys are not configured."
    });
  }

  try {
    const amount = 4900; // ₹49 in paise

    const auth = Buffer.from(
      keyId + ":" + keySecret
    ).toString("base64");

    const response = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + auth
        },
        body: JSON.stringify({
          amount: amount,
          currency: "INR",
          receipt: "mzsa_" + Date.now(),
          notes: {
            product: "MZSA AI Music - 1 Song"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.description || "Unable to create Razorpay order."
      });
    }

    return res.status(200).json({
  orderId: data.id,
  amount: data.amount,
  currency: data.currency,
  keyId: keyId
});

  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Order creation failed."
    });
  }
        }
