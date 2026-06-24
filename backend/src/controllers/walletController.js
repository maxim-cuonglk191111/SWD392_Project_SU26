/**
 * walletController.js
 *
 * In-memory virtual wallet — prototype only.
 * Production: replace with .NET Payment Service at PAYMENT_SERVICE_URL.
 *
 * Coin denominations:
 *   1 LUCY Coin = 1 VNĐ (fixed rate for prototype)
 *
 * Endpoints:
 *   GET    /api/wallet/balance   — get current balance
 *   POST   /api/wallet/deposit   — add coins (top-up)
 *   POST   /api/wallet/transfer  — send coins to another user
 *   GET    /api/wallet/history   — transaction history
 *   GET    /api/wallet/tx/:id    — get single transaction
 */

const { v4: uuidv4 } = require('uuid');

// ─── In-memory wallet store (prototype) ──────────────────────────────────────
// wallet: Map<userId, { balance: number }>
// transactions: Array<{ id, from, to, amount, type, roomId, message, timestamp }>
const wallets = new Map();
const transactions = [];

const TX_TYPES = { DEPOSIT: 'deposit', TRANSFER: 'transfer', GIFT_SENT: 'gift_sent', GIFT_RECEIVED: 'gift_received' };

function getWallet(userId) {
  if (!wallets.has(userId)) wallets.set(userId, { balance: 100 }); // Start with 100 free coins
  return wallets.get(userId);
}

function logTx({ from, to, amount, type, roomId, message }) {
  const tx = { id: uuidv4(), from: from || null, to: to || null, amount, type, roomId: roomId || null, message: message || '', timestamp: new Date().toISOString() };
  transactions.push(tx);
  return tx;
}

// ─── GET /api/wallet/balance ─────────────────────────────────────────────────
async function getBalance(req, res) {
  const userId = req.user.uid;
  const wallet = getWallet(userId);
  return res.json({ userId, balance: wallet.balance, currency: 'LUCY' });
}

// ─── POST /api/wallet/deposit ─────────────────────────────────────────────────
async function deposit(req, res) {
  const userId = req.user.uid;
  const { amount, paymentMethod } = req.body;

  const n = parseInt(amount);
  if (!n || n <= 0) return res.status(400).json({ error: 'amount must be a positive integer' });

  const wallet = getWallet(userId);
  wallet.balance += n;

  const tx = logTx({ from: 'SYSTEM', to: userId, amount: n, type: TX_TYPES.DEPOSIT, message: `Deposit via ${paymentMethod || 'manual'}` });

  console.log(`[Wallet] Deposit: ${userId} +${n} → balance ${wallet.balance}`);

  return res.json({
    userId,
    balance: wallet.balance,
    deposited: n,
    txId: tx.id,
    message: `Successfully deposited ${n} LUCY coins`,
  });
}

// ─── POST /api/wallet/transfer ─────────────────────────────────────────────────
async function transfer(req, res) {
  const fromId = req.user.uid;
  const { toUserId, amount, message } = req.body;

  const n = parseInt(amount);
  if (!n || n <= 0) return res.status(400).json({ error: 'amount must be a positive integer' });
  if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
  if (fromId === toUserId) return res.status(400).json({ error: 'Cannot transfer to yourself' });

  const fromWallet = getWallet(fromId);
  if (fromWallet.balance < n) {
    return res.status(400).json({ error: `Insufficient balance. Current: ${fromWallet.balance}` });
  }

  const toWallet = getWallet(toUserId);

  fromWallet.balance -= n;
  toWallet.balance += n;

  const tx = logTx({ from: fromId, to: toUserId, amount: n, type: TX_TYPES.TRANSFER, message: message || '' });

  console.log(`[Wallet] Transfer: ${fromId} → ${toUserId} (-${n}) | remaining: ${fromWallet.balance}`);

  return res.json({
    txId: tx.id,
    fromId,
    toUserId,
    amount: n,
    fromBalance: fromWallet.balance,
    toBalance: toWallet.balance,
    message: `Transferred ${n} coins to ${toUserId}`,
  });
}

// ─── GET /api/wallet/history ───────────────────────────────────────────────────
async function getHistory(req, res) {
  const userId = req.user.uid;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const userTxs = transactions
    .filter(tx => tx.from === userId || tx.to === userId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(offset, offset + limit);

  return res.json({ userId, total: userTxs.length, txs: userTxs });
}

// ─── GET /api/wallet/tx/:id ────────────────────────────────────────────────────
async function getTx(req, res) {
  const tx = transactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  const userId = req.user.uid;
  if (tx.from !== userId && tx.to !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  return res.json(tx);
}

// ─── Internal: deduct coins (called by socket handler for gift) ────────────────
function deductCoins(userId, amount) {
  const wallet = getWallet(userId);
  if (wallet.balance < amount) return false;
  wallet.balance -= amount;
  return true;
}

// ─── Internal: add coins (called by socket handler for gift receipt) ──────────
function addCoins(userId, amount) {
  const wallet = getWallet(userId);
  wallet.balance += amount;
}

module.exports = { getBalance, deposit, transfer, getHistory, getTx, deductCoins, addCoins };
