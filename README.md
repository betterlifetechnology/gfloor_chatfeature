# G-Floor Custom Chat Feature

Custom customer-support chat system for [G-Floor](https://gfloor.com/).

This project provides a branded chat experience that combines:

- G-Floor product knowledge
- Shopify product and variant context
- Real-time price, SKU, size, color, and availability awareness
- Small-talk and customer-service conversation
- Kansas City Chiefs small talk
- Confidence scoring
- Smart escalation
- Customer Service handoff
- Business-hours awareness
- Chat analytics
- G-Floor mascot states
- Render-hosted backend services

---

# Overview

The G-Floor custom chat feature is designed to help customers answer common product and support questions without requiring them to search through product pages, FAQs, installation guides, or support documentation.

The chat can understand both general G-Floor questions and the specific Shopify product or variant the customer is currently viewing.

When the system does not have enough approved information to confidently answer a question, it offers a Customer Service handoff instead of guessing.

---

# Live Environment

## Website

https://gfloor.com/

## Backend

https://gfloor-chatfeature.onrender.com/

## Health Check

https://gfloor-chatfeature.onrender.com/health

---

# Core Features

## 1. G-Floor Knowledge Base

The chat can answer approved G-Floor questions including:

- Product selection
- Installation
- Cleaning and maintenance
- Shipping and delivery
- Order help
- Warranty and returns
- Outdoor-use questions
- Product materials
- General product-use questions

The system is designed to use approved support information rather than inventing answers.

---

# 2. Shopify Product Context

When a customer is viewing a G-Floor product page, the chat can detect the product currently being viewed.

Example question:

```text
What product am I looking at?chat feature
3. Real-Time Variant Synchronization

The chat tracks the Shopify product options currently selected on the page.

Supported product details include:

Product title
Variant
Color
Size
SKU
Price
Availability
Available colors
Available sizes

Example questions:

What's the SKU?
What color am I looking at?
What size am I looking at?
How much is this?
Is this in stock?
What colors are available?
What sizes does this come in?

If the customer changes the selected Shopify variant, the chat updates its context without requiring a page refresh.

4. Conversational Follow-Up

The chat supports contextual follow-up questions.

Example:

How much is this?

The customer changes the selected variant.

Then:

What about now?

The chat can answer using the newly selected Shopify variant.

Another example:

What's the SKU?

Change the variant.

Then:

And now?

The system returns the updated SKU.

5. Small Talk

The chat supports basic customer-service conversation so visitors are not immediately sent through the product knowledge-base system for casual messages.

Examples:

Hello
How are you today?
Thank you
What can you help with?
Are you a real person?
Have a great day

Small-talk requests are routed before product matching and confidence scoring.

6. Kansas City Small Talk

Because G-Floor is based in the Kansas City area, the chat includes limited Kansas City Chiefs conversation.

Examples:

What time does the Chiefs game start?
When do the Chiefs play?
Chiefs schedule
What time is the Chiefs game?

Chiefs responses are separated from G-Floor product knowledge so sports questions do not accidentally match flooring answers.

7. Cleaning and Maintenance

Example:

How do I clean G-Floor?

The chat can return approved cleaning instructions and an applicable Learn More resource.

Example natural-language variation:

How do I get a stain off G-Floor?

The customer does not need to use the exact wording from an FAQ.

8. Installation Guidance

Example:

Do I have to glue this down?

The system can provide installation guidance based on the current product and approved support information.

For more installation-specific questions such as:

Can I glue this to wood?

the chat can provide available guidance while also recommending Customer Service review when the answer depends on the specific substrate, product, or installation conditions.

9. Product-Use Safety

The system distinguishes between products designed for different environments.

Example:

Can I use this outside?

A standard Garage Flooring product should not automatically receive the same recommendation as G-Floor® Outdoor & Marine Flooring.

The system can provide approved information and escalate when product-specific confirmation is necessary.

10. Confidence Scoring

The chat uses confidence scoring to determine whether an answer is safe to provide.

High-confidence questions can be answered directly.

Examples:

What's the SKU?
How much is this?
How do I clean G-Floor?

Lower-confidence or ambiguous questions can be escalated.

Example:

Will this work?

Instead of guessing, the system can respond that it does not have enough confidence to provide a definitive answer and offer Customer Service assistance.

11. Smart Escalation

The chat can recommend Customer Service when:

A question is too vague
Product-specific information is required
Installation conditions need review
The approved knowledge base does not contain enough information
A question falls outside supported content
The customer requests human assistance

The goal is to answer confidently when possible and escalate safely when necessary.

12. Customer Service Handoff

Customers can select:

Talk to a Customer Service Representative

The system provides a transition screen before opening the contact form.

The contact form collects:

Name
Email
Phone
Customer question

The current product context can also be carried into the handoff.

13. Product Context During Handoff

When a customer requests Customer Service from a product page, the form can display:

YOU'RE VIEWING

along with information such as:

Garage Flooring | Ribbed™ Tread | G-Floor® Roll-Out Vinyl Flooring

Variant: Midnight Black / 8'6" x 22'

SKU: GF55RB8622MB

This gives the Customer Service team more context before they review the customer's request.

14. Question Carry-Forward

The customer's current question can be automatically populated into the Customer Service form.

Example:

Can I glue this to wood?

If the customer chooses human assistance, the question can already appear under:

How can we help?

The customer does not need to type the question again.

15. Business Hours

Customer Service availability is based on Central Time.

Business hours:

Monday-Friday
8:00 AM-5:00 PM Central Time

During business hours, the chat can indicate that a representative is available and display an estimated wait time.

Outside business hours, the customer can still submit a message for review.

16. Chat Session ID

Each chat session receives a unique session identifier.

Example:

GFCHAT-20260727-ABC123

This identifier can help associate activity within a single customer chat session.

17. G-Floor Mascot

The custom chat includes branded G-Floor mascot states.

Welcome State

Used when:

The chat launcher is displayed
The customer opens the chat
The assistant welcomes the visitor
Thinking State

Used while:

Processing a customer question
Looking through G-Floor support information
Determining the correct response

Mascot assets are hosted through Shopify CDN.

18. Chat Analytics

The chat includes analytics support through window.dataLayer.

Analytics can be used with:

Google Tag Manager
Google Analytics 4

Tracked interactions can include:

Chat opened
Question category
Question intent
Answer result
Escalation
Helpful / not helpful
Customer Service request
Product context
Page context
Small-talk category

Raw customer free-text questions should not be sent to GA4 because they could potentially contain personally identifiable information.

Project Structure
gfloor_chatfeature/
│
├── public/
│   ├── widget.js
│   ├── knowledge-base.js
│   ├── chat-analytics.js
│   ├── chat-mascot.js
│   ├── chat-smalltalk.js
│   └── chat-product-context-fixes.js
│
├── scripts/
│   ├── import-training-data.js
│   └── prelaunch-check.js
│
├── server.js
├── learn-inbox.js
├── package.json
├── package-lock.json
├── Procfile
├── .env.example
├── .gitignore
├── LICENSE
└── README.md

Some files may be added or changed as development continues.

Backend

The backend is built with Node.js and Express.

The project currently uses Node.js 20.

Main server file:

server.js

Start command:

npm start
Available NPM Commands
Start the application
npm start

Runs:

node server.js
Learn From Inbox
npm run learn

Runs:

node learn-inbox.js

This functionality depends on the required Microsoft mailbox permissions and environment configuration.

Import Training Data
npm run training-import

Runs:

node scripts/import-training-data.js
Prelaunch Check
npm run prelaunch

Runs:

node scripts/prelaunch-check.js

Use this before production releases to confirm required systems are configured correctly.

Local Development

Clone the repository:

git clone https://github.com/betterlifetechnology/gfloor_chatfeature.git

Enter the project directory:

cd gfloor_chatfeature

Install dependencies:

npm install

Create a local environment file based on:

.env.example

Then start the application:

npm start
Environment Variables

Environment variables are configured in Render rather than committed directly into GitHub.

Do not commit passwords, client secrets, SMTP credentials, access tokens, or other private credentials.

Examples of environment configuration used by the project may include:

PORT
SHOPIFY_ALLOWED_ORIGIN

CUSTOMER_SERVICE_EMAIL

EMAIL_DELIVERY_MODE

SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS

MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET

The exact required variables should be confirmed against .env.example and the current server.js.

Microsoft Graph

The project contains support for Microsoft Graph-based email delivery.

The following values may be required:

MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET

These credentials must be created and supplied by the Microsoft 365 / Entra administrator.

Do not store these values directly in the repository.

Email Delivery

Customer Service messages are intended to route to:

CustomerService@GProductsLLC.com

The backend can determine the active configured email transport based on available environment variables.

Health endpoints should be used to confirm whether email delivery is configured before production testing.

Shopify Integration

The chat frontend is hosted from Render and loaded into the Shopify theme with script tags.

Example:

<!-- G-Floor Custom Chat -->
<script
  src="https://gfloor-chatfeature.onrender.com/widget.js"
  defer
></script>

<!-- G-Floor Chat Analytics -->
<script
  src="https://gfloor-chatfeature.onrender.com/chat-analytics.js"
  defer
></script>

<!-- G-Floor Chat Mascot -->
<script
  src="https://gfloor-chatfeature.onrender.com/chat-mascot.js"
  defer
></script>

<!-- G-Floor Chat Small Talk -->
<script
  src="https://gfloor-chatfeature.onrender.com/chat-smalltalk.js"
  defer
></script>

<!-- G-Floor Product Context Fixes -->
<script
  src="https://gfloor-chatfeature.onrender.com/chat-product-context-fixes.js"
  defer
></script>

For production deployments, a version query string can be used for cache busting.

Example:

<script
  src="https://gfloor-chatfeature.onrender.com/widget.js?v=19.5"
  defer
></script>
Recommended Script Order

Load the scripts in this order:

1. widget.js
2. chat-analytics.js
3. chat-mascot.js
4. chat-smalltalk.js
5. chat-product-context-fixes.js

The ordering matters because supplemental chat features depend on the primary widget.

Demo Test Sequence

Use the following sequence when demonstrating the custom chat.

Small Talk
Hello
How are you today?
Thank you
Kansas City Personality
What time does the Chiefs game start?
When do the Chiefs play?
Chiefs schedule
Shopify Product Context
What product am I looking at?
What's the SKU?
What color am I looking at?
What size am I looking at?
How much is this?
Is this in stock?
Product Options
What colors are available?
What sizes does this come in?
Real-Time Variant Sync

Change the Shopify product color or size.

Then ask:

What's the SKU?
How much is this?
What color am I looking at?
What size am I looking at?

The answers should reflect the newly selected variant.

Knowledge Base
How do I clean G-Floor?
How do I get a stain off G-Floor?
Do I have to glue this down?
Can I glue this to wood?
Is this waterproof?
Can I use this outside?
Confidence / Escalation
Will this work?

The chat should avoid guessing and offer Customer Service assistance when there is not enough information.

Human Handoff

Click:

Talk to a Customer Service Representative

Verify that the handoff includes:

Current product
Variant
SKU
Customer question
Business-hours status
Contact fields
Production Test Checklist

Before considering a deployment complete, verify:

Chat launcher appears
Mascot loads
Chat opens and closes
Topic buttons work
Small talk works
Chiefs small talk works
Current product is detected
Current color is detected
Current size is detected
Current SKU is detected
Current price is detected
Inventory status is detected
Variant changes synchronize
Available colors are correct
Available sizes are correct
Cleaning answers work
Installation answers work
Outdoor-use answers work
Confidence scoring works
Ambiguous questions escalate
Customer Service handoff works
Product context carries into handoff
Question carries into handoff
Business-hours messaging works
Analytics events fire
Render health endpoint returns successfully
Email delivery configuration is verified