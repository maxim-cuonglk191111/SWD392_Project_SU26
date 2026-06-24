const router = require('express').Router();
const { getLanguages, getLanguageContent, getLevel, getStage, searchContent, getAiSuggestions } = require('../controllers/lmsController');

router.get('/languages', getLanguages);
router.get('/content/:language', getLanguageContent);
router.get('/level/:language/:level', getLevel);
router.get('/stage/:language/:stageIndex', getStage);
router.get('/search', searchContent);
router.get('/ai-suggestions/:language/:level', getAiSuggestions);

module.exports = router;
