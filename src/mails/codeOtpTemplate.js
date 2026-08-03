const codeOtpTemplate = (
  otp,
  duration,
  nameUser,
  time,
  deviceName,
  ipAddress,
) => {
  return `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>OTP Verification Email</title>
    <style>
        /* Base styles for email clients */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        body {
            background-color: #f4f7fc;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }

        /* Container */
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }

        /* Header */
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px 30px;
            text-align: center;
        }

        .email-header .logo {
            font-size: 28px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .email-header .logo span {
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 12px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 600;
        }

        .email-header h1 {
            color: #ffffff;
            font-size: 26px;
            font-weight: 700;
            margin-top: 12px;
            margin-bottom: 4px;
        }

        .email-header p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 15px;
            margin-top: 4px;
        }

        /* Body */
        .email-body {
            padding: 40px 30px 30px;
        }

        .greeting {
            font-size: 16px;
            color: #1f3a5f;
            margin-bottom: 8px;
        }

        .greeting strong {
            color: #0b1e30;
        }

        .message {
            color: #5f7a9a;
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 28px;
        }

        /* OTP Code Box */
        .otp-box {
            background: #f8fbff;
            border: 2px dashed #dce5f2;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            margin: 20px 0 28px;
        }

        .otp-code {
            font-size: 42px;
            font-weight: 800;
            letter-spacing: 12px;
            color: #1f4973;
            font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
            background: white;
            padding: 12px 20px;
            border-radius: 12px;
            display: inline-block;
            border: 1px solid #e6edf6;
        }

        .otp-label {
            font-size: 13px;
            color: #5f7a9a;
            margin-top: 8px;
            display: block;
        }

        /* Timer / Expiry */
        .expiry-info {
            background: #fff8e6;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 20px 0 24px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .expiry-info .icon {
            font-size: 20px;
        }

        .expiry-info .text {
            font-size: 14px;
            color: #8d6d1f;
        }

        .expiry-info .text strong {
            color: #6b4f0e;
        }

        /* Divider */
        .divider {
            border: none;
            height: 1px;
            background: #e9eff6;
            margin: 24px 0;
        }

        /* Button */
        .btn-primary {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 16px;
            text-align: center;
            transition: all 0.3s;
            border: none;
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);
        }

        .btn-secondary {
            display: inline-block;
            background: #f0f4fa;
            color: #1f3a5f;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            border: 1px solid #dce5f2;
            transition: all 0.3s;
            width: 100%;
            box-sizing: border-box;
            margin-top: 8px;
        }

        .btn-secondary:hover {
            background: #e3eaf3;
        }

        .button-group {
            margin: 24px 0 16px;
        }

        /* Footer */
        .email-footer {
            padding: 20px 30px 30px;
            border-top: 1px solid #e9eff6;
            text-align: center;
        }

        .email-footer p {
            color: #b0c4de;
            font-size: 13px;
            line-height: 1.6;
            margin-bottom: 6px;
        }

        .email-footer .links {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
            flex-wrap: wrap;
        }

        .email-footer .links a {
            color: #667eea;
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
        }

        .email-footer .links a:hover {
            text-decoration: underline;
        }

        .email-footer .company {
            color: #b0c4de;
            font-size: 12px;
            margin-top: 12px;
        }

        /* Security Note */
        .security-note {
            background: #f0f7ff;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 20px 0 0;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }

        .security-note .icon {
            font-size: 18px;
            margin-top: 2px;
        }

        .security-note .text {
            font-size: 13px;
            color: #3a5a7a;
            line-height: 1.5;
        }

        .security-note .text strong {
            color: #1f3a5f;
        }

        /* Responsive */
        @media (max-width: 480px) {
            .email-container {
                border-radius: 16px;
            }

            .email-header {
                padding: 30px 20px 24px;
            }

            .email-header h1 {
                font-size: 22px;
            }

            .email-body {
                padding: 28px 20px 20px;
            }

            .otp-code {
                font-size: 32px;
                letter-spacing: 10px;
                padding: 10px 16px;
            }

            .otp-box {
                padding: 18px;
            }

            .expiry-info {
                flex-direction: column;
                align-items: flex-start;
            }

            .email-footer {
                padding: 20px 20px 24px;
            }

            .email-footer .links {
                flex-direction: column;
                gap: 8px;
            }
        }

        /* Dark mode support for email clients */
        @media (prefers-color-scheme: dark) {
            body {
                background-color: #1a1a2e;
            }

            .email-container {
                background: #16213e;
            }

            .email-body {
                background: #16213e;
            }

            .greeting {
                color: #e0e7ff;
            }

            .greeting strong {
                color: #ffffff;
            }

            .message {
                color: #a0b4d0;
            }

            .otp-box {
                background: #1a2744;
                border-color: #2a3a5c;
            }

            .otp-code {
                background: #16213e;
                border-color: #2a3a5c;
                color: #a0c4ff;
            }

            .otp-label {
                color: #7a94b8;
            }

            .expiry-info {
                background: #2a2416;
                border-left-color: #f59e0b;
            }

            .expiry-info .text {
                color: #f5c542;
            }

            .expiry-info .text strong {
                color: #f5d78a;
            }

            .divider {
                background: #2a3a5c;
            }

            .btn-secondary {
                background: #1a2744;
                color: #a0b4d0;
                border-color: #2a3a5c;
            }

            .btn-secondary:hover {
                background: #243457;
            }

            .email-footer {
                border-top-color: #2a3a5c;
            }

            .email-footer p {
                color: #5a7a9a;
            }

            .email-footer .links a {
                color: #7aa0e0;
            }

            .email-footer .company {
                color: #4a6a8a;
            }

            .security-note {
                background: #1a2744;
            }

            .security-note .text {
                color: #7a9ab8;
            }

            .security-note .text strong {
                color: #a0c0e0;
            }
        }
    </style>
</head>
<body>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fc; padding: 20px 10px;">
    <tr>
        <td align="center" style="padding: 20px 0;">
            <!-- Main Container -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
                <tr>
                    <td>
                        <!-- Header -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px 30px; text-align: center;">
                            <tr>
                                <td>
                                    <div style="font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                        🔐 Secure
                                    </div>
                                    <h1 style="color: #ffffff; font-size: 26px; font-weight: 700; margin-top: 12px; margin-bottom: 4px;">Verification Code</h1>
                                    <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin-top: 4px;">Use this code to complete your action</p>
                                </td>
                            </tr>
                        </table>

                        <!-- Body -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 30px 30px;">
                            <tr>
                                <td>
                                    <div class="greeting" style="font-size: 16px; color: #1f3a5f; margin-bottom: 8px;">
                                        Hello <strong style="color: #0b1e30;">${nameUser}</strong> 👋
                                    </div>

                                    <div class="message" style="color: #5f7a9a; font-size: 15px; line-height: 1.6; margin-bottom: 28px;">
                                        We received a request to verify your identity. Use the 6-digit code below to complete your verification. This code is valid for the next <strong>${duration}  minutes</strong>.
                                    </div>

                                    <!-- OTP Code Box -->
                                    <div class="otp-box" style="background: #f8fbff; border: 2px dashed #dce5f2; border-radius: 16px; padding: 24px; text-align: center; margin: 20px 0 28px;">
                                        <div class="otp-code" style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #1f4973; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; background: white; padding: 12px 20px; border-radius: 12px; display: inline-block; border: 1px solid #e6edf6;">
                                            ${otp}
                                        </div>
                                        <span class="otp-label" style="font-size: 13px; color: #5f7a9a; margin-top: 8px; display: block;">Your one-time verification code</span>
                                    </div>

                                    <!-- Expiry Info -->
                                    <div class="expiry-info" style="background: #fff8e6; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin: 20px 0 24px; display: flex; align-items: center; gap: 10px;">
                                        <span class="icon" style="font-size: 20px;">⏱️</span>
                                        <span class="text" style="font-size: 14px; color: #8d6d1f;">
                                            This code expires in <strong style="color: #6b4f0e;">${duration} minutes</strong>
                                        </span>
                                    </div>

                                    <hr class="divider" style="border: none; height: 1px; background: #e9eff6; margin: 24px 0;" />

                                    <!-- Security Note -->
                                    <div class="security-note" style="background: #f0f7ff; border-radius: 12px; padding: 16px 20px; margin: 20px 0 0; display: flex; align-items: flex-start; gap: 12px;">
                                        <span class="icon" style="font-size: 18px; margin-top: 2px;">🛡️</span>
                                        <div class="text" style="font-size: 13px; color: #3a5a7a; line-height: 1.5;">
                                            <strong style="color: #1f3a5f;">Security Tip:</strong> Never share this code with anyone. Our team will never ask for your verification code.
                                        </div>
                                    </div>

                                    <!-- Additional Info -->
                                    <div style="margin-top: 20px; padding: 12px 16px; background: #fafcfd; border-radius: 12px; border: 1px solid #e9eff6;">
                                        <p style="font-size: 13px; color: #5f7a9a; margin: 0; line-height: 1.5;">
                                            <strong>📍 Request Details:</strong><br />
                                            IP Address: ${ipAddress}<br />
                                            Device: ${deviceName}<br />
                                            Time: ${time}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <!-- Footer -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 20px 30px 30px; border-top: 1px solid #e9eff6; text-align: center;">
                            <tr>
                                <td>
                                    <p style="color: #b0c4de; font-size: 13px; line-height: 1.6; margin-bottom: 6px;">
                                        If you didn't request this code, please ignore this email or
                                        <a href="#" style="color: #667eea; text-decoration: none; font-weight: 500;">contact support</a>
                                        immediately.
                                    </p>

                                    <div class="links" style="display: flex; justify-content: center; gap: 20px; margin-top: 10px; flex-wrap: wrap;">
                                        <a href="#" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Privacy Policy</a>
                                        <a href="#" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Terms of Service</a>
                                        <a href="#" style="color: #667eea; text-decoration: none; font-size: 13px; font-weight: 500;">Help Center</a>
                                    </div>

                                    <div class="company" style="color: #b0c4de; font-size: 12px; margin-top: 12px;">
                                        © 2026 SecureOTP Inc. All rights reserved.<br />
                                        123 Security Blvd, San Francisco, CA 94105
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- Footer note -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 16px auto 0;">
                <tr>
                    <td align="center">
                        <p style="color: #8aa0c0; font-size: 12px; margin: 0;">
                            This is an automated email, please do not reply.
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
};

export default codeOtpTemplate;
