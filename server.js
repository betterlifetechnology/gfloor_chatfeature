const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const allowedOrigin = process.env.SHOPIFY_ALLOWED_ORIGIN || "https://gfloor.com";

app.use(
  cors({
    origin: allowedOrigin,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("G-Floor chat backend is running.");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "gfloor-chatfeature"
  });
});

app.post("/chat/message", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      message,
      pageUrl,
      pageTitle,
      requestedLiveAgent
    } = req.body;

   if (!name || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: "Name, email, phone, and message are required."
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const emailBody = `
New G-Floor chat message

Name: ${name}
Email: ${email}
Phone: ${phone || "Not provided"}

Message:
${message}

Page title: ${pageTitle || "Not provided"}
Page URL: ${pageUrl || "Not provided"}

Requested live agent: ${requestedLiveAgent ? "Yes" : "No"}
`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.CUSTOMER_SERVICE_EMAIL,
      subject: "New G-Floor Chat Message",
      text: emailBody
    });

    res.json({
      success: true,
      message: "Message sent successfully."
    });
  } catch (error) {
    console.error("Chat message error:", error);

    res.status(500).json({
      success: false,
      error: "Message could not be sent."
    });
  }
});

app.listen(PORT, () => {
  console.log(`G-Floor chat backend running on port ${PORT}`);
});