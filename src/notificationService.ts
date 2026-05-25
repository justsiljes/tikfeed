/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Report, IntegrationSettings } from './types';

export async function sendDiscordNotification(report: Report, settings: IntegrationSettings) {
  if (!settings.discordWebhookUrl) return;

  try {
    const embed = {
      title: '🚨 بلاغ مجتمعي جديد على تيك توك',
      description: `تم رصد مخالفة جديدة وتتطلب مراجعة من المشرفين والأعضاء.`,
      color: 0xff0050, // TikTok Red/Pink hue
      fields: [
        { name: 'نوع المخالفة', value: report.violationType, inline: true },
        { name: 'حالة البلاغ', value: report.status === 'OPEN' ? 'مفتوح 🟢' : report.status === 'IN_PROGRESS' ? 'قيد المعالجة 🟡' : 'مغلق 🔴', inline: true },
        { name: 'الرابط المباشر للهدف', value: report.tiktokLink },
        { name: 'الوصف والتفاصيل', value: report.description || 'لا يوجد وصف تفصيلي.' },
        { name: 'المبلّغ المكتشف', value: report.userName, inline: true },
        { name: 'معرف البلاغ', value: report.id, inline: true }
      ],
      footer: { text: 'منصة إدارة بلاغات مجتمع تيك توك الإشرافية' },
      timestamp: new Date().toISOString()
    };

    const payload = {
      username: 'مراقب مجتمع تيك توك',
      avatar_url: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=200&auto=format&fit=crop&q=60',
      embeds: [embed]
    };

    const res = await fetch(settings.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('Discord webhook responded with error status:', res.status);
    }
  } catch (error) {
    console.error('Error sending Discord notification:', error);
  }
}

export async function sendTelegramNotification(report: Report, settings: IntegrationSettings) {
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

  try {
    const textMessage = 
      `🚨 *بلاغ مجتمعي جديد على تيك توك* 🚨\n\n` +
      `*نوع المخالفة:* ${report.violationType}\n` +
      `*الرابط المباشر:* ${report.tiktokLink}\n\n` +
      `*الوصف:* \n${report.description || 'لا يوجد وصف.'}\n\n` +
      `*المكتشف:* ${report.userName}\n` +
      `*حالة البلاغ:* مفتوح 🟢\n\n` +
      `📥 _يرجى الدخول للمنصة والضغط على "إبلاغ الآن" للمشاركة في حماية المجتمع_`;

    const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        text: textMessage,
        parse_mode: 'Markdown'
      })
    });

    if (!res.ok) {
      console.error('Telegram API responded with error status:', res.status);
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}
