import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { User, Report, ActionLog, Comment, IntegrationSettings, DashboardStats } from './types';

const DB_PATH = path.join(process.cwd(), 'db.json');

interface Schema {
  users: Record<string, any>; // email -> hashedUser
  reports: Report[];
  actions: ActionLog[];
  comments: Comment[];
  settings: IntegrationSettings;
}

function initializeDb(): Schema {
  if (fs.existsSync(DB_PATH)) {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading DB, re-initializing...', e);
    }
  }

  // Seed data
  const salt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('admin123', salt);
  const modPasswordHash = bcrypt.hashSync('mod123', salt);
  const memberPasswordHash = bcrypt.hashSync('member123', salt);

  const initialUsers: Record<string, any> = {
    'admin@tiktokmod.com': {
      id: 'usr-admin',
      email: 'admin@tiktokmod.com',
      password: adminPasswordHash,
      name: 'أحمد المسؤول',
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
    },
    'moderator@tiktokmod.com': {
      id: 'usr-mod',
      email: 'moderator@tiktokmod.com',
      password: modPasswordHash,
      name: 'سارة المشرفة',
      role: 'MODERATOR',
      createdAt: new Date().toISOString(),
    },
    'member@tiktokmod.com': {
      id: 'usr-member',
      email: 'member@tiktokmod.com',
      password: memberPasswordHash,
      name: 'خالد مبلّغ',
      role: 'MEMBER',
      createdAt: new Date().toISOString(),
    },
  };

  const initialReports: Report[] = [
    {
      id: 'rep-1',
      tiktokLink: 'https://www.tiktok.com/@fake_personality_123/video/7311223344',
      violationType: 'انتحال شخصية',
      description: 'حساب ينتحل صفحة جهة حكومية رسمية وينشر مقاطع مفبركة تهدف لتضليل المتابعين وتحصيل أرباح بطرق مشبوهة.',
      evidenceUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      status: 'OPEN',
      userId: 'usr-mod',
      userName: 'سارة المشرفة',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
    },
    {
      id: 'rep-2',
      tiktokLink: 'https://www.tiktok.com/@toxic_user_xyz/video/7322334455',
      violationType: 'تنمر',
      description: 'يقوم صاحب الحساب في هذا الفيديو بالتنمر اللفظي المباشر ونشر الشائعات المغرضة والتشهير بأحد صناع المحتوى الشباب.',
      evidenceUrl: '',
      status: 'IN_PROGRESS',
      userId: 'usr-member',
      userName: 'خالد مبلّغ',
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), // 12 hours ago
    },
    {
      id: 'rep-3',
      tiktokLink: 'https://www.tiktok.com/@hate_speech_group/video/7333445566',
      violationType: 'خطاب كراهية',
      description: 'محاكاة وبث مقاطع تحض على الكراهية العرقية والدينية وتدعو إلى ممارسة العنف والتمييز ضد فئات محددة في الكومنتات.',
      evidenceUrl: '',
      status: 'CLOSED',
      userId: 'usr-admin',
      userName: 'أحمد المسؤول',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
    },
  ];

  const initialActions: ActionLog[] = [
    {
      id: 'act-1',
      reportId: 'rep-1',
      userId: 'usr-mod',
      userName: 'سارة المشرفة',
      userRole: 'MODERATOR',
      type: 'CREATED',
      details: 'تم إنشاء بلاغ انتحال الشخصية وإرسال الإشعارات.',
      createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'act-2',
      reportId: 'rep-2',
      userId: 'usr-member',
      userName: 'خالد مبلّغ',
      userRole: 'MEMBER',
      type: 'CREATED',
      details: 'تم إنشاء بلاغ التنمر بواسطة العضو.',
      createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    },
    {
      id: 'act-3',
      reportId: 'rep-2',
      userId: 'usr-mod',
      userName: 'سارة المشرفة',
      userRole: 'MODERATOR',
      type: 'VIEWED',
      details: 'تم استعراض تفاصيل الحالة لبدء المعاينة.',
      createdAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
    },
    {
      id: 'act-4',
      reportId: 'rep-2',
      userId: 'usr-member',
      userName: 'خالد مبلّغ',
      userRole: 'MEMBER',
      type: 'CLICKED_REPORT',
      details: 'المبلّغ خالد قام بالضغط على زر "إبلاغ الآن" وانتقل لصفحة تيك توك وتأكيد البلاغ.',
      createdAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    },
    {
      id: 'act-5',
      reportId: 'rep-3',
      userId: 'usr-admin',
      userName: 'أحمد المسؤول',
      userRole: 'ADMIN',
      type: 'CREATED',
      details: 'تم إنشاء بلاغ خطاب الكراهية.',
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'act-6',
      reportId: 'rep-3',
      userId: 'usr-admin',
      userName: 'أحمد المسؤول',
      userRole: 'ADMIN',
      type: 'RESOLVED',
      details: 'تم مراجعة البلاغ وتأكيد إغلاق الحساب المخالف على منصة تيك توك.',
      createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    },
  ];

  const initialComments: Comment[] = [
    {
      id: 'com-1',
      reportId: 'rep-1',
      userId: 'usr-admin',
      userName: 'أحمد المسؤول',
      userRole: 'ADMIN',
      text: 'يرجى من جميع الأعضاء والمشرفين التوجه فوراً للرابط وتأكيد الإبلاغ على هذا الحساب، لأنه يمثل خطورة قصوى.',
      createdAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
    },
    {
      id: 'com-2',
      reportId: 'rep-1',
      userId: 'usr-mod',
      userName: 'سارة المشرفة',
      userRole: 'MODERATOR',
      text: 'تم الإبلاغ يدوياً من حساباتي الثلاثة وسأتابع التحديثات هنا مباشرة.',
      createdAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    },
    {
      id: 'com-3',
      reportId: 'rep-2',
      userId: 'usr-member',
      userName: 'خالد مبلّغ',
      userRole: 'MEMBER',
      text: 'أرفقت الرابط ويجب التركيز على خيار "المضايقات أو التنمر" عند تقديم الطلب لتيك توك.',
      createdAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
    },
  ];

  const defaultSchema: Schema = {
    users: initialUsers,
    reports: initialReports,
    actions: initialActions,
    comments: initialComments,
    settings: {
      discordWebhookUrl: '',
      telegramBotToken: '',
      telegramChatId: '',
    },
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(defaultSchema, null, 2), 'utf-8');
  return defaultSchema;
}

// Global cached connection
let dbInstance = initializeDb();

function save(): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(dbInstance, null, 2), 'utf-8');
}

export const db = {
  getUsers(): User[] {
    return Object.values(dbInstance.users).map(({ password, ...u }) => u);
  },

  getUserByEmail(email: string): any {
    return dbInstance.users[email] || null;
  },

  getUserById(id: string): User | null {
    const found = Object.values(dbInstance.users).find((u) => u.id === id);
    if (!found) return null;
    const { password, ...userWithoutPassword } = found;
    return userWithoutPassword;
  },

  createUser(email: string, passwordHash: string, name: string, role: 'ADMIN' | 'MODERATOR' | 'MEMBER'): User {
    const id = `usr-${Math.random().toString(36).substr(2, 9)}`;
    const newUser = {
      id,
      email,
      password: passwordHash,
      name,
      role,
      createdAt: new Date().toISOString(),
    };
    dbInstance.users[email] = newUser;
    save();
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  getReports(): Report[] {
    return dbInstance.reports;
  },

  getReportById(id: string): Report | null {
    return dbInstance.reports.find((r) => r.id === id) || null;
  },

  createReport(tiktokLink: string, violationType: string, description: string, creatorId: string, creatorName: string, evidenceUrl?: string): Report {
    const id = `rep-${Math.random().toString(36).substr(2, 9)}`;
    const newReport: Report = {
      id,
      tiktokLink,
      violationType,
      description,
      evidenceUrl,
      status: 'OPEN',
      userId: creatorId,
      userName: creatorName,
      createdAt: new Date().toISOString(),
    };
    dbInstance.reports.unshift(newReport); // newest first
    save();
    return newReport;
  },

  updateReportStatus(id: string, status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED'): Report | null {
    const reportIndex = dbInstance.reports.findIndex((r) => r.id === id);
    if (reportIndex === -1) return null;
    dbInstance.reports[reportIndex].status = status;
    save();
    return dbInstance.reports[reportIndex];
  },

  getActions(reportId?: string): ActionLog[] {
    if (reportId) {
      return dbInstance.actions.filter((a) => a.reportId === reportId);
    }
    return dbInstance.actions;
  },

  createAction(reportId: string, userId: string, userName: string, userRole: 'ADMIN' | 'MODERATOR' | 'MEMBER', type: 'CREATED' | 'VIEWED' | 'CLICKED_REPORT' | 'STATUS_CHANGED' | 'RESOLVED', details?: string): ActionLog {
    const id = `act-${Math.random().toString(36).substr(2, 9)}`;
    const newAction: ActionLog = {
      id,
      reportId,
      userId,
      userName,
      userRole,
      type,
      details,
      createdAt: new Date().toISOString(),
    };
    dbInstance.actions.unshift(newAction);
    save();
    return newAction;
  },

  getComments(reportId: string): Comment[] {
    return dbInstance.comments.filter((c) => c.reportId === reportId);
  },

  createComment(reportId: string, userId: string, userName: string, userRole: 'ADMIN' | 'MODERATOR' | 'MEMBER', text: string): Comment {
    const id = `com-${Math.random().toString(36).substr(2, 9)}`;
    const newComment: Comment = {
      id,
      reportId,
      userId,
      userName,
      userRole,
      text,
      createdAt: new Date().toISOString(),
    };
    dbInstance.comments.push(newComment); // order chronologically
    save();
    return newComment;
  },

  getSettings(): IntegrationSettings {
    return dbInstance.settings;
  },

  updateSettings(settings: IntegrationSettings): IntegrationSettings {
    dbInstance.settings = {
      ...dbInstance.settings,
      ...settings,
    };
    save();
    return dbInstance.settings;
  },

  getDashboardStats(): DashboardStats {
    const totalReports = dbInstance.reports.length;
    const openReports = dbInstance.reports.filter((r) => r.status === 'OPEN').length;
    const inProgressReports = dbInstance.reports.filter((r) => r.status === 'IN_PROGRESS').length;
    const closedReports = dbInstance.reports.filter((r) => r.status === 'CLOSED').length;
    const totalMembers = Object.keys(dbInstance.users).length;

    // Violation types breakdown
    const violationTypeCounts: Record<string, number> = {};
    dbInstance.reports.forEach((r) => {
      violationTypeCounts[r.violationType] = (violationTypeCounts[r.violationType] || 0) + 1;
    });

    // Simple timeline grouping (last 7 days)
    const statsByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
      statsByDay[dateStr] = 0;
    }

    dbInstance.reports.forEach((r) => {
      const dateStr = new Date(r.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
      if (dateStr in statsByDay) {
        statsByDay[dateStr]++;
      }
    });

    const reportsTimeline = Object.entries(statsByDay).map(([date, count]) => ({
      date,
      count,
    }));

    return {
      totalReports,
      openReports,
      inProgressReports,
      closedReports,
      totalMembers,
      violationTypeCounts,
      reportsTimeline,
    };
  },
};
