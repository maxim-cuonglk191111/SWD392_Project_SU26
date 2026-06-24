const router = require('express').Router();
const { authenticate } = require('../middleware/authMiddleware');
const { getBalance, deposit, transfer, getHistory, getTx } = require('../controllers/walletController');

router.get('/balance', authenticate, getBalance);
router.post('/deposit', authenticate, deposit);
router.post('/transfer', authenticate, transfer);
router.get('/history', authenticate, getHistory);
router.get('/tx/:id', authenticate, getTx);

module.exports = router;
