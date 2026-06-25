import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../models/client';
import { authenticate, requireRole } from '../middleware/auth';
import { config } from '../config';
import { parseDocx, parsePdf } from '../services/documentParser';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.docx', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .docx and .pdf files are supported'));
  },
});

// Upload document
router.post('/upload', authenticate, requireRole('PRO', 'SUPER'), upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileType = ext === '.docx' ? 'docx' : 'pdf';
  const language = req.body.language || 'EN';

  try {
    // Save document record
    const document = await prisma.uploadedDocument.create({
      data: {
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileType,
        language,
        uploadedBy: req.user!.userId,
        status: 'PENDING',
      },
    });

    // Auto-parse the document
    let parseResult;
    if (fileType === 'docx') {
      parseResult = await parseDocx(req.file.path, req.file.originalname);
    } else {
      parseResult = await parsePdf(req.file.path, req.file.originalname);
    }

    if (parseResult.success) {
      // Save parsed levels
      for (const level of parseResult.levels) {
        await prisma.level.create({
          data: {
            language,
            stage: detectStageFromNumber(level.levelNumber),
            levelNumber: level.levelNumber,
            title: level.title,
            titleZh: level.titleZh,
            titleJp: level.titleJp,
            description: level.description,
            duration: level.duration,
            subLevels: JSON.stringify(level.subLevels),
          },
        });
      }

      await prisma.uploadedDocument.update({
        where: { id: document.id },
        data: { parsedLevels: JSON.stringify(parseResult.levels), status: 'PARSED' },
      });

      res.status(201).json({
        document: { ...document, parsedLevels: parseResult.levels },
        levelsCreated: parseResult.levels.length,
        parseErrors: parseResult.errors,
      });
    } else {
      await prisma.uploadedDocument.update({
        where: { id: document.id },
        data: { status: 'FAILED', parsedLevels: JSON.stringify({ errors: parseResult.errors }) },
      });
      res.status(201).json({ document, parseErrors: parseResult.errors, warning: 'Document saved but parsing failed' });
    }
  } catch (err: any) {
    console.error('[Document Upload]', err);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

// Helper
function detectStageFromNumber(levelNumber: number): string {
  if (levelNumber <= 30) return 'BEGINNER';
  if (levelNumber <= 60) return 'INTERMEDIATE';
  return 'ADVANCED';
}

// List documents
router.get('/', authenticate, async (req: Request, res: Response) => {
  const documents = await prisma.uploadedDocument.findMany({
    where: { uploadedBy: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ documents });
});

// Get document detail
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const document = await prisma.uploadedDocument.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: 'Document not found' });
  if (document.uploadedBy !== req.user!.userId && req.user!.role === 'LUCY') {
    return res.status(403).json({ error: 'Access denied' });
  }

  let parsedLevels: any[] = [];
  try { parsedLevels = JSON.parse(document.parsedLevels); } catch { /* ignore */ }

  res.json({ document: { ...document, parsedLevels } });
});

// Re-parse document
router.get('/:id/parse', authenticate, requireRole('PRO', 'SUPER'), async (req: Request, res: Response) => {
  const document = await prisma.uploadedDocument.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: 'Document not found' });
  if (document.uploadedBy !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

  if (!fs.existsSync(document.filePath)) {
    return res.status(400).json({ error: 'File no longer exists on server' });
  }

  let parseResult;
  if (document.fileType === 'docx') {
    parseResult = await parseDocx(document.filePath, document.originalName);
  } else {
    parseResult = await parsePdf(document.filePath, document.originalName);
  }

  await prisma.uploadedDocument.update({
    where: { id: document.id },
    data: {
      parsedLevels: JSON.stringify(parseResult.levels),
      status: parseResult.success ? 'PARSED' : 'FAILED',
    },
  });

  res.json({ success: parseResult.success, levels: parseResult.levels, errors: parseResult.errors });
});

// Delete document
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const document = await prisma.uploadedDocument.findUnique({ where: { id: req.params.id } });
  if (!document) return res.status(404).json({ error: 'Document not found' });
  if (document.uploadedBy !== req.user!.userId) return res.status(403).json({ error: 'Access denied' });

  // Delete file
  if (fs.existsSync(document.filePath)) {
    fs.unlinkSync(document.filePath);
  }

  await prisma.uploadedDocument.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
