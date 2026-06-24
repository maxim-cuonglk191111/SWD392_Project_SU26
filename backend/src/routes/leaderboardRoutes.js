const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { getLeaderboard, getMyRank, getSessionHistory } = require('../controllers/leaderboardController');

router.get('/', optionalAuth, getLeaderboard);
router.get('/me', authenticate, getMyRank);
router.get('/history', authenticate, getSessionHistory);

module.exports = router;
