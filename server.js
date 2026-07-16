const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const allowedOrigin =
  process.env.SHOPIFY_ALLOWED_ORIGIN || "https://gfloor.com";

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

    const requiredEnvironmentVariables = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
      "CUSTOMER_SERVICE_EMAIL"
    ];

    const missingEnvironmentVariables =
      requiredEnvironmentVariables.filter(
        (variableName) => !process.env[variableName]
      );

    if (missingEnvironmentVariables.length > 0) {
      console.error(
        "Missing email environment variables:",
        missingEnvironmentVariables.join(", ")
      );

      return res.status(500).json({
        success: false,
        error: "Email delivery is not fully configured."
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: true,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        minVersion: "TLSv1.2"
      }
    });

    const emailBody = `
New G-Floor chat message

Name: ${name}
Email: ${email}
Phone: ${phone}

Message:
${message}

Page title: ${pageTitle || "Not provided"}
Page URL: ${pageUrl || "Not provided"}

Requested live agent: ${requestedLiveAgent ? "Yes" : "No"}
`;

    const emailResult = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.CUSTOMER_SERVICE_EMAIL,
      replyTo: email,
      subject: `New G-Floor Chat Message from ${name}`,
      text: emailBody
    });

    console.log("Chat email sent successfully:", emailResult.messageId);

    return res.json({
      success: true,
      message: "Message sent successfully."
    });
  } catch (error) {
    console.error("Chat message error:", {
      name: error.name,
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });

    return res.status(500).json({
      success: false,
      error:
        "Message could not be sent. Please contact Customer Service directly."
    });
  }
});

app.listen(PORT, () => {
  console.log(`G-Floor chat backend running on port ${PORT}`);
});