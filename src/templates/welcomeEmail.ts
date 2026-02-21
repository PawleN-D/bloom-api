interface WelcomeTemplateVars {
  manager_name: string;
  company_name: string;
  slug: string;
}

export function buildWelcomeEmail({
  manager_name,
  company_name,
  slug,
}: WelcomeTemplateVars): string {
  const appUrl = `https://${slug}.bloom.com`;

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8" /></head>
  <body style="font-family: sans-serif; background: #F7F5F2; margin: 0; padding: 0;">
    <div style="max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden;">
      <div style="background: #0F766E; padding: 32px 40px;">
        <h1 style="color: #fff; font-size: 22px; margin: 0;">Welcome to Bloom Care Platform</h1>
      </div>
      <div style="padding: 32px 40px;">
        <p>Hi ${manager_name},</p>
        <p><strong>${company_name}</strong> is now live on Bloom.</p>
        <p>Your care management portal is ready:</p>
        <p>
          <a href="${appUrl}"
             style="display: inline-block; background: #0F766E; color: #fff;
                    padding: 14px 28px; border-radius: 8px; text-decoration: none;
                    font-weight: 600;">
            Open ${company_name} Portal ->
          </a>
        </p>
        <p style="color: #6B7280; font-size: 13px;">URL: ${appUrl}</p>
      </div>
      <div style="padding: 20px 40px; font-size: 12px; color: #9CA3AF;">
        Bloom Care Platform - onboarding@bloom.care
      </div>
    </div>
  </body>
  </html>`;
}
