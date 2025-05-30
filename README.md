# Email Sync & AI-Driven Categorization Service

A full-stack TypeScript/Node.js application that:

1. **Syncs** multiple IMAP mailboxes in real time (IMAP IDLE)  
2. **Backfills** the last 2 days of emails on startup  
3. **Indexes** every email in Elasticsearch for full-text search & filtering  
4. **Categorizes** emails into five labels via a rule-based or AI model:  
   - Interested  
   - Meeting Booked  
   - Not Interested  
   - Spam  
   - Out of Office  
5. **Notifies** via Slack webhook & an external HTTP webhook for “Interested” emails  
6. **Serves** a responsive frontend dashboard to search, filter, and view emails  

---

## 🚀 Features

- **Real-Time IMAP Sync**  
  - Two IMAP accounts (e.g. Gmail) with persistent IDLE connections  
  - Instant “new mail” events without polling  
- **Historical Backfill**  
  - Fetches the last **2 days** of emails on startup  
  - Indexes silently (no notifications)  
- **Searchable Storage**  
  - Emails stored in a local Elasticsearch Docker container  
  - Full-text search on subject, body, sender, category, account, folder  
  - Exact filtering by `account.keyword` & `folder.keyword`  
- **AI-Based Categorization**  
  - Default rule-based classifier in `src/services/aiCategorizer.ts`  
  - Optionally swap in Google Gemini or a local ML model if an API key is available  
- **Slack & Webhook Alerts**  
  - Slack notifications for new **Interested** emails  
  - External webhook triggers for Interested email automation  
- **Frontend Dashboard**  
  - Card-based UI with sticky filter/search controls  
  - Dropdowns for account & folder, text search, auto-refresh  
  - Expand/collapse full-body view per email  

---

## 🏗 Architecture & Approach

1. **IMAP Client** (`src/imap/imapClient.ts`)  
   - Connects to each account, backfills recent mail via `SEARCH SINCE`, then enters IDLE  
   - Calls a shared callback: `(email, accountName, isRealTime)`  
2. **Email Handler** (`src/index.ts`)  
   - Categorizes every email (`categorizeEmail`)  
   - Indexes to Elasticsearch (`indexEmail`)  
   - Fires notifications only for real-time “Interested” emails  
3. **Elasticsearch Storage** (`src/services/elasticsearch.ts`)  
   - Dockerized instance (via `docker-compose.yml`)  
   - Index mapping uses `.keyword` for exact filtering  
4. **Notifications**  
   - Slack via incoming webhook (`src/services/slackNotifier.ts`)  
   - HTTP POST webhook via `webhook.site` or similar (`src/services/webhookTrigger.ts`)  
5. **Frontend** (`public/index.html`, `public/app.js`)  
   - Fetches `/emails` and `/emails/search`  
   - Renders a modern, responsive card layout  

---

## 💻 Tech Stack

- **Runtime:** Node.js, TypeScript  
- **IMAP:** `imap` + `mailparser`  
- **Search:** Elasticsearch (Docker)  
- **HTTP:** Express.js  
- **Notifications:** Axios, Slack Incoming Webhooks  
- **Frontend:** Vanilla JS + HTML/CSS  
- **Deployment:** Docker Compose  

---

## ⚙️ Prerequisites

- **Node.js** ≥ 16  
- **Docker** & **Docker Compose**  
- Two IMAP-accessible mail accounts (e.g. Gmail with App Passwords)  
- (Optional) Slack workspace & webhook  
- (Optional) External HTTP webhook endpoint (webhook.site)  

---

## 🚀 Getting Started

1. **Clone & install**  
   ```bash
   git clone <repo-url>
   cd backend_project
   npm install
   docker-compose up -d
   npm run start


## 🚀 Config
1. **Copy .env.example to .env and fill in:**  
   ```bash
    IMAP_USER1=youremail1@gmail.com
    IMAP_PASS1=app_password1
    IMAP_USER2=youremail2@gmail.com
    IMAP_PASS2=app_password2
    SLACK_WEBHOOK_URL=https://hooks.slack.com/services/…
    WEBHOOK_URL=https://webhook.site/your-uuid


## 🚀 Directory Structure

.
├── public/
│   ├── index.html
│   └── app.js
├── src/
│   ├── imap/imapClient.ts
│   ├── services/
│   │   ├── elasticsearch.ts
│   │   ├── aiCategorizer.ts
│   │   ├── slackNotifier.ts
│   │   └── webhookTrigger.ts
│   └── index.ts
├── dist/               # compiled output
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env                # environment variables (gitignored)





