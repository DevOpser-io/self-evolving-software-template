/**
 * Email Service
 * Provides email functionality using AWS SES or Gmail SMTP (fallback)
 * Set USE_SES=false to use Gmail SMTP instead of SES
 */
console.log('========== EMAIL SERVICE LOADING ==========');

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const nodemailer = require('nodemailer');
const config = require('../config');
const { getSecret } = require('./secretsManager');

// Determine which email backend to use
const USE_SES = process.env.USE_SES !== 'false'; // Default to SES unless explicitly disabled

console.log('Email configuration:', {
  USE_SES: USE_SES,
  AWS_REGION: process.env.AWS_REGION || config.aws.region,
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
  MAIL_SERVER: process.env.MAIL_SERVER,
  NODE_ENV: process.env.NODE_ENV
});

// Email client instances
let sesClient = null;
let nodemailerTransporter = null;
let defaultFromEmail = null;

/**
 * Initialize the SES client
 */
function initializeSESClient() {
  try {
    console.log('Initializing AWS SES client...');

    sesClient = new SESClient({
      region: process.env.AWS_REGION || config.aws.region || 'us-east-1'
    });

    defaultFromEmail = process.env.SES_FROM_EMAIL || 'noreply@example.com';

    console.log(`SES client initialized successfully in region: ${process.env.AWS_REGION || config.aws.region || 'us-east-1'}`);
    console.log(`Default from email: ${defaultFromEmail}`);

    return true;
  } catch (error) {
    console.error('Failed to initialize SES client:', error);
    throw error;
  }
}

/**
 * Initialize the Gmail SMTP transporter.
 *
 * Two configuration modes, gated by NODE_ENV to match the DB config's
 * portability pattern:
 *
 *   NODE_ENV=development (self-hosted / local) — read MAIL_* directly from
 *     env vars. Use this with a Gmail app password: set MAIL_SERVER=smtp.gmail.com,
 *     MAIL_PORT=587, MAIL_USERNAME=you@gmail.com, MAIL_PASSWORD=<16-char app pwd>,
 *     MAIL_DEFAULT_SENDER=you@gmail.com.
 *
 *   NODE_ENV=production (managed hosting) — MAIL_SERVER / MAIL_PORT / MAIL_USERNAME
 *     hold the *names* of AWS Secrets Manager secrets, and the password name
 *     lives in MAIL_PASSWORD_SECRET_NAME. Credentials are resolved at startup
 *     via the default credential chain.
 *
 * Keeping both modes in one function means the same codebase runs self-hosted
 * *and* on the managed platform without divergence.
 */
async function initializeGmailTransporter() {
  try {
    console.log('Initializing Gmail SMTP transporter...');

    const isProduction = process.env.NODE_ENV === 'production';

    let mailServer, mailPort, mailUsername, mailPassword, mailDefaultSender;

    if (isProduction) {
      // Managed hosting: env vars are secret names, resolve via Secrets Manager.
      mailServer = await getSecret(process.env.MAIL_SERVER);
      mailPort = parseInt(await getSecret(process.env.MAIL_PORT), 10);
      mailUsername = await getSecret(process.env.MAIL_USERNAME);
      mailPassword = await getSecret(process.env.MAIL_PASSWORD_SECRET_NAME);
      mailDefaultSender = await getSecret(process.env.MAIL_DEFAULT_SENDER).catch(() => mailUsername);
    } else {
      // Self-hosted / local: env vars hold plain values (Gmail app password flow).
      mailServer = process.env.MAIL_SERVER;
      mailPort = parseInt(process.env.MAIL_PORT || '587', 10);
      mailUsername = process.env.MAIL_USERNAME;
      mailPassword = process.env.MAIL_PASSWORD;
      mailDefaultSender = process.env.MAIL_DEFAULT_SENDER || mailUsername;
    }

    if (!mailServer || !mailUsername || !mailPassword) {
      throw new Error(
        'Gmail SMTP requires MAIL_SERVER, MAIL_USERNAME, and MAIL_PASSWORD ' +
        '(self-hosted) — or the corresponding *_SECRET_NAME variants in production. ' +
        'See README → Email for the Gmail app password setup.'
      );
    }

    console.log(`Gmail config - Server: ${mailServer}, Port: ${mailPort}, User: ${mailUsername}`);

    nodemailerTransporter = nodemailer.createTransport({
      host: mailServer,
      port: mailPort,
      secure: mailPort === 465,
      auth: { user: mailUsername, pass: mailPassword },
      tls: { rejectUnauthorized: false },
    });

    await nodemailerTransporter.verify();
    console.log('Gmail SMTP transporter initialized and verified successfully');

    defaultFromEmail = mailDefaultSender;
    config.email.resolvedDefaultSender = mailDefaultSender;

    return true;
  } catch (error) {
    console.error('Failed to initialize Gmail SMTP transporter:', error);
    throw error;
  }
}

/**
 * Send an email using AWS SES
 */
async function sendEmailViaSES(options) {
  if (!sesClient) {
    initializeSESClient();
  }

  try {
    const fromEmail = options.from || defaultFromEmail;

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: Array.isArray(options.to) ? options.to : [options.to]
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8'
        },
        Body: {}
      }
    };

    if (options.text) {
      params.Message.Body.Text = {
        Data: options.text,
        Charset: 'UTF-8'
      };
    }

    if (options.html) {
      params.Message.Body.Html = {
        Data: options.html,
        Charset: 'UTF-8'
      };
    }

    if (!options.text && !options.html) {
      throw new Error('Email must contain either text or html body');
    }

    console.log(`Sending email via SES to: ${options.to}, subject: "${options.subject}"`);
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);

    console.log(`Email sent successfully via SES. MessageId: ${result.MessageId}`);
    return result;

  } catch (error) {
    console.error('Error sending email via SES:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code || error.$metadata?.httpStatusCode
    });
    throw error;
  }
}

/**
 * Send an email using Gmail SMTP (Nodemailer)
 */
async function sendEmailViaGmail(options) {
  if (!nodemailerTransporter) {
    await initializeGmailTransporter();
  }

  try {
    // Set default sender if not provided
    if (!options.from && config.email.resolvedDefaultSender) {
      options.from = config.email.resolvedDefaultSender;
    }

    console.log(`Sending email via Gmail SMTP to: ${options.to}, subject: "${options.subject}"`);
    const result = await nodemailerTransporter.sendMail(options);
    console.log(`Email sent successfully via Gmail SMTP. MessageId: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('Error sending email via Gmail SMTP:', error);
    throw error;
  }
}

/**
 * Send an email (uses configured backend)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.from - Sender email address (optional, uses default if not provided)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body (optional)
 * @param {string} options.html - HTML body (optional)
 * @returns {Promise<Object>} - Email send result
 */
async function sendEmail(options) {
  if (USE_SES) {
    return sendEmailViaSES(options);
  } else {
    return sendEmailViaGmail(options);
  }
}

// Initialize on module load
console.log('Email service initializing...');
console.log(`Backend: ${USE_SES ? 'AWS SES' : 'Gmail SMTP'}`);

if (USE_SES) {
  try {
    initializeSESClient();
    console.log('Successfully initialized SES email service');
  } catch (error) {
    console.error('Failed to initialize SES email service:', error);
  }
} else {
  initializeGmailTransporter()
    .then(() => {
      console.log('Successfully initialized Gmail SMTP email service');
    })
    .catch(error => {
      console.error('Failed to initialize Gmail SMTP email service:', error);
    });
}

module.exports = {
  sendEmail,
  initializeSESClient,
  initializeGmailTransporter
};
