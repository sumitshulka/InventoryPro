import nodemailer from 'nodemailer';
import { EmailSettings } from '@shared/schema';

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private settings: EmailSettings | null = null;

  constructor(settings?: EmailSettings) {
    if (settings) {
      this.configure(settings);
    }
  }

  configure(settings: EmailSettings) {
    this.settings = settings;
    
    switch (settings.provider.toLowerCase()) {
      case 'smtp':
        this.transporter = nodemailer.createTransport({
          host: settings.host!,
          port: settings.port!,
          secure: settings.secure,
          auth: {
            user: settings.username!,
            pass: settings.password!,
          },
        });
        break;
        
      case 'gmail':
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: settings.username!,
            pass: settings.password!, // App password
          },
        });
        break;
        
      case 'outlook':
        // For Outlook/Office365, use OAuth2 or suggest alternative
        this.transporter = nodemailer.createTransport({
          service: 'Outlook365',
          auth: {
            user: settings.username!,
            pass: settings.password!,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });
        break;
        
      case 'sendgrid':
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: settings.password!, // SendGrid API key
          },
        });
        break;
        
      default:
        throw new Error(`Unsupported email provider: ${settings.provider}`);
    }
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    if (!this.transporter || !this.settings) {
      throw new Error('Email service not configured');
    }

    try {
      const mailOptions = {
        from: `"${this.settings.fromName}" <${this.settings.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      };

      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error: any) {
      console.error('Email connection test failed:', error);
      
      // Provide more specific error messages
      if (error.code === 'EAUTH') {
        if (error.response?.includes('basic authentication is disabled')) {
          throw new Error('Basic authentication is disabled for this email provider. For Outlook/Office365, you need to use an App Password instead of your regular password. Please generate an App Password from your account settings and use that instead.');
        } else if (error.response?.includes('Username and Password not accepted')) {
          throw new Error('Invalid username or password. Please check your credentials and try again.');
        } else {
          throw new Error('Authentication failed. Please verify your username and password are correct.');
        }
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('SMTP server not found. Please check the host address.');
      } else if (error.code === 'ECONNECTION') {
        throw new Error('Unable to connect to SMTP server. Please check the host and port settings.');
      } else {
        throw new Error(`Email connection failed: ${error.message}`);
      }
    }
  }

  async sendTestEmail(testEmail: string): Promise<boolean> {
    if (!this.settings) {
      throw new Error('Email service not configured');
    }

    return await this.sendEmail({
      to: testEmail,
      subject: 'Email Configuration Test',
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p><strong>Provider:</strong> ${this.settings.provider}</p>
        <p><strong>From:</strong> ${this.settings.fromName} &lt;${this.settings.fromEmail}&gt;</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p>If you received this email, your configuration is working properly!</p>
      `,
      text: `Email Configuration Test

This is a test email to verify your email configuration is working correctly.

Provider: ${this.settings.provider}
From: ${this.settings.fromName} <${this.settings.fromEmail}>
Time: ${new Date().toLocaleString()}

If you received this email, your configuration is working properly!`
    });
  }
}

// Global email service instance
let emailService: EmailService | null = null;

export function getEmailService(): EmailService | null {
  return emailService;
}

export function initializeEmailService(settings: EmailSettings): EmailService {
  emailService = new EmailService(settings);
  return emailService;
}

export function resetEmailService(): void {
  emailService = null;
}