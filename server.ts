/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db } from './src/dbService';
import { sendDiscordNotification, sendTelegramNotification } from './src/notificationService';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tiktok-moderation-secret-987654321';

app.use(express.json());

// Extend Express Request interface to host user context
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
  };
}

// Security Middleware: JWT Authentication
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'عذراً، يجب تسجيل الدخول للوصول لهذا القسم' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'جلسة العمل منتهية أو غير صالحة، يرجى إعادة تسجيل الدخول' });
    }
    req.user = user;
    next();
  });
}

// Role Guard Middleware
function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح بالوصول' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'عذراً، لا تمتلك الصلاحيات الكافية لتنفيذ هذا الإجراء' });
    }
    next();
  };
}

// Server Sent Events (SSE) Client Connections Hub
let sseClients: Response[] = [];

function broadcastEvent(eventName: string, data: any) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (e) {
      console.error('Failed to notify client, removing...', e);
    }
  });
}

// --- API Endpoints ---

// Real-time Event Stream Endpoint
app.get('/api/events/live', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Content-Encoding', 'none');
  res.flushHeaders();

  sseClients.push(res);

  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients = sseClients.filter((client) => client !== res);
  });
});

// Authentication: Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, password, name, code } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'يرجى تقديم كافة البيانات المطلوبة' });
  }

  const existingUser = db.getUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
  }

  // Determine role based on validation invitation code
  let role: 'ADMIN' | 'MODERATOR' | 'MEMBER' = 'MEMBER';
  if (code === 'ADMIN-TITAN') {
    role = 'ADMIN';
  } else if (code === 'MOD-SHIELD') {
    role = 'MODERATOR';
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  try {
    const user = db.createUser(email, passwordHash, name, role);
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authentication: Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'عذراً، يرجى إدخال البريد الإلكتروني وكلمة المرور' });
  }

  const userRecord = db.getUserByEmail(email);
  if (!userRecord) {
    return res.status(401).json({ error: 'بيانات الاعتماد التي أدخلتها غير صالحة' });
  }

  const isPasswordValid = bcrypt.compareSync(password, userRecord.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'بيانات الاعتماد التي أدخلتها غير صالحة' });
  }

  const token = jwt.sign(
    { id: userRecord.id, email: userRecord.email, name: userRecord.name, role: userRecord.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password: _, ...user } = userRecord;
  res.json({ user, token });
});

// Authentication: Get Current Account Profile
app.get('/api/auth/me', authenticateToken, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'غير متصل' });
  }
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'لم يتم العثور على حسابك' });
  }
  res.json({ user });
});

// Dashboard Statistics Overview
app.get('/api/dashboard/stats', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const stats = db.getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Team members (Admin/Moderator only)
app.get('/api/users', authenticateToken, requireRole(['ADMIN', 'MODERATOR']), (req: AuthRequest, res: Response) => {
  try {
    const users = db.getUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Reports
app.get('/api/reports', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const reports = db.getReports();
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Single Report Details (including comments & history action logs)
app.get('/api/reports/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  const report = db.getReportById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'الحالة المطلوبة غير موجودة' });
  }

  const comments = db.getComments(report.id);
  const actions = db.getActions(report.id);

  res.json({ report, comments, actions });
});

// Create a New TikTok Report
app.post('/api/reports', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { tiktokLink, violationType, description, evidenceUrl } = req.body;

  if (!tiktokLink || !violationType || !description) {
    return res.status(400).json({ error: 'يرجى استكمال الحقول المطلوبة (رابط تيك توك، نوع المخالفة، الوصف)' });
  }

  // Double check tiktok URL signature (ensure user compliance)
  if (!tiktokLink.includes('tiktok.com')) {
    return res.status(400).json({ error: 'يرجى إدخال رابط حقيقي وصالح من منصة TikTok' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح' });
  }

  try {
    const report = db.createReport(
      tiktokLink,
      violationType,
      description,
      req.user.id,
      req.user.name,
      evidenceUrl
    );

    // Create action log
    db.createAction(
      report.id,
      req.user.id,
      req.user.name,
      req.user.role,
      'CREATED',
      `تم تسجيل حالة المخالفة للرابط المذكور بنجاح.`
    );

    // Fetch integration settings and trigger notifications
    const settings = db.getSettings();
    
    // Non-blocking async webhook delivery
    sendDiscordNotification(report, settings).catch(err => console.error('Discord hook failure:', err));
    sendTelegramNotification(report, settings).catch(err => console.error('Telegram API failure:', err));

    // Broadcast SSE event
    broadcastEvent('NEW_REPORT', {
      reportId: report.id,
      violationType: report.violationType,
      creatorName: report.userName,
      message: `🚨 بلاغ جديد نشط حول مخالفة: [${report.violationType}]`
    });

    res.status(201).json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Log custom user action on a specific report (e.g. viewed, clicked "Report Now")
app.post('/api/reports/:id/action', authenticateToken, (req: AuthRequest, res: Response) => {
  const { type, details } = req.body;
  const reportId = req.params.id;

  const report = db.getReportById(reportId);
  if (!report) {
    return res.status(404).json({ error: 'الحالة غير موجودة' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح' });
  }

  try {
    const action = db.createAction(
      reportId,
      req.user.id,
      req.user.name,
      req.user.role,
      type,
      details
    );

    broadcastEvent('ACTION_LOGGED', {
      reportId,
      actionType: type,
      userName: req.user.name,
      message: `👤 ${req.user.name} قام بتأكيد إجراء: ${type === 'CLICKED_REPORT' ? 'تقديم بلاغ رسمي' : 'معاينة الحالة'}`
    });

    res.json(action);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Report Status (Admin and Moderator only)
app.patch('/api/reports/:id/status', authenticateToken, requireRole(['ADMIN', 'MODERATOR']), (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  const reportId = req.params.id;

  if (!status || !['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'يرجى تقديم حالة صالحة للبلاغ' });
  }

  const report = db.getReportById(reportId);
  if (!report) {
    return res.status(404).json({ error: 'الحالة المطلوبة غير موجودة' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح' });
  }

  try {
    const updated = db.updateReportStatus(reportId, status);
    
    // Log this status change
    db.createAction(
      reportId,
      req.user.id,
      req.user.name,
      req.user.role,
      status === 'CLOSED' ? 'RESOLVED' : 'STATUS_CHANGED',
      `تم تحديث حالة البلاغ بنجاح إلى: ${status === 'CLOSED' ? 'مغلق ومكتمل البلاغ' : status === 'IN_PROGRESS' ? 'قيد المراجعة والمعالجة' : 'مفتوح للعموم'}`
    );

    broadcastEvent('STATUS_UPDATED', {
      reportId,
      status,
      userName: req.user.name,
      message: `⚙️ تم تغيير حالة البلاغ ${reportId} إلى: ${status}`
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add Internal Team Comment to a Report
app.post('/api/reports/:id/comments', authenticateToken, (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  const reportId = req.params.id;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'يرجى كتابة نص التعليق' });
  }

  const report = db.getReportById(reportId);
  if (!report) {
    return res.status(404).json({ error: 'الحالة غير موجودة' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح' });
  }

  try {
    const comment = db.createComment(
      reportId,
      req.user.id,
      req.user.name,
      req.user.role,
      text
    );

    broadcastEvent('COMMENT_ADDED', {
      reportId,
      commentId: comment.id,
      userName: req.user.name,
      message: `💬 تعليق جديد من ${req.user.name}`
    });

    res.status(201).json(comment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Configure Integrations Settings (Admin only)
app.get('/api/settings', authenticateToken, requireRole(['ADMIN']), (req: AuthRequest, res: Response) => {
  try {
    const settings = db.getSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', authenticateToken, requireRole(['ADMIN']), (req: AuthRequest, res: Response) => {
  const { discordWebhookUrl, telegramBotToken, telegramChatId } = req.body;

  try {
    const updated = db.updateSettings({
      discordWebhookUrl,
      telegramBotToken,
      telegramChatId
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Vite & Client Frontend Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Integrate Vite as Middleware in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve build outputs in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Running on http://localhost:${PORT}`);
  });
}

startServer();
