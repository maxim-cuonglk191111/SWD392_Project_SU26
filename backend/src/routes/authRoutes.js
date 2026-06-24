const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { register, login, anonymousLogin, getProfile, updateProfile, logout } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/login/anonymous', anonymousLogin);          // POST /api/auth/login/anonymous (kept for backward compat)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/logout', authenticate, logout);

module.exports = router;
