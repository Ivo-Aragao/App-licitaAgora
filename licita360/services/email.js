import nodemailer from "nodemailer";

export async function sendEmail({ to, subject, text, html }) {
  const user = process.env.GOOGLE_EMAIL;
  const password = process.env.GOOGLE_APP_PASSWORD;

  if (!user || !password) {
    throw new Error(
      "Configure GOOGLE_EMAIL e GOOGLE_APP_PASSWORD no .env."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: password,
    },
  });

  return transporter.sendMail({
    from: process.env.ALERT_FROM_EMAIL || user,
    to,
    subject,
    text,
    html,
  });
}