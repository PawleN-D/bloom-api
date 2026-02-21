interface UserInviteTemplateVars {
  user_name: string;
  user_email: string;
  temp_password: string;
}

export function buildUserInviteEmail({
  user_name,
  user_email,
  temp_password,
}: UserInviteTemplateVars): string {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8" /></head>
  <body style="font-family: sans-serif; background: #F7F5F2; margin: 0; padding: 0;">
    <div style="max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden;">
      <div style="background: #0F766E; padding: 32px 40px;">
        <h1 style="color: #fff; font-size: 22px; margin: 0;">Your Bloom account is ready</h1>
      </div>
      <div style="padding: 32px 40px;">
        <p>Hi ${user_name},</p>
        <p>An account has been created for you on Bloom Care Platform.</p>
        <p><strong>Login details:</strong></p>
        <p>Email: <code>${user_email}</code></p>
        <p>Temporary password: <code>${temp_password}</code></p>
        <p style="color: #F97316; font-size: 13px;">
          You will be asked to set a new password on first login.
        </p>
      </div>
      <div style="padding: 20px 40px; font-size: 12px; color: #9CA3AF;">
        Bloom Care Platform - onboarding@bloom.care
      </div>
    </div>
  </body>
  </html>`;
}
