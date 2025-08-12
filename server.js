const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// In-memory storage for positions )
let positions = [];
let balance = 10000;

// Mock forex rates
const mockRates = {
  "EUR/USD": 1.085,
  "GBP/USD": 1.265,
  "USD/JPY": 148.5,
  "USD/CHF": 0.875,
  "AUD/USD": 0.658,
  "USD/CAD": 1.352,
  "NZD/USD": 0.612,
  "EUR/GBP": 0.858,
  "EUR/JPY": 161.2,
  "GBP/JPY": 187.9,
};

// Helper function to get current rate with slight variation
function getCurrentRate(pair) {
  const baseRate = mockRates[pair];
  if (!baseRate) return null;

  // Add small random variation (-0.1% to +0.1%)
  const variation = (Math.random() - 0.5) * 0.002;
  return baseRate * (1 + variation);
}

// AI Analysis function (mock - integrate with real AI service)
function analyzeForexPair(pair, prompt) {
  const currentRate = getCurrentRate(pair);

  // Mock analysis based on common patterns
  const analyses = [
    {
      sentiment: "bullish",
      confidence: 75,
      reasoning: `Technical indicators show strong upward momentum for ${pair}. RSI indicates oversold conditions with potential for reversal.`,
      recommendation: "BUY",
      targetPrice: currentRate * 1.02,
      stopLoss: currentRate * 0.98,
    },
    {
      sentiment: "bearish",
      confidence: 68,
      reasoning: `Market sentiment suggests downward pressure on ${pair}. Economic indicators point to potential weakness.`,
      recommendation: "SELL",
      targetPrice: currentRate * 0.98,
      stopLoss: currentRate * 1.02,
    },
    {
      sentiment: "neutral",
      confidence: 45,
      reasoning: `Mixed signals for ${pair}. Market consolidation expected with sideways movement.`,
      recommendation: "HOLD",
      targetPrice: currentRate,
      stopLoss: currentRate * 0.99,
    },
  ];

  // Select analysis based on prompt keywords
  let selectedAnalysis;
  if (
    prompt.toLowerCase().includes("buy") ||
    prompt.toLowerCase().includes("bullish")
  ) {
    selectedAnalysis = analyses[0];
  } else if (
    prompt.toLowerCase().includes("sell") ||
    prompt.toLowerCase().includes("bearish")
  ) {
    selectedAnalysis = analyses[1];
  } else {
    selectedAnalysis = analyses[Math.floor(Math.random() * analyses.length)];
  }

  return {
    pair,
    currentPrice: currentRate,
    analysis: selectedAnalysis,
    timestamp: new Date().toISOString(),
  };
}

// Routes

// Get current forex rates
app.get("/api/rates", (req, res) => {
  const rates = {};
  Object.keys(mockRates).forEach((pair) => {
    rates[pair] = getCurrentRate(pair);
  });

  res.json({
    rates,
    timestamp: new Date().toISOString(),
  });
});

// Get specific rate
app.get("/api/rates/:pair", (req, res) => {
  const pair = req.params.pair.toUpperCase();
  const rate = getCurrentRate(pair);

  if (!rate) {
    return res.status(404).json({ error: "Currency pair not found" });
  }

  res.json({
    pair,
    rate,
    timestamp: new Date().toISOString(),
  });
});

// Analyze currency pair with AI
app.post("/api/analyze", (req, res) => {
  const { pair, prompt } = req.body;

  if (!pair || !prompt) {
    return res
      .status(400)
      .json({ error: "Currency pair and prompt are required" });
  }

  const normalizedPair = pair.toUpperCase();
  if (!mockRates[normalizedPair]) {
    return res.status(404).json({ error: "Currency pair not supported" });
  }

  const analysis = analyzeForexPair(normalizedPair, prompt);
  res.json(analysis);
});

// Execute trade (simulation)
app.post("/api/trade", (req, res) => {
  const { pair, action, amount, leverage = 1 } = req.body;

  if (!pair || !action || !amount) {
    return res
      .status(400)
      .json({ error: "Pair, action, and amount are required" });
  }

  const normalizedPair = pair.toUpperCase();
  const currentRate = getCurrentRate(normalizedPair);

  if (!currentRate) {
    return res.status(404).json({ error: "Currency pair not found" });
  }

  if (action !== "BUY" && action !== "SELL") {
    return res.status(400).json({ error: "Action must be BUY or SELL" });
  }

  const requiredMargin = (amount * currentRate) / leverage;

  if (requiredMargin > balance) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const position = {
    id: uuidv4(),
    pair: normalizedPair,
    action,
    amount,
    leverage,
    openPrice: currentRate,
    openTime: new Date().toISOString(),
    status: "OPEN",
    requiredMargin,
  };

  positions.push(position);
  balance -= requiredMargin;

  res.json({
    message: "Position executed successfully",
    position,
    remainingBalance: balance,
  });
});

// Get all positions
app.get("/api/positions", (req, res) => {
  const positionsWithPnL = positions.map((position) => {
    const currentRate = getCurrentRate(position.pair);
    let pnl = 0;

    if (position.status === "OPEN" && currentRate) {
      const priceDiff =
        position.action === "BUY"
          ? currentRate - position.openPrice
          : position.openPrice - currentRate;
      pnl = priceDiff * position.amount * position.leverage;
    }

    return {
      ...position,
      currentPrice: currentRate,
      pnl: Math.round(pnl * 100) / 100,
    };
  });

  res.json({
    positions: positionsWithPnL,
    balance,
    totalPnL:
      Math.round(
        positionsWithPnL.reduce((sum, pos) => sum + pos.pnl, 0) * 100
      ) / 100,
  });
});

// Close position
app.post("/api/positions/:id/close", (req, res) => {
  const positionId = req.params.id;
  const positionIndex = positions.findIndex((p) => p.id === positionId);

  if (positionIndex === -1) {
    return res.status(404).json({ error: "Position not found" });
  }

  const position = positions[positionIndex];
  if (position.status !== "OPEN") {
    return res.status(400).json({ error: "Position is already closed" });
  }

  const currentRate = getCurrentRate(position.pair);
  const priceDiff =
    position.action === "BUY"
      ? currentRate - position.openPrice
      : position.openPrice - currentRate;
  const pnl = priceDiff * position.amount * position.leverage;

  position.status = "CLOSED";
  position.closePrice = currentRate;
  position.closeTime = new Date().toISOString();
  position.pnl = Math.round(pnl * 100) / 100;

  balance += position.requiredMargin + position.pnl;

  res.json({
    message: "Position closed successfully",
    position,
    newBalance: balance,
  });
});

// Get account info
app.get("/api/account", (req, res) => {
  const openPositions = positions.filter((p) => p.status === "OPEN");
  const totalPnL = openPositions.reduce((sum, position) => {
    const currentRate = getCurrentRate(position.pair);
    const priceDiff =
      position.action === "BUY"
        ? currentRate - position.openPrice
        : position.openPrice - currentRate;
    return sum + priceDiff * position.amount * position.leverage;
  }, 0);

  res.json({
    balance,
    equity: balance + totalPnL,
    totalPnL: Math.round(totalPnL * 100) / 100,
    openPositions: openPositions.length,
    usedMargin: openPositions.reduce((sum, pos) => sum + pos.requiredMargin, 0),
  });
});

app.listen(PORT, () => {
  console.log(`Forex Trading API running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} for the frontend`);
});
