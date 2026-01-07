import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    // For development, create a test account
    if (this.configService.get('NODE_ENV') === 'development') {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Test email account: ${testAccount.user}`);
    } else {
      // For production, use real SMTP
      this.transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT'),
        secure: false,
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const from = this.configService.get('SMTP_FROM') || 'noreply@ecommerce.com';
      
      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.log(`Email sent: ${nodemailer.getTestMessageUrl(info)}`);
      }

      this.logger.log(`Email sent to ${options.to}`);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }
}