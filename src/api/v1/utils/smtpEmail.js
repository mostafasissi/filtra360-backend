const nodemailer = require("nodemailer");
require("dotenv").config();

// Create SMTP transporter for Fitra360 using Hostinger
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.hostinger.com", // Hostinger SMTP server
    port: 587, // TLS port
    secure: false, // true for 465, false for other ports
    auth: {
      user: "hello@fitra360.com",
      pass: "WelcomeFitra360!",
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Generate a random 6-digit OTP using crypto for better security
const generateOTP = () => {
  const crypto = require('crypto');
  return crypto.randomInt(100000, 999999).toString();
};

// Send OTP email for verification
const sendOTPEmail = async (email, otp, purpose = "verification") => {
  try {
    const transporter = createTransporter();
    
    let subject, htmlContent;
    
    if (purpose === "verification") {
      subject = "Your Fitra360 Verification Code";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Fitra360</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your Health & Wellness Partner</p>
          </div>
          
          <div style="background-color: white; padding: 40px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Thank you for choosing Fitra360! Please use the verification code below to complete your account setup.
            </p>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</div>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              This code will expire in 10 minutes for security reasons.
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; text-align: center;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
              If you didn't request this verification code, please ignore this email.
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
              For support, contact us at <a href="mailto:hello@fitra360.com" style="color: #667eea; text-decoration: none;">hello@fitra360.com</a>
            </p>
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2025 Fitra360. All rights reserved.
            </p>
          </div>
        </div>
      `;
    } else if (purpose === "password-reset") {
      subject = "Reset Your Fitra360 Password";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Fitra360</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your Health & Wellness Partner</p>
          </div>
          
          <div style="background-color: white; padding: 40px; text-align: center;">
            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              We received a request to reset your password. Use the verification code below to create a new password.
            </p>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${otp}</div>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              This code will expire in 10 minutes for security reasons.
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; text-align: center;">
            <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
              For support, contact us at <a href="mailto:hello@fitra360.com" style="color: #667eea; text-decoration: none;">hello@fitra360.com</a>
            </p>
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2025 Fitra360. All rights reserved.
            </p>
          </div>
        </div>
      `;
    }

    const mailOptions = {
      from: '"Fitra360" <hello@fitra360.com>',
      to: email,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent successfully to: ${email}`);
    console.log(`📧 Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, fullName) => {
  try {
    const transporter = createTransporter();
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Fitra360</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your Health & Wellness Partner</p>
        </div>
        
        <div style="background-color: white; padding: 40px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to Fitra360! 🎉</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Hello ${fullName || 'there'}!
          </p>
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Welcome to Fitra360! We're excited to have you on board and help you on your health and wellness journey.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">What's Next?</h3>
            <ul style="color: #666; font-size: 14px; text-align: left; line-height: 1.8;">
              <li>Complete your profile setup</li>
              <li>Explore personalized health plans</li>
              <li>Track your wellness progress</li>
              <li>Connect with health experts</li>
            </ul>
          </div>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; text-align: center;">
          <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
            Ready to get started? Log in to your account and begin your wellness journey!
          </p>
          <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
            For support, contact us at <a href="mailto:hello@fitra360.com" style="color: #667eea; text-decoration: none;">hello@fitra360.com</a>
          </p>
          <p style="color: #999; font-size: 12px; margin: 0;">
            © 2025 Fitra360. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: '"Fitra360" <hello@fitra360.com>',
      to: email,
      subject: "Welcome to Fitra360 - Your Health Journey Begins!",
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent successfully to: ${email}`);
    console.log(`📧 Message ID: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
};

// Test SMTP connection
const testSMTPConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully!");
    return true;
  } catch (error) {
    console.error("❌ SMTP connection failed:", error);
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  generateOTP,
  testSMTPConnection,
}; 