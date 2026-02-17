import { prisma } from '@/shared/database/prisma';
import { buildWelcomeEmail } from '@/templates/welcomeEmail';
import { buildUserInviteEmail } from '@/templates/userInviteEmail';

export interface WelcomeEmailPayload {
  organizationId: string;
  manager_name: string;
  company_name: string;
  slug: string;
  manager_email: string;
}

export interface UserInvitePayload {
  organizationId: string;
  user_name: string;
  user_email: string;
  temp_password: string;
}

export interface IncidentEscalationPayload {
  organizationId: string;
  incidentId: string;
  title: string;
  severity: string;
  recipientEmail: string;
  organizationName?: string | null;
}

export class MailService {
  private async sendViaResend(params: {
    to: string;
    subject: string;
    html: string;
  }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Bloom <${process.env.FROM_EMAIL ?? 'onboarding@bloom.care'}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    const payload = (await response.json()) as { id?: string; message?: string };
    if (!response.ok) {
      throw new Error(payload.message || `Resend error (${response.status})`);
    }

    return payload;
  }

  private async send(params: {
    organizationId: string;
    recipient: string;
    subject: string;
    template: string;
    html: string;
  }) {
    const log = await prisma.emailLog.create({
      data: {
        organizationId: params.organizationId,
        recipient: params.recipient,
        subject: params.subject,
        template: params.template,
        status: 'PENDING',
      },
    });

    try {
      const data = await this.sendViaResend({
        to: params.recipient,
        subject: params.subject,
        html: params.html,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT',
          providerMsgId: data.id ?? null,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      console.error('[MailService]', error);
    }
  }

  async sendWelcomeEmail(payload: WelcomeEmailPayload) {
    await this.send({
      organizationId: payload.organizationId,
      recipient: payload.manager_email,
      subject: `Welcome to Bloom - ${payload.company_name} is live!`,
      template: 'welcome_onboarding',
      html: buildWelcomeEmail(payload),
    });
  }

  async sendUserInviteEmail(payload: UserInvitePayload) {
    await this.send({
      organizationId: payload.organizationId,
      recipient: payload.user_email,
      subject: 'Your Bloom account is ready',
      template: 'user_invite',
      html: buildUserInviteEmail(payload),
    });
  }

  async sendIncidentEscalationEmail(payload: IncidentEscalationPayload) {
    const title = payload.title || 'Incident escalation';
    const organizationName = payload.organizationName || 'Organization';

    await this.send({
      organizationId: payload.organizationId,
      recipient: payload.recipientEmail,
      subject: `SLA breach: ${title}`,
      template: 'incident_escalation',
      html: `
        <html>
          <body style="font-family: sans-serif; background: #F7F5F2; padding: 24px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px;">
              <h2 style="margin-top: 0; color: #B91C1C;">Incident SLA Breach</h2>
              <p><strong>Organization:</strong> ${organizationName}</p>
              <p><strong>Severity:</strong> ${payload.severity}</p>
              <p><strong>Incident:</strong> ${title}</p>
              <p><strong>Incident ID:</strong> ${payload.incidentId}</p>
              <p>This incident has exceeded its SLA response time and requires immediate review.</p>
            </div>
          </body>
        </html>
      `,
    });
  }
}

export const mailService = new MailService();
