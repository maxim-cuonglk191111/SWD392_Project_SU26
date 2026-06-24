const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { startRecording, stopRecording, listPodcasts, getUserPodcasts, getPodcast, likePodcast, purchasePodcast, searchPodcasts } = require('../controllers/podcastController');

router.get('/', listPodcasts);
router.get('/search', searchPodcasts);
router.get('/:id', getPodcast);
router.get('/user/:userId', getUserPodcasts);
router.post('/start', authenticate, startRecording);
router.post('/stop', authenticate, stopRecording);
router.post('/:id/like', authenticate, likePodcast);
router.post('/:id/purchase', authenticate, purchasePodcast);

module.exports = router;
