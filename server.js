require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const Stripe = require("stripe");

const app = express();

/* =================================================
   ENV VALIDATION
================================================= */

const {
  PORT = 8080,
  JWT_SECRET,
  STRIPE_SECRET_KEY,
  STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET
} = process.env;

if (!JWT_SECRET) throw new Error("JWT_SECRET missing");
if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
if (!STRIPE_PRICE_ID) throw new Error("STRIPE_PRICE_ID missing");
if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET missing");

const stripe = new Stripe(STRIPE_SECRET_KEY);

/* =================================================
   DATABASE
================================================= */

const db = new sqlite3.Database("./beatsedge.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      subscription TEXT DEFAULT 'free',
      stripe_customer_id TEXT
    )
  `);
});

/* =================================================
   STRIPE WEBHOOK (RAW BODY REQUIRED)
================================================= */

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      db.run(
        `UPDATE users SET subscription = 'premium'
         WHERE stripe_customer_id = ?`,
        [session.customer]
      );

      console.log("User upgraded to premium");
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;

      db.run(
        `UPDATE users SET subscription = 'free'
         WHERE stripe_customer_id = ?`,
        [subscription.customer]
      );

      console.log("User downgraded to free");
    }

    res.json({ received: true });
  }
);

/* =================================================
   JSON PARSER (AFTER WEBHOOK)
================================================= */

app.use(express.json());

/* =================================================
   AUTH ROUTES
================================================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const hashed = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (email, password) VALUES (?, ?)`,
      [email, hashed],
      function (err) {
        if (err)
          return res.status(400).json({ error: "User already exists" });

        const token = jwt.sign(
          { id: this.lastID, email },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.json({
          message: "User registered",
          token
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE email = ?`,
    [email],
    async (err, user) => {
      if (!user)
        return res.status(400).json({ error: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password);
      if (!match)
        return res.status(400).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ token });
    }
  );
});

/* =================================================
   AUTH MIDDLEWARE
================================================= */

function authenticateUser(req, res, next) {
  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({ error: "No token provided" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    db.get(
      `SELECT * FROM users WHERE id = ?`,
      [decoded.id],
      (err, user) => {
        if (!user)
          return res.status(401).json({ error: "User not found" });

        req.user = user;
        next();
      }
    );
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
}

function requirePremium(req, res, next) {
  if (req.user.subscription !== "premium")
    return res.status(403).json({ error: "Premium required" });

  next();
}

/* =================================================
   STRIPE CHECKOUT
================================================= */

app.post(
  "/api/stripe/create-checkout",
  authenticateUser,
  async (req, res) => {
    try {
      let customerId = req.user.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user.email
        });

        customerId = customer.id;

        db.run(
          `UPDATE users SET stripe_customer_id = ? WHERE id = ?`,
          [customerId, req.user.id]
        );
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url:
          "https://beatsedge-api-production-9337.up.railway.app/success",
        cancel_url:
          "https://beatsedge-api-production-9337.up.railway.app/cancel"
      });

      res.json({ url: session.url });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Stripe checkout failed" });
    }
  }
);

/* =================================================
   PREMIUM EV ROUTE
================================================= */

app.get(
  "/api/edges/premium",
  authenticateUser,
  (req, res) => {

    const samplePlay = {
      player: "Sample Player",
      stat: "Points",
      line: 24.5,
      direction: "OVER",
      probability: 55,
      vegasOdds: -110,
      impliedProbability: 52.4,
      expectedValue: 0.048
    };

    res.json({
      bestThree: [samplePlay],
      players: [samplePlay]
    });
  }
);

/* =================================================
   START SERVER
================================================= */

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge running on port ${PORT}`);
});
