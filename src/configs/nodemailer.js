import nodemailer from "nodemailer";

// Alternative: Using host/port (more explicit)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Send email function
const sendEmail = async (to, subject, html, enterprise = "Devsht") => {
  try {
    const mailOptions = {
      from: `${enterprise} <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail:", error.message);
    return { success: false, error: error.message };
  }
};

export default sendEmail;
