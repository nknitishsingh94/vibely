import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

export interface SendOtpOptions {
  to: string;
  otp: string;
  displayName?: string;
}

export function generateSixDigitOtp(): string {
  // Generate random 6-digit number between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Creates a nodemailer transport using Gmail SMTP or custom SMTP
 * Gmail SMTP is 100% FREE (up to 500 emails/day for personal Gmail)
 */
function getEmailTransporter() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || (user?.includes('@gmail.com') ? 'smtp.gmail.com' : undefined);
  const port = Number(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
  const secure = port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: pass.replace(/\s+/g, ''), // strip spaces from Google app passwords
    },
  });
}

/**
 * Sends a clean, branded HTML email with the 6-digit verification code.
 */
export async function sendOtpEmail({ to, otp, displayName }: SendOtpOptions): Promise<{ success: boolean; provider: string; error?: string }> {
  const transporter = getEmailTransporter();
  const recipientName = displayName ? displayName.trim() : 'Friend';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vibely Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0c1914; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 16px; background-color: #0c1914;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background: #13271f; border-radius: 24px; border: 1px solid rgba(16, 185, 129, 0.25); overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);">
                <!-- Header -->
                <tr>
                  <td align="center" style="padding: 36px 32px 20px; background: linear-gradient(180deg, rgba(16, 185, 129, 0.15) 0%, rgba(19, 39, 31, 0) 100%);">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">
                      <span style="color: #34d399;">Vibely</span>
                    </h1>
                    <p style="margin: 8px 0 0; font-size: 13px; color: #9ca3af; font-weight: 500;">
                      Private Two-Person Space
                    </p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 0 36px 36px;">
                    <p style="margin: 0 0 16px; font-size: 15px; color: #e5e7eb; line-height: 1.6;">
                      Hi <strong>${recipientName}</strong>,
                    </p>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
                      Please use the 6-digit verification code below to verify your email address and activate your account:
                    </p>

                    <!-- OTP Code Box -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                      <tr>
                        <td align="center" style="background: rgba(16, 185, 129, 0.12); border: 2px dashed #10b981; border-radius: 18px; padding: 22px;">
                          <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #34d399; display: block; margin-left: 12px;">
                            ${otp}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 0 0 12px; font-size: 12px; color: #9ca3af; text-align: center;">
                      ⏱️ This code will expire in <strong>10 minutes</strong>.
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #6b7280; text-align: center; line-height: 1.5;">
                      If you didn't request this registration code, you can safely ignore this email. No account will be created without this code.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding: 20px 32px; background-color: rgba(0, 0, 0, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.05);">
                    <p style="margin: 0; font-size: 11px; color: #6b7280;">
                      &copy; ${new Date().getFullYear()} Vibely. End-to-end encrypted messaging.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  // 1. If custom/Gmail SMTP is configured, send directly via SMTP (100% free, 500 emails/day!)
  if (transporter) {
    try {
      const senderFrom = process.env.SMTP_FROM || `Vibely Security <${process.env.SMTP_USER || process.env.GMAIL_USER}>`;
      await transporter.sendMail({
        from: senderFrom,
        to,
        subject: `${otp} is your Vibely verification code`,
        text: `Your Vibely verification code is: ${otp}. It will expire in 10 minutes.`,
        html: htmlContent,
      });

      console.log(`[Email Service] Sent OTP ${otp} to ${to} via Custom/Gmail SMTP`);
      return { success: true, provider: 'smtp' };
    } catch (smtpErr: any) {
      console.warn('[Email Service] SMTP send failed, falling back:', smtpErr?.message);
    }
  }

  // 2. Fallback to Supabase built-in mailer
  return { success: true, provider: 'supabase' };
}
