export const VERIFICATION_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Verify Your Email</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p>Thank you for signing up! Your verification code is:</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4CAF50;">{verificationCode}</span>
    </div>
    <p>Enter this code on the verification page to complete your registration.</p>
    <p>This code will expire in 15 minutes for security reasons.</p>
    <p>If you didn't create an account with us, please ignore this email.</p>
    <p>Best regards,<br>Your App Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;
export const WELCOME_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Your App</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f2f2f2;">
  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Welcome to {appName}!</h1>
  </div>

  <div style="background-color: #fff; padding: 25px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p style="margin-top: 0;">Hi {userName},</p>

    <p>We're excited to have you join the {appName} community! You’ve successfully created your account and are ready to explore everything we have to offer.</p>

    <p>To help you get started, here are a few quick tips:</p>
    <ul style="padding-left: 20px; margin: 10px 0;">
      <li>Sign in using your email: <strong>{userEmail}</strong></li>
      <li>Customize your profile to make it yours</li>
      <li>Start exploring your dashboard</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{loginUrl}" style="background: #4CAF50; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; display: inline-block;">
        Go to Dashboard
      </a>
    </div>

    <p>If you have any questions or need support, simply reply to this email or visit our <a href="{supportUrl}" style="color: #4CAF50; text-decoration: none;">Help Center</a>.</p>

    <p>We’re thrilled to have you with us.<br>— The {appName} Team</p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message from {appName}. Please do not reply directly to this email.</p>
  </div>
</body>
</html>
`;

export const PASSWORD_RESET_SUCCESS_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Password Reset Successful</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.7; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center; border-radius: 6px 6px 0 0;">
    <h1 style="color: white; margin: 0;">Password Reset Successful</h1>
  </div>

  <div style="background-color: #ffffff; padding: 25px 20px; border-radius: 0 0 6px 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
    <p style="margin-top: 0;">Hi <strong>{userName}</strong>,</p>

    <p>We wanted to let you know that your password for <strong>{appName}</strong> has been successfully reset.</p>

    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #4CAF50; color: white; width: 60px; height: 60px; line-height: 60px; border-radius: 50%; display: inline-block; font-size: 32px; font-weight: bold;">
        ✓
      </div>
    </div>

    <p>If you did not request this change, please contact our support team immediately at 
      <a href="{supportUrl}" style="color: #4CAF50; text-decoration: none;">Support</a>.
    </p>

    <p>For your account’s safety, we recommend that you:</p>
    <ul style="margin: 15px 0; padding-left: 20px;">
      <li>Use a strong and unique password</li>
      <li>Enable two-factor authentication if available</li>
      <li>Never reuse passwords across multiple accounts</li>
    </ul>

    <p>Thank you for taking the time to secure your account.<br>
    — The <strong>{appName}</strong> Team</p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message from {appName}. Please do not reply directly to this email.</p>
  </div>
</body>
</html>
`;

export const PASSWORD_RESET_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Password Reset</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello,</p>
    <p>We received a request to reset your password. If you didn't make this request, please ignore this email.</p>
    <p>To reset your password, click the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{resetURL}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
    </div>
    <p>This link will expire in 1 hour for security reasons.</p>
    <p>Best regards,<br>Your App Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;
