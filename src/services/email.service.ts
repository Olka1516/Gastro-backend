import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

const envTrim = (key: string): string | undefined => {
  const value = process.env[key];

  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

const getTransporter = (): nodemailer.Transporter | null => {
  if (transporter) {
    return transporter;
  }

  const host = envTrim("SMTP_HOST");
  const port = Number(envTrim("SMTP_PORT") ?? 587);
  const secure = envTrim("SMTP_SECURE") === "true";

  const smtpUser = envTrim("SMTP_USER");
  const senderEmail = envTrim("SENDER_EMAIL");
  const pass = envTrim("SMTP_PASS");

  const authUser = smtpUser ?? senderEmail;

  if (!host) {
    console.warn("[mail] SMTP_HOST is missing");
    return null;
  }

  if (!authUser) {
    console.warn("[mail] SMTP_USER or SENDER_EMAIL is missing");
    return null;
  }

  if (!pass) {
    console.warn("[mail] SMTP_PASS is missing");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: authUser,
      pass,
    },
  });

  return transporter;
};

export const sendMail = async (
  to: string,
  subject: string,
  text: string,
): Promise<void> => {
  const from =
    envTrim("MAIL_FROM") ?? envTrim("SENDER_EMAIL") ?? "noreply@localhost";

  const transport = getTransporter();

  if (!transport) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  try {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("[mail] sendMail failed:", err);

    const code = (err as { responseCode?: number }).responseCode;

    if (code === 535) {
      console.error(
        "[mail] Invalid SMTP credentials. For Gmail use App Password with enabled 2FA.",
      );
    }

    throw err;
  }
};

export const sendContactMessageMail = async (
  visitorEmail: string,
  message: string,
): Promise<void> => {
  const inbox = envTrim("SENDER_EMAIL");

  if (!inbox) {
    throw new Error("SENDER_EMAIL_MISSING");
  }

  const transport = getTransporter();

  if (!transport) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  try {
    const info = await transport.sendMail({
      from: inbox,
      replyTo: visitorEmail,
      to: inbox,
      subject: "Contact",
      text: `From: ${visitorEmail}\n\n${message}`,
    });

    console.log("[mail] contact:", info.response);
  } catch (err) {
    console.error("[mail] contact send failed:", err);
    throw err;
  }
};
