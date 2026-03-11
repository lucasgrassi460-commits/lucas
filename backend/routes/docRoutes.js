const express = require('express');
const router = express.Router();
const docController = require('../controllers/docController');
const { verifyToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

router.use(verifyToken);

router.get('/', docController.getDocuments);
router.post('/upload', upload.single('document'), docController.uploadDocument);
router.delete('/:id', docController.deleteDocument);

module.exports = router;
