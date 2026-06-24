const router = require('express').Router();
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { listRooms, getRoom, createRoom } = require('../controllers/roomController');

router.get('/', optionalAuth, listRooms);
router.get('/:roomId', optionalAuth, getRoom);
router.post('/', authenticate, createRoom);

module.exports = router;
