import express from 'express';
import multer from 'multer';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import s3, { S3_BUCKET_NAME } from '../config/s3.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WEBP and PDF files are allowed.'));
    }
  },
});

const allowedFolders = [
  'player-photos',
  'tournament-images',
  'team-logos',
  'certificates',
];

/**
 * GET /api/uploads/file/<folder>/<file>
 * Public read endpoint for uploaded images. The upload API stores only the S3
 * key (e.g. "tournament-images/<uuid>.jpg"); browsers cannot load a bare key,
 * so the frontend requests it here and the server streams it from the
 * (private) S3 bucket. Only the allowed folders can be read.
 */
router.get(/^\/file\/(.+)$/, async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params[0] || '');
    const [folder, ...rest] = key.split('/');

    if (
      !allowedFolders.includes(folder) ||
      rest.length !== 1 ||
      !/^[A-Za-z0-9._-]+$/.test(rest[0]) ||
      rest[0].includes('..')
    ) {
      return res.status(400).json({ success: false, message: 'Invalid file key.' });
    }

    const object = await s3.send(
      new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key })
    );

    res.setHeader('Content-Type', object.ContentType || 'application/octet-stream');
    if (object.ContentLength) res.setHeader('Content-Length', object.ContentLength);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    object.Body.pipe(res);
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    next(error);
  }
});

router.post('/', protect, upload.single('file'), async (req, res, next) => {

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a file.',
      });
    }

    const folder = req.body.folder;

    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid upload folder.',
      });
    }

    const extension = req.file.originalname
      .split('.')
      .pop()
      .toLowerCase();

    const key = `${folder}/${randomUUID()}.${extension}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      key,
      bucket: S3_BUCKET_NAME,
    });
  } catch (error) {
    next(error);
  }
});

export default router;