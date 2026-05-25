/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  AlertTriangle,
  Clock,
  ExternalLink,
  MessageSquare,
  Plus,
  Send,
  Settings,
  Users,
  LogOut,
  CheckCircle,
  TrendingUp,
  Mail,
  Lock,
  User,
  Info,
  ChevronLeft,
  Copy,
  Check,
  Bell,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Role, Report, ActionLog, Comment, IntegrationSettings, DashboardStats } from './types';

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('tiktok_mod_token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authInvitationCode, setAuthInvitationCode] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Layout & active section
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'team' | 'settings'>('dashboard');
  
  // App data state
  const [reports, setReports] = useState<Report[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({
    discordWebhookUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
  });

  // Selected report for Details view
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportIdx, setSelectedReportIdx] = useState<Report | null>(null);
  const [reportComments, setReportComments] = useState<Comment[]>([]);
  const [reportActions, setReportActions] = useState<ActionLog[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // New report form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTiktokLink, setNewTiktokLink] = useState('');
  const [newViolationType, setNewViolationType] = useState('انتحال شخصية');
  const [newDescription, setNewDescription] = useState('');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Settings saving status
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);
  const [saveSettingsError, setSaveSettingsError] = useState(false);

  // Real-time Event Log to showcase live updates
  const [liveLogs, setLiveLogs] = useState<{ id: string; message: string; time: string; type: string }[]>([]);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [latestAlertMessage, setLatestAlertMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedLinkReportId, setCopiedLinkReportId] = useState<string | null>(null);
  const [copiedTextReportId, setCopiedTextReportId] = useState<string | null>(null);

  // Audio effect context for warnings
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(520, audioCtx.currentTime); // Alert beat
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.log('Audio Context error: ', e);
    }
  };

  // Check connection status & live stream (SSE)
  const [isConnected, setIsConnected] = useState(false);

  // TikTok Technical Support Legal Action Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 1. Fetch current profile if token exists
  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token]);

  // 2. Load general stats & reports when user is authenticated
  useEffect(() => {
    if (currentUser) {
      fetchDashboardData();
      fetchReports();
      if (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') {
        fetchTeamMembers();
      }
      if (currentUser.role === 'ADMIN') {
        fetchIntegrationSettings();
      }

      // Initialize SSE client
      const sse = new EventSource('/api/events/live');
      
      sse.onopen = () => {
        setIsConnected(true);
      };

      const handleEvent = (message: string, type: string) => {
        setLiveLogs((prev) => [
          {
            id: `log-${Math.random().toString(36).substring(2, 9)}`,
            message,
            time: new Date().toLocaleTimeString('ar-EG'),
            type,
          },
          ...prev.slice(0, 19),
        ]);
        playAlertSound();
        setLatestAlertMessage(message);
        setHasNewAlert(true);
        setTimeout(() => setHasNewAlert(false), 5900);
        
        // Refresh items automatically
        fetchDashboardData();
        fetchReports();
      };

      sse.addEventListener('NEW_REPORT', (e: any) => {
        const data = JSON.parse(e.data);
        handleEvent(data.message, 'NEW_REPORT');
      });

      sse.addEventListener('ACTION_LOGGED', (e: any) => {
        const data = JSON.parse(e.data);
        handleEvent(data.message, 'ACTION');
        // If current selected report has updates, refresh them
        if (selectedReportId === data.reportId) {
          fetchSingleReportDetails(data.reportId);
        }
      });

      sse.addEventListener('STATUS_UPDATED', (e: any) => {
        const data = JSON.parse(e.data);
        handleEvent(data.message, 'STATUS');
        if (selectedReportId === data.reportId) {
          fetchSingleReportDetails(data.reportId);
        }
      });

      sse.addEventListener('COMMENT_ADDED', (e: any) => {
        const data = JSON.parse(e.data);
        handleEvent(data.message, 'COMMENT');
        if (selectedReportId === data.reportId) {
          fetchSingleReportDetails(data.reportId);
        }
      });

      sse.onerror = () => {
        setIsConnected(false);
      };

      return () => {
        sse.close();
      };
    }
  }, [currentUser]);

  // Fetch report details when selected
  useEffect(() => {
    if (selectedReportId) {
      fetchSingleReportDetails(selectedReportId);
    } else {
      setSelectedReportIdx(null);
    }
  }, [selectedReportId]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        // Token might be invalid or expired
        handleLogout();
      }
    } catch (e) {
      console.error(e);
      handleLogout();
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {
      console.error('Error fetching reports:', e);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data);
      }
    } catch (e) {
      console.error('Error fetching team members:', e);
    }
  };

  const fetchIntegrationSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrationSettings(data);
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const fetchSingleReportDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedReportIdx(data.report);
        setReportComments(data.comments);
        setReportActions(data.actions);
      }
    } catch (e) {
      console.error('Error fetching single report:', e);
    }
  };

  // Actions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('tiktok_mod_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setAuthSuccess('تم تسجيل الدخول بنجاح! جاري تحميل لوحة التحكم...');
      } else {
        setAuthError(data.error || 'حدث خطأ غير متوقع أثناء الدخول');
      }
    } catch (err: any) {
      setAuthError('تعذر الاتصال بالخادم. تأكد من تشغيل الخادم.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
          code: authInvitationCode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('tiktok_mod_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setAuthSuccess('تم إنشاء الحساب بنجاح وربطه بالمنصة الإشرافية!');
      } else {
        setAuthError(data.error || 'فشل تسجيل حساب جديد، يرجى مراجعة البيانات');
      }
    } catch (err) {
      setAuthError('لأسباب برمجية فشل الاتصال بقاعدة البيانات المحلية');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tiktok_mod_token');
    setToken(null);
    setCurrentUser(null);
    setReports([]);
    setStats(null);
    setSelectedReportId(null);
  };

  const handleCreateReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Pre-validation
    if (!newTiktokLink.includes('tiktok.com')) {
      setFormError('عذراً، يجب أن يكون الرابط من منصة TikTok الرسمية فقط');
      return;
    }

    setSubmittingReport(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tiktokLink: newTiktokLink,
          violationType: newViolationType,
          description: newDescription,
          evidenceUrl: newEvidenceUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFormSuccess('تمت إضافة البلاغ وإشعار كافة أفراد الفريق والمجموعات!');
        setNewTiktokLink('');
        setNewDescription('');
        setNewEvidenceUrl('');
        fetchReports();
        fetchDashboardData();
        setTimeout(() => {
          setIsCreateModalOpen(false);
          setFormSuccess('');
          // Auto select newer report
          setSelectedReportId(data.id);
        }, 1500);
      } else {
        setFormError(data.error || 'فشلت عملية حفظ البلاغ');
      }
    } catch (err) {
      setFormError('فشل الاتصال بالخادم الداخلي لإتمام العملية.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const getTiktokUsername = (url: string) => {
    try {
      const match = url.match(/@([a-zA-Z0-9_\.]+)/);
      return match ? `@${match[1]}` : 'غير محدد';
    } catch (e) {
      return 'غير محدد';
    }
  };

  const generateDetailedReportText = (report: Report) => {
    const username = getTiktokUsername(report.tiktokLink);
    return `مرحباً فريق الدعم الفني والقانوني لتيك توك (TikTok support team)،

أود تقديم بلاغ رسمي ومفصل عن مخالفة جسيمة لقوانين مجتمع تيك توك:
- رابط الحساب / الفيديو المخالف: ${report.tiktokLink}
- اسم الحساب المستهدف: ${username}
- نوع وطبيعة المخالفة: ${report.violationType}
- تفاصيل المخالفة والتحليل الفني:
${report.description}

يرجى من فريق مراجعة المحتوى والسياسات اتخاذ إجراء فوري وصارم بحظر هذا المحتوى حفاظاً على سلامة مجتمع تيك توك من الانتهاكات والتجاوزات.

شكراً لكم،
فريق درع تيك توك لحماية المجتمع`;
  };

  const handleSupportReportClick = async (report: Report) => {
    try {
      await fetch(`/api/reports/${report.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'CLICKED_REPORT',
          details: `العضو قام بفتح مساعد الدعم الفني الرسمي لتيك توك وتوليد البلاغ التفصيلي لإرساله.`,
        }),
      });
      fetchSingleReportDetails(report.id);
    } catch (e) {
      console.error(e);
    }
    setIsSupportModalOpen(true);
  };

  const handleReportActionClick = async (report: Report) => {
    // 1. Log the click "CLICKED_REPORT" to track user actions
    try {
      await fetch(`/api/reports/${report.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'CLICKED_REPORT',
          details: `العضو قام بفتح نافذة تيك توك والانتقال لتقديم البلاغ المباشر ضد المحتوى المخالف.`,
        }),
      });
      // reload details
      fetchSingleReportDetails(report.id);
    } catch (e) {
      console.error(e);
    }

    // 2. Format a safe official Tiktok report popup layout
    // TikTok web allows reporting content via official report page
    // We navigate to direct account URL if provided or main Tiktok report.
    const url = report.tiktokLink;
    window.open(url, '_blank');
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/reports/${selectedReportId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: newCommentText }),
      });

      if (res.ok) {
        setNewCommentText('');
        if (selectedReportId) {
          fetchSingleReportDetails(selectedReportId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: 'OPEN' | 'IN_PROGRESS' | 'CLOSED') => {
    if (!selectedReportId) return;

    try {
      const res = await fetch(`/api/reports/${selectedReportId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchSingleReportDetails(selectedReportId);
        fetchReports();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSettingsError(false);
    setSaveSettingsSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(integrationSettings),
      });

      if (res.ok) {
        setSaveSettingsSuccess(true);
        fetchIntegrationSettings();
      } else {
        setSaveSettingsError(true);
      }
    } catch (err) {
      setSaveSettingsError(true);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'txt', reportId: string) => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLinkReportId(reportId);
      setTimeout(() => setCopiedLinkReportId(null), 2000);
    } else {
      setCopiedTextReportId(reportId);
      setTimeout(() => setCopiedTextReportId(null), 2000);
    }
  };

  // Helper translations for UI
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            نشط ومفتوح
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            قيد المراجعة
          </span>
        );
      case 'CLOSED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            مغلق ومؤكد
          </span>
        );
      default:
        return null;
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-extrabold rounded">إدارة عليا</span>;
      case 'MODERATOR':
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-extrabold rounded">مشرف معتمد</span>;
      case 'MEMBER':
        return <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-extrabold rounded">مبلّغ مجتمعي</span>;
    }
  };

  const getActionName = (type: string) => {
    switch (type) {
      case 'CREATED':
        return 'تم إنشاء البلاغ ورصده';
      case 'VIEWED':
        return 'استعرض تفاصيل البلاغ';
      case 'CLICKED_REPORT':
        return 'أكد المشاركة وتقديم البلاغ على تيك توك 🚀';
      case 'STATUS_CHANGED':
        return 'حدّث حالة المعالجة';
      case 'RESOLVED':
        return 'أقفل وحل الحالة';
      default:
        return type;
    }
  };

  // Auth Gate UI
  if (!currentUser) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-200 flex flex-col justify-between p-6 font-sans relative overflow-y-auto" dir="rtl">
        {/* Glowing background effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center py-4 border-b border-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-pink-600 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block">درع تيك توك</span>
              <span className="text-[10px] text-slate-500 block">منصة إدارة بلاغات المجتمع الإشرافية</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">حالة الخادم:</span>
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-semibold rounded border border-yellow-500/20 animate-pulse">مستعد للربط بيئة معزولة</span>
          </div>
        </div>

        {/* Main Auth Form Grid */}
        <div className="max-w-md w-full mx-auto my-auto py-12 z-10">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-white">{isRegisterMode ? 'إنشاء حساب جديد بالمنصة' : 'تسجيل دخول المشرفين والأعضاء'}</h2>
              <p className="text-xs text-slate-400 mt-2">
                {isRegisterMode 
                  ? 'يرجى ملء البيانات وإدخال رمز الدعوة إذا كنت مشرفاً للحصول على صلاحيات التعديل' 
                  : 'أهلاً بك مجدداً. الرجاء إدخال بيانات الاعتماد الممنوحة لك للوصول لأدوات الرصد'
                }
              </p>
            </div>

            {authError && (
              <div className="mb-6 p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs flex gap-2 items-start leading-relaxed">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="mb-6 p-4 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-xs flex gap-2 items-start leading-relaxed">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{authSuccess}</span>
              </div>
            )}

            <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-slate-300">الاسم والكنية الثنائية</label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 pr-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                      placeholder="امجد السعيد"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">البريد الإلكتروني للإشراف</label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 pr-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                    placeholder="name@tiktokmod.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">كلمة المرور المشفرة</label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 pr-11 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                    placeholder="••••••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {isRegisterMode && (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-300">كود فك الصلاحيات الحصرية (اختياري)</label>
                    <span className="text-[10px] text-slate-500 font-mono select-all">مشرف: MOD-SHIELD | مدير: ADMIN-TITAN</span>
                  </div>
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                    placeholder="مثال: MOD-SHIELD لترقية الحساب تلقائياً للتجربة"
                    value={authInvitationCode}
                    onChange={(e) => setAuthInvitationCode(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 active:scale-98 text-white py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-red-900/30 transition-all cursor-pointer flex justify-center items-center"
              >
                {authLoading ? 'جاري التحقق من الهوية والأمن...' : (isRegisterMode ? 'إنشاء حساب جديد فورياً 🚀' : 'تسجيل الدخول للنظام الإشرافي 🔐')}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                {isRegisterMode ? 'تمتلك حساباً مسجلاً من قبل؟' : 'لا تملك حساب عضوية ومتابعة؟'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setAuthError('');
                  setAuthSuccess('');
                }}
                className="text-red-400 hover:text-red-300 font-bold transition-cyan cursor-pointer"
              >
                {isRegisterMode ? 'تسجيل دخول مباشر' : 'أنشئ حساباً تجريبياً هنا'}
              </button>
            </div>
          </div>

          {/* Seed demo credentials helper */}
          {!isRegisterMode && (
            <div className="mt-4 p-4 bg-slate-900/40 border border-slate-900 rounded-2xl text-xs space-y-2 text-slate-400">
              <p className="font-bold text-slate-300 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                بيانات تسجيل تجريبية مسبقة للبث المباشر:
              </p>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <span className="block font-bold text-red-400">مدير نظام:</span>
                  <span>admin@tiktokmod.com</span>
                  <span className="block text-slate-500">الباسورد: admin123</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <span className="block font-bold text-blue-400">مشرف معتمد:</span>
                  <span>moderator@tiktokmod.com</span>
                  <span className="block text-slate-500">الباسورد: mod123</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-900">
                  <span className="block font-bold text-emerald-400">عضو مبلّغ:</span>
                  <span>member@tiktokmod.com</span>
                  <span className="block text-slate-500">الباسورد: member123</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto w-full text-center text-xs text-slate-600 border-t border-slate-900 py-4 select-none">
          منصة درع تيك توك تعمل وفقاً للاتفاقيات لسرية حظر الحسابات ومقاومة التنمر وانتحال الشخصية. نحن لا نطلب أو نخزن أي كلمات مرور خاصة بحسابات تيك توك الشخصية للمشاركين.
        </div>
      </div>
    );
  }

  // Calculate actual ratios or mock if needed
  const solvedPercentage = stats ? Math.round((stats.closedReports / (stats.totalReports || 1)) * 100) : 33;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden" dir="rtl">
      
      {/* Toast Alert Banner for Live Realtime Event Streams */}
      {latestAlertMessage && hasNewAlert && (
        <div className="fixed top-4 left-4 z-50 max-w-sm w-full bg-slate-900 border-2 border-red-500/50 rounded-2xl p-4 shadow-2xl shadow-red-900/30 animate-bounce flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 flex-shrink-0">
            <Bell className="w-4 h-4 animate-swing" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white">إشعار فوري وتنبيه حي</h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">{latestAlertMessage}</p>
          </div>
          <button 
            onClick={() => setLatestAlertMessage('')} 
            className="text-slate-500 hover:text-slate-300 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-l border-slate-800/80 flex flex-col justify-between flex-shrink-0">
        <div>
          {/* Brand Logo */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
            <div className="w-9 h-9 bg-gradient-to-tr from-pink-600 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-red-900/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block">درع تيك توك</span>
              <span className="text-[10px] text-slate-500 block">مراقب البلاغات المجتمعية</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/45 mx-3 mt-4 rounded-xl border border-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
              <span className="text-[11px] text-slate-400 font-bold">بث حي للأحداث</span>
            </div>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="text-slate-500 hover:text-slate-300"
              title={soundEnabled ? 'كتم تنبيه الصوت' : 'تفعيل تنبيه الصوت'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-red-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="px-3 space-y-1.5 mt-5">
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedReportId(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl font-medium transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>لوحة الإحصائيات الرئيسة</span>
            </button>

            <button
              onClick={() => { setActiveTab('reports'); setSelectedReportId(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl font-medium transition-all cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>سجل البلاغات الحالي</span>
              {reports.filter(r => r.status === 'OPEN').length > 0 && (
                <span className="mr-auto px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full font-bold">
                  {reports.filter(r => r.status === 'OPEN').length}
                </span>
              )}
            </button>

            {(currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
              <button
                onClick={() => { setActiveTab('team'); setSelectedReportId(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl font-medium transition-all cursor-pointer ${
                  activeTab === 'team'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>أعضاء فريق الإشراف</span>
                <span className="mr-auto text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded">
                  {teamMembers.length || 3}
                </span>
              </button>
            )}

            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => { setActiveTab('settings'); setSelectedReportId(null); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl font-medium transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>إعدادات ربط الإشعارات</span>
              </button>
            )}
          </nav>
        </div>

        {/* Current logged-in user details */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-red-400 text-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-slate-100 truncate">{currentUser.name}</p>
              <p className="text-[10px] text-slate-500 truncate mt-0.5">{currentUser.email}</p>
            </div>
          </div>
          <div className="flex gap-2 justify-between items-center text-xs mt-2 pt-2 border-t border-slate-800/40">
            {getRoleBadge(currentUser.role)}
            <button
              onClick={handleLogout}
              className="p-1 px-2 hover:bg-red-500/10 hover:text-red-400 transition-colors rounded text-slate-500 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              خروج
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-bold text-slate-100">
              {activeTab === 'dashboard' && 'نظرة عامة على النظام ومؤشرات البلاغات'}
              {activeTab === 'reports' && 'سجل الرصد والحالات النشطة'}
              {activeTab === 'team' && 'قائمة المشرفين الحالية وصلاحياتهم'}
              {activeTab === 'settings' && 'تكامل المنصات الخارجية مع درع تيك توك'}
            </h2>
            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-bold rounded-lg uppercase tracking-wider border border-green-500/20">
              {currentUser.role === 'ADMIN' ? 'مدير كامل الصلاحية' : currentUser.role === 'MODERATOR' ? 'مشرف فحص' : 'عضو متابع'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-[11px] font-bold text-slate-300">
                {reports.filter((r) => r.status === 'OPEN').length} بلاغات بانتظار التحقق
              </span>
            </div>

            <button
              onClick={() => {
                setFormError('');
                setFormSuccess('');
                setIsCreateModalOpen(true);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              بلاغ جديد
            </button>
          </div>
        </header>

        {/* Dynamic Inner Layout Body */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && !selectedReportId && (
            <>
              {/* Statistics Panel Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-bold">إجمالي البلاغات المسجلة</p>
                    <p className="text-2xl font-black text-white mt-1">
                      {stats ? stats.totalReports : reports.length}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
                  <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-500">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-bold">حالات قيد المراجعة</p>
                    <p className="text-2xl font-black text-white mt-1">
                      {stats ? stats.inProgressReports : reports.filter(r => r.status === 'IN_PROGRESS').length}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-bold">معدل الإغلاق وحل الشكاوى</p>
                    <p className="text-2xl font-black text-purple-400 mt-1">
                      {solvedPercentage}%
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800/80 flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-bold">المشاركين المسجلين</p>
                    <p className="text-2xl font-black text-white mt-1">
                      {stats ? stats.totalMembers : 3}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Reports Feed Table (Left 2 Columns) */}
                <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-5 bg-red-600 rounded-full"></span>
                      <h3 className="font-bold text-white text-sm">أحدث الحالات النشطة</h3>
                    </div>
                    <button 
                      onClick={() => setActiveTab('reports')} 
                      className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <span>عرض الكل</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead className="bg-slate-950/60 text-slate-400 text-xs font-bold border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-4">معرف البلاغ والمكلف</th>
                          <th className="px-6 py-4">نوع المخالفة والتصنيف</th>
                          <th className="px-6 py-4">الحالة</th>
                          <th className="px-6 py-4 text-left">مراجعة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {reports.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-xs text-slate-500">
                              لا توجد بلاغات مسجلة حالياً بالمنصة. اضغط على بلاغ جديد للمباشرة بنشر الحالة.
                            </td>
                          </tr>
                        ) : (
                          reports.slice(0, 5).map((report) => (
                            <tr key={report.id} className="hover:bg-slate-800/20 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center font-bold text-xs">
                                    T
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{report.id}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[110px]">بواسطة: {report.userName}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-xs font-bold text-red-400">
                                <div>
                                  <span className="inline-block bg-red-500/10 px-2 py-0.5 rounded border border-red-500/15 text-[11px] text-red-300">
                                    {report.violationType}
                                  </span>
                                  <span className="block text-[10px] font-normal text-slate-400 mt-1 truncate max-w-[200px]">
                                    {report.tiktokLink}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(report.status)}
                              </td>
                              <td className="px-6 py-4 text-left">
                                <button
                                  onClick={() => setSelectedReportId(report.id)}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                  تحقق من الحالة
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sidebar widgets (Activity Log & Violation breakdown) */}
                <div className="flex flex-col gap-8">
                  {/* Category Breakdown list */}
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
                    <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-red-600 rounded"></span>
                      أكثر المخالفات انتشاراً
                    </h3>
                    
                    <div className="space-y-4">
                      {stats && stats.violationTypeCounts && Object.keys(stats.violationTypeCounts).length > 0 ? (
                        Object.entries(stats.violationTypeCounts).map(([type, count]) => {
                          const total = stats.totalReports || 1;
                          const ratio = Math.round((Number(count) / total) * 100);
                          return (
                            <div key={type} className="space-y-1.5">
                              <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                <span>{type}</span>
                                <span>{count} بلاغ ({ratio}%)</span>
                              </div>
                              <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-l from-red-600 to-pink-500 rounded-full" 
                                  style={{ width: `${ratio}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-400">
                              <span>انتحال شخصية</span>
                              <span>42%</span>
                            </div>
                            <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full" style={{ width: '42%' }}></div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-400">
                              <span>تنمر ومضايقة</span>
                              <span>28%</span>
                            </div>
                            <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: '28%' }}></div>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-400">
                              <span>خطاب كراهية</span>
                              <span>15%</span>
                            </div>
                            <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-500 rounded-full" style={{ width: '15%' }}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Real-time feed stream logs widget */}
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col max-h-[350px]">
                    <h3 className="font-bold text-sm text-white mb-4 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-3 bg-blue-600 rounded"></span>
                        سجل النشاط اللحظي للشبكة
                      </span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      {liveLogs.length === 0 ? (
                        <p className="text-[11px] text-slate-500 text-center py-10 leading-relaxed">
                          بانتظار حدوث عمليات جديدة بالمنصة. أي بلاغ أو مشاركة أو تعليق سيظهر هنا وبمجموعات الـ Discord مباشرة.
                        </p>
                      ) : (
                        liveLogs.map((log) => (
                          <div key={log.id} className="flex gap-3 items-start border-r-2 border-slate-800 pr-3 py-1 text-xs">
                            <div className="min-w-0 flex-1">
                              <p className="text-slate-300 font-medium leading-relaxed">{log.message}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{log.time}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </>
          )}

          {/* Full Reports Grid with Search & Filters  */}
          {activeTab === 'reports' && !selectedReportId && (
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base">قاعدة بيانات بلاغات TikTok</h3>
                  <p className="text-xs text-slate-500 mt-1">يمكنك فرز ومعاينة حالات الرصد ومكافحة التجاوزات المجتمعية.</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-xs font-bold text-slate-300">
                    إجمالي: {reports.length}
                  </span>
                  <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-bold">
                    نشط: {reports.filter((r) => r.status === 'OPEN').length}
                  </span>
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-slate-500 text-xs">
                    لا توجد حالات حالياً. الرجاء إضافة بلاغ بالنقر على "بلاغ جديد" في الأعلى.
                  </div>
                ) : (
                  reports.map((report) => (
                    <div 
                      key={report.id} 
                      className="bg-slate-950 rounded-2xl border border-slate-800/80 p-5 hover:border-red-500/30 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <span className="px-2.5 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/15 text-[11px] font-bold rounded-lg truncate">
                            {report.violationType}
                          </span>
                          {getStatusBadge(report.status)}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-4">
                          {report.description}
                        </p>

                        <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/50 space-y-2 mb-4">
                          <span className="text-[10px] text-slate-500 font-bold block">رابط تيك توك المستهدف:</span>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs text-blue-400 truncate direction-ltr font-mono">{report.tiktokLink}</span>
                            <button
                              onClick={() => copyToClipboard(report.tiktokLink, 'link', report.id)}
                              className="text-slate-500 hover:text-slate-300 flex-shrink-0 cursor-pointer"
                              title="نسخ الرابط"
                            >
                              {copiedLinkReportId === report.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-900 flex justify-between items-center bg-slate-950">
                        <span className="text-[10px] text-slate-500">
                          بواسطة: {report.userName} {new Date(report.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                        
                        <button
                          onClick={() => setSelectedReportId(report.id)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-800 transition-all cursor-pointer"
                        >
                          عرض وتفاصيل الحالة
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Interactive Report Details Drawer / View */}
          {selectedReportId && selectedReportIdx && (
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              
              {/* Back to feed and Report Detail Card */}
              <div className="flex-1 bg-slate-900 rounded-3xl border border-slate-800 p-8 w-full">
                <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-800">
                  <button
                    onClick={() => {
                      setSelectedReportId(null);
                      setSelectedReportIdx(null);
                      fetchReports();
                    }}
                    className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-2 px-4 rounded-xl text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    العودة للسجل السابق
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">الحالة الحالية:</span>
                    {getStatusBadge(selectedReportIdx.status)}
                  </div>
                </div>

                {/* Report Content Panel */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">نوع المخالفة المكتشفة</span>
                      <span className="text-lg font-bold text-red-400">{selectedReportIdx.violationType}</span>
                    </div>
                    {/* Role specific Status Change buttons */}
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
                      <div className="flex gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                        <button
                          onClick={() => handleStatusChange('OPEN')}
                          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            selectedReportIdx.status === 'OPEN' ? 'bg-green-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          مفتوح
                        </button>
                        <button
                          onClick={() => handleStatusChange('IN_PROGRESS')}
                          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            selectedReportIdx.status === 'IN_PROGRESS' ? 'bg-yellow-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          قيد الفحص
                        </button>
                        <button
                          onClick={() => handleStatusChange('CLOSED')}
                          className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                            selectedReportIdx.status === 'CLOSED' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          مغلق/مؤكد
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description Info */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400">الوصف التفصيلي والتحليل الفني:</h4>
                    <p className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 text-sm text-slate-200 leading-relaxed font-sans pre-wrap">
                      {selectedReportIdx.description}
                    </p>
                  </div>

                  {/* Links and Targets */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] text-slate-500 font-bold block">رابط تيك توك المستهدف:</span>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-blue-400 font-mono truncate">{selectedReportIdx.tiktokLink}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(selectedReportIdx.tiktokLink, 'link', selectedReportIdx.id)}
                            className="bg-slate-900 p-1.5 border border-slate-800 rounded hover:text-white text-slate-400 transition cursor-pointer"
                            title="نسخ الرابط"
                          >
                            {copiedLinkReportId === selectedReportIdx.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={selectedReportIdx.tiktokLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-900 p-1.5 border border-slate-800 rounded text-slate-400 hover:text-white transition flex items-center justify-center"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {selectedReportIdx.evidenceUrl ? (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[10px] text-slate-500 font-bold block">رابط صورة أو مستند الدليل الإضافي:</span>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-xs text-slate-300 font-mono truncate">{selectedReportIdx.evidenceUrl}</span>
                          <a
                            href={selectedReportIdx.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-900 p-1.5 border border-slate-800 rounded text-slate-400 hover:text-white transition flex items-center justify-center flex-shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-center text-xs text-slate-500">
                        لا توجد مستندات إضافية مرفقة بهذا البلاغ.
                      </div>
                    )}
                  </div>

                  {/* Report Action Guide Warning Banner */}
                  <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-2xl space-y-4">
                    <h4 className="text-red-400 font-bold text-xs flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-red-500 animate-pulse" />
                      تعليمات الإبلاغ وإرسال الشكوى الفنية للتيك توك:
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      لضمان استجابة سريعة وقوية من إدارة تيك توك لحظر المحتوى المخالف بشكل نهائي، نوصي باستخدام 
                      <strong className="text-red-400 mx-1 font-bold">نموذج الدعم الفني القانوني المباشر</strong> لإدخال كامل النص والبيانات المفصلة من هنا، أو الانتقال السريع للمقطع.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <button
                        onClick={() => handleSupportReportClick(selectedReportIdx)}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-red-800 hover:scale-[1.01] transition-transform text-white rounded-xl font-bold text-xs text-center shadow-lg shadow-red-950/50 cursor-pointer flex justify-center items-center gap-2"
                      >
                        🌐 نموذج الدعم الفني وتوليد البلاغ المفصل
                      </button>
                      <button
                        onClick={() => handleReportActionClick(selectedReportIdx)}
                        className="flex-shrink-0 py-3 px-4 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition rounded-xl font-bold text-xs text-center cursor-pointer flex justify-center items-center gap-2"
                      >
                        📱 الانتقال للمقطع مباشرة
                      </button>
                    </div>
                  </div>

                  {/* Comment Feed System */}
                  <div className="border-t border-slate-800 pt-6">
                    <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      مناقشات المشرفين والتعليقات الداخلية ({reportComments.length})
                    </h3>

                    <div className="space-y-4 max-h-[250px] overflow-y-auto mb-4 pr-1">
                      {reportComments.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-6">
                          لا توجد تعليقات إشرافية على هذه الحالة حالياً. أضف رأيك بالأسفل للتنسيق.
                        </p>
                      ) : (
                        reportComments.map((com) => (
                          <div key={com.id} className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-1">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300">{com.userName}</span>
                                {getRoleBadge(com.userRole)}
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(com.createdAt).toLocaleTimeString('ar-EG')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-200 leading-relaxed pr-1">{com.text}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                        placeholder="اكتب توجيه أو تعليق فني لأعضاء الفريق..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        required
                      />
                      <button
                        type="submit"
                        disabled={submittingComment}
                        className="bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 text-slate-300 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        إرسال
                      </button>
                    </form>
                  </div>

                </div>
              </div>

              {/* Action and verification history timeline (Right Column) */}
              <div className="w-full lg:w-80 bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm mb-4">سجل تتبع تدقيق الحالة</h3>
                  
                  <div className="space-y-4">
                    {reportActions.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-10">بانتظار حدوث إجراءات من المبلّغين كالمعاينة والمشاركة.</p>
                    ) : (
                      reportActions.map((act) => (
                        <div key={act.id} className="border-r-2 border-slate-850 pr-4 pb-2 relative text-xs">
                          {/* Circle state point identifier */}
                          <span className={`absolute -right-1.5 top-1.5 w-3 h-3 rounded-full border border-slate-900 ${
                            act.type === 'CREATED' ? 'bg-green-500' : act.type === 'CLICKED_REPORT' ? 'bg-red-500 animate-pulse' : 'bg-slate-500'
                          }`}></span>
                          
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-mono block">
                              {new Date(act.createdAt).toLocaleString('ar-EG')}
                            </span>
                            <div className="flex items-center gap-1.5 wrap">
                              <strong className="text-slate-200 font-bold">{act.userName}</strong>
                              {getRoleBadge(act.userRole)}
                            </div>
                            <span className="text-slate-300 leading-relaxed block text-[11px] font-bold">
                              {getActionName(act.type)}
                            </span>
                            {act.details && (
                              <p className="text-[10px] text-slate-500 font-normal mt-0.5 leading-relaxed bg-slate-950 p-2 rounded">
                                {act.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800 text-[10px] text-slate-550 space-y-2">
                  <p className="font-bold text-slate-400">ملخص التقييم والمشاركة:</p>
                  <div className="flex justify-between">
                    <span>نقرات المشاركة والتأكيد:</span>
                    <span className="font-bold text-red-400">
                      {reportActions.filter(a => a.type === 'CLICKED_REPORT').length} مشاركين
                    </span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Team Management panel (ADMIN or MODERATOR only) */}
          {activeTab === 'team' && (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
            <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-base">فريق الإشراف وقائمة المدققين</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    قائمة بالأعضاء المسموح لهم بإنشاء الحالات وتقديم البلاغات وتعيين حالة الأمان.
                  </p>
                </div>
                <div className="text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-400">
                  كود فك صلاحية مشرف: <span className="text-blue-400 font-bold select-all">MOD-SHIELD</span> | كود الإدارة: <span className="text-red-400 font-bold select-all">ADMIN-TITAN</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teamMembers.length === 0 ? (
                  <p className="col-span-full py-10 text-center text-xs text-slate-500">لا يوجد أعضاء آخرين مسجلين في الشبكة حالياً.</p>
                ) : (
                  teamMembers.map((member) => (
                    <div key={member.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-red-400">
                          {member.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-slate-200 text-sm truncate">{member.name}</h4>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{member.email}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-900 flex justify-between items-center text-xs">
                        <span className="text-[10px] text-slate-500">
                          انضم: {new Date(member.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                        {getRoleBadge(member.role)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Webhook and Server integration configurations (ADMIN only) */}
          {activeTab === 'settings' && currentUser.role === 'ADMIN' && (
            <div className="max-w-2xl bg-slate-900 rounded-3xl border border-slate-800 p-8">
              <div className="mb-6 pb-6 border-b border-slate-800">
                <h3 className="font-bold text-white text-base">إعدادات قنوات الإشعار الخارجية</h3>
                <p className="text-xs text-slate-500 mt-1">
                  قم بربط المنصة بقناة Discord أو Telegram لإرسال تنبيهات تلقائية لجميع أفراد مجموعاتك فور نشر أي بلاغ تيك توك نشط.
                </p>
              </div>

              {saveSettingsSuccess && (
                <div className="mb-6 p-4 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-xs flex gap-2 items-start">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>تم حفظ وتفعيل إعدادات الربط للشبكات بنجاح! سيتم إخطار المشرفين بالخيارات الجديدة فوراً.</span>
                </div>
              )}

              {saveSettingsError && (
                <div className="mb-6 p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>عذراً، فشل تحديث الإعدادات الفنية للمنصة. الرجاء مراجعة الرموز.</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-850 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-900">
                    <div className="w-8 h-8 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                      D
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs">ربط وتكامل Discord Webhook</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">يرسل كروت مميزة للمشرفين في قنوات الديسكود الخاصة بك.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-400">رابط Webhook الخاص بقناتك:</label>
                    <input
                      type="url"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={integrationSettings.discordWebhookUrl}
                      onChange={(e) =>
                        setIntegrationSettings({
                          ...integrationSettings,
                          discordWebhookUrl: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-850 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-900">
                    <div className="w-8 h-8 rounded bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                      T
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs">ربط وتكامل Telegram Bot</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">احصل على إشعارات فورية عبر تطبيق Telegram على هاتفك.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-400">توكن البوت (Bot Token):</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsT..."
                        value={integrationSettings.telegramBotToken}
                        onChange={(e) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            telegramBotToken: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-400">معرف الشات المستهدف (Chat ID):</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors"
                        placeholder="مثال: -100155234546"
                        value={integrationSettings.telegramChatId}
                        onChange={(e) =>
                          setIntegrationSettings({
                            ...integrationSettings,
                            telegramChatId: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 px-8 rounded-xl transition-all shadow-lg shadow-red-900/30 cursor-pointer"
                  >
                    حفظ وإقرار التغييرات الفنية
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* Interactive Modal: New Report Case Submission */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-6">
          <div className="max-w-xl w-full bg-slate-900 rounded-3xl border border-slate-800 p-8 flex flex-col max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormError('');
                setFormSuccess('');
              }}
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-950 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
            >
              ×
            </button>

            <div className="mb-6 border-b border-slate-800 pb-4">
              <h3 className="font-extrabold text-white text-base">إنشاء وتسجيل بلاغ مجتمعي جديد</h3>
              <p className="text-xs text-slate-500 mt-1">تأكد من مطابقة الروابط للتيك توك الرسمي لنجاح عملية الفرز والنسخ التلقائي.</p>
            </div>

            {formError && (
              <div className="mb-4 p-3.5 bg-red-500/15 border border-red-500/20 rounded-xl text-red-400 text-xs flex gap-2 items-center">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3.5 bg-green-500/15 border border-green-500/20 rounded-xl text-green-400 text-xs flex gap-2 items-center">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">الرابط المباشر (فيديو أو حساب TikTok): *</label>
                <input
                  type="url"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-650 focus:outline-none focus:border-red-500/50 transition-colors text-right direction-ltr font-mono"
                  placeholder="https://www.tiktok.com/@username/video/1234..."
                  value={newTiktokLink}
                  onChange={(e) => setNewTiktokLink(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">نوع المخالفة والتجاوز:</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 focus:outline-none focus:border-red-500/50 transition-colors"
                  value={newViolationType}
                  onChange={(e) => setNewViolationType(e.target.value)}
                >
                  <option value="انتحال شخصية">انتحال شخصية / حسابات وهمية</option>
                  <option value="تنمر">مضايقات وتشويه سمعة / تنمر لفظي</option>
                  <option value="خطاب كراهية">خطاب الكراهية والتعصب العرقي</option>
                  <option value="محتوى عنيف">محتوى عنيف أو مروج للجريمة</option>
                  <option value="إيذاء النفس">نشر إيذاء النفس أو خطورة الانتحار</option>
                  <option value="اسم مسيء">اسم معرّف أو حساب مسيء للأخلاق العامة</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">الوصف التفصيلي والدليل التوثيقي: *</label>
                <textarea
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 transition-colors h-24 resize-none"
                  placeholder="يرجى كتابة تحليل واضح للتجاوز وأوقات حدوثه أو المقاطع المغرضة لتسهيل صياغة البلاغ..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-slate-300">رابط صورة أو لقطة الشاشة (اختياري):</label>
                <input
                  type="url"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-xs text-slate-100 placeholder:text-slate-650 focus:outline-none focus:border-red-500/50 transition-colors text-right direction-ltr"
                  placeholder="https://..."
                  value={newEvidenceUrl}
                  onChange={(e) => setNewEvidenceUrl(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="flex-1 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-900/30 cursor-pointer"
                >
                  {submittingReport ? 'جاري الرصد والنشر لجميع الأعضاء والمشرفين...' : 'تسجيل وإرسال الإشعارات 🚨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TikTok Support Legal Assistance Modal */}
      {isSupportModalOpen && selectedReportIdx && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 rounded-3xl border border-slate-800 p-8 flex flex-col max-h-[95vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => {
                setIsSupportModalOpen(false);
                setCopiedField(null);
              }}
              className="absolute top-5 left-5 w-8 h-8 rounded-full bg-slate-950 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
            >
              ×
            </button>

            <div className="mb-6 border-b border-slate-800 pb-4 text-right">
              <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-500/20">
                مساعد الدعم الفني والشكاوى القانونية للتيك توك
              </span>
              <h3 className="font-extrabold text-white text-lg mt-2 flex items-center gap-2 justify-end">
                <span>تقديم شكوى/بلاغ رسمي للدعم الفني (TikTok Legal Support)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تساعدك هذه النافذة على صياغة شكوى رسمية ممتازة وفقاً لمعايير تيك توك وتوجيهك لرفعها فوراً للدعم الفني.
              </p>
            </div>

            <div className="space-y-5 text-right">
              {/* Steps Guide */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                <h4 className="text-xs font-bold text-red-400">خطوات تقديم التقرير لتيك توك بنجاح:</h4>
                <ul className="text-xs text-slate-300 space-y-2 list-none pr-0">
                  <li className="flex gap-2 items-start justify-start flex-row-reverse">
                    <span className="bg-red-500/10 text-red-400 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5">1</span>
                    <span className="flex-1 text-right">انسخ البيانات والتقرير الموصى به بالأسفل باستخدام أزرار النسخ السريعة.</span>
                  </li>
                  <li className="flex gap-2 items-start justify-start flex-row-reverse">
                    <span className="bg-red-500/10 text-red-400 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5">2</span>
                    <span className="flex-1 text-right">اضغط على زر <strong>"افتح نموذج الدعم الفني والشكاوى القانونية"</strong> بالأسفل لفتح صفحة مراجعة تيك توك الرسمية.</span>
                  </li>
                  <li className="flex gap-2 items-start justify-start flex-row-reverse">
                    <span className="bg-red-500/10 text-red-400 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5">3</span>
                    <span className="flex-1 text-right">قم بلصق البيانات هناك (البريد الإلكتروني، رابط الحساب، وتقرير المراجعة) ثم أرسل الطلب للحظر النهائي.</span>
                  </li>
                </ul>
              </div>

              {/* Data Fields */}
              <div className="space-y-4">
                {/* Field 1: Support URL */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <label className="text-xs font-bold text-slate-400">رابط تيك توك للدعم والشكاوى (Feedback URL):</label>
                    {copiedField === 'supportUrl' && (
                      <span className="text-[10px] text-green-400 font-bold">تم النسخ!</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('https://www.tiktok.com/legal/report/feedback');
                        setCopiedField('supportUrl');
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-4 rounded-xl text-xs text-slate-300 font-medium transition cursor-pointer"
                    >
                      نسخ
                    </button>
                    <input
                      type="text"
                      readOnly
                      value="https://www.tiktok.com/legal/report/feedback"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-300 font-mono direction-ltr"
                    />
                  </div>
                </div>

                {/* Field 2: Target Link */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <label className="text-xs font-bold text-slate-400">رابط الحساب / الفيديو المخالف المستهدف:</label>
                    {copiedField === 'tiktokLink' && (
                      <span className="text-[10px] text-green-400 font-bold">تم النسخ!</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedReportIdx.tiktokLink);
                        setCopiedField('tiktokLink');
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-4 rounded-xl text-xs text-slate-300 font-medium transition cursor-pointer"
                    >
                      نسخ الرابط
                    </button>
                    <input
                      type="text"
                      readOnly
                      value={selectedReportIdx.tiktokLink}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-300 font-mono direction-ltr"
                    />
                  </div>
                </div>

                {/* Field 3: Target Username */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <label className="text-xs font-bold text-slate-400">اسم المستخدم المخالف (Username):</label>
                    {copiedField === 'username' && (
                      <span className="text-[10px] text-green-400 font-bold">تم النسخ!</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(getTiktokUsername(selectedReportIdx.tiktokLink));
                        setCopiedField('username');
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-4 rounded-xl text-xs text-slate-300 font-medium transition cursor-pointer"
                    >
                      نسخ المعرّف
                    </button>
                    <input
                      type="text"
                      readOnly
                      value={getTiktokUsername(selectedReportIdx.tiktokLink)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs text-slate-300 font-mono direction-ltr"
                    />
                  </div>
                </div>

                {/* Field 4: Custom Auto-generated detailed support report */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center flex-row-reverse">
                    <label className="text-xs font-bold text-slate-400">صيغة البلاغ والتقدير الفني المجهّز للدعم ( جاهز للإرسال ):</label>
                    {copiedField === 'reportText' && (
                      <span className="text-[10px] text-green-400 font-bold">تم نسخ التقرير كاملاً بنجاح!</span>
                    )}
                  </div>
                  <textarea
                    readOnly
                    rows={6}
                    value={generateDetailedReportText(selectedReportIdx)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none transition-colors h-36 resize-none block font-sans leading-relaxed text-right"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateDetailedReportText(selectedReportIdx));
                      setCopiedField('reportText');
                      setTimeout(() => setCopiedField(null), 1500);
                    }}
                    className="w-full py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-red-400 font-bold rounded-xl transition cursor-pointer flex justify-center items-center gap-2"
                  >
                    📋 نسخ التقرير التفصيلي والخطاب المجهّز بالكامل
                  </button>
                </div>
              </div>

              {/* Action Buttons to launch support page and direct video URL */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <a
                  href="https://www.tiktok.com/legal/report/feedback"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={async () => {
                    // Log the additional technical support transition
                    try {
                      await fetch(`/api/reports/${selectedReportIdx.id}/action`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          type: 'CLICKED_REPORT',
                          details: `العضو قام بفتح موقع الدعم الفني والشكاوى الرسمي للتيك توك لإرسال التقرير يدوياً.`,
                        }),
                      });
                      fetchSingleReportDetails(selectedReportIdx.id);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-800 hover:scale-[1.01] transition-transform text-white rounded-xl font-bold text-xs text-center shadow-lg shadow-red-950/50 cursor-pointer flex justify-center items-center gap-2"
                >
                  🌐 فتح نموذج الدعم الفني والشكاوى في تيك توك الآن
                </a>

                <div className="flex gap-2.5">
                  <button
                    onClick={() => {
                      setIsSupportModalOpen(false);
                      setCopiedField(null);
                    }}
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    إغلاق المساعد
                  </button>
                  <a
                    href={selectedReportIdx.tiktokLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer flex justify-center items-center gap-1.5"
                  >
                    الانتقال للمقطع للتأكيد يدوياً <ExternalLink className="w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
