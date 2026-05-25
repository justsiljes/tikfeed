/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'ADMIN' | 'MODERATOR' | 'MEMBER';

export type ReportStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Report {
  id: string;
  tiktokLink: string;
  violationType: string;
  description: string;
  evidenceUrl?: string;
  status: ReportStatus;
  userId: string; // creator ID
  userName: string; // creator Name
  createdAt: string;
}

export interface ActionLog {
  id: string;
  reportId: string;
  userId: string;
  userName: string;
  userRole: Role;
  type: 'CREATED' | 'VIEWED' | 'CLICKED_REPORT' | 'STATUS_CHANGED' | 'RESOLVED';
  details?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  reportId: string;
  userId: string;
  userName: string;
  userRole: Role;
  text: string;
  createdAt: string;
}

export interface IntegrationSettings {
  discordWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface DashboardStats {
  totalReports: number;
  openReports: number;
  inProgressReports: number;
  closedReports: number;
  totalMembers: number;
  violationTypeCounts: Record<string, number>;
  reportsTimeline: { date: string; count: number }[];
}
