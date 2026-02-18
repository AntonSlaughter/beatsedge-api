require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const Stripe = require("stripe");

const app = express();

/* =================================================
   ENV
================================================= */

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

/* =================================================
   STRIPE INIT (only if key exists)
================================================= */

let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

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
   JSON PARSER
================================================= */

app.use(express.json());

/* =================================================
   AUTH ROUTES
================================================= */

app.post("/api/auth/register", async (req, res) => {
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
   AUTH MIDDLEWARE (kept for later)
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

/* =================================================
   STRIPE CHECKOUT (Optional – still protected)
================================================= */

app.post("/api/stripe/create-checkout", authenticateUser, async (req, res) => {
  if (!stripe)
    return res.status(500).json({ error: "Stripe not configured" });

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
});

/* =================================================
   EV ENGINE
================================================= */

function calculateEV(prob, americanOdds) {
  let implied;

  if (americanOdds < 0)
    implied = Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  else
    implied = 100 / (americanOdds + 100);

  const decimal =
    americanOdds < 0
      ? 100 / Math.abs(americanOdds)
      : americanOdds / 100;

  const ev = (prob * decimal) - (1 - prob);

  return {
    impliedProbability: +(implied * 100).toFixed(1),
    expectedValue: +ev.toFixed(3)
  };
}

/* =================================================
   EDGES ROUTE (OPEN FOR TESTING)
================================================= */

app.get("/api/edges/premium", (req, res) => {

  const vegasOdds = -110;
  const probability = 0.55;

  const ev = calculateEV(probability, vegasOdds);

  const samplePlay = {
    player: "Sample Player",
    stat: "Points",
    line: 24.5,
    direction: "OVER",
    probability: 55,
    vegasOdds,
    impliedProbability: ev.impliedProbability,
    expectedValue: ev.expectedValue
  };

  res.json({
    bestThree: [samplePlay],
    players: [samplePlay]
  });
});

/* =================================================
   HEALTH CHECK
================================================= */

app.get("/", (req, res) => {
  res.json({ status: "BeatsEdge API live" });
});

/* =================================================
   START SERVER
================================================= */

app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge running on port ${PORT}`);
});
