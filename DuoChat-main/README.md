# DuoChat — Private Real-Time Messaging Application

DuoChat is an invite-only private messaging web application built specifically for two friends to communicate privately and share text messages, photos, songs, voice notes, videos, and documents without algorithms, public feeds, or third-party interference.

---

## 🌟 Key Features

### 1. Private User Accounts & Authentication
- **Secure Supabase Auth**: Email and password registration, login, and password recovery.
- **Client & Server Integration**: Full SSR authentication with `@supabase/ssr` cookies and Next.js middleware protection.
- **Custom Profiles**: Display name, unique username, bio, and avatar.

### 2. Cryptographic Invitation System
- **Single-Use Invite Tokens**: Authenticated users can generate cryptographically secure invitation links.
- **Hashed Storage**: Only a secure SHA-256 hash of the invitation token is stored in PostgreSQL.
- **Configurable Expiry & Revocation**: Invites can expire (24h, 7 days, 30 days) and can be revoked prior to acceptance.
- **Automatic 1-on-1 Conversation Creation**: When a friend accepts the invite at `/invite/[token]`, a secure direct conversation is created atomically.

### 3. Real-Time Messaging & Status Indicators
- **Instant Delivery**: Powered by Supabase Realtime Postgres Changes and broadcast channels.
- **Live Presence & Online Status**: Realtime presence tracking indicating whether your friend is currently online or last active.
- **Typing Indicator**: Debounced typing broadcast showing a pulsing indicator when your friend is composing.
- **Delivery Receipts**:
  - 🕒 **Sending** (optimistic UI update)
  - ✓ **Sent** (persisted in database)
  - ✓✓ **Delivered** (recipient connected)
  - ✓✓ (blue) **Read** (conversation viewed by recipient)

### 4. Rich Media & Attachments
- 🖼️ **Photos & Images**: JPEG, PNG, WebP, GIF preview with a full-size modal and download option (up to 10 MB).
- 🎵 **Songs & Audio**: Custom audio player with animated waveform bars, seekable scrub timeline, duration, and volume controls (up to 25 MB).
- 🎙️ **In-Browser Voice Messages**: Built-in audio recorder via the browser `MediaRecorder` API with live elapsed timer, waveform pulse, preview before sending, or discard.
- 🎬 **Videos**: HTML5 video playback with custom header and download options (up to 100 MB).
- 📄 **Documents & Files**: PDF, DOCX, XLSX, TXT, ZIP with filetype-specific icons and file-size metadata (up to 25 MB).

### 5. Interactive Message Actions
- **Reply**: Quote context from previous messages.
- **Emoji Reactions**: React with 👍, ❤️, 😂, 😮, 😢, 🔥, or any emoji with live counters.
- **Inline Editing**: Edit sent text messages with an `(edited)` indicator.
- **Deletion**: Soft-delete messages with a confirmation modal ("Delete for everyone").
- **Copy Text**: One-click clipboard copying.

### 6. Search & Shared Media Gallery
- **In-Conversation Search**: Instant filtering and highlighting of chat messages.
- **Shared Media Drawer**: Categorized sidebar tabs for **Photos**, **Audio**, **Videos**, and **Files**.

### 7. Modern UI/UX & Responsive Layout
- **Aesthetic**: Premium rounded bubbles, subtle borders, custom scrollbars, and fluid transitions.
- **Themes**: System-aware Dark Mode and Light Mode with quick toggle.
- **Responsive**: 3-column desktop layout (Sidebar, Conversation, Details Panel) and full-screen mobile chat view with clean back navigation.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 & CSS Variables
- **Icons**: [Lucide React](https://lucide.dev/)
- **Forms & Validation**: React Hook Form + Zod
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Storage, Auth)
- **Audio Recording**: HTML5 `MediaRecorder` API
- **Testing**: Vitest + React Testing Library

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+ (tested on Node.js 24)
- npm 10+
- A free [Supabase account](https://supabase.com/)

### 2. Installation
Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/duochat.git
cd duochat
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note**: DuoChat includes a **Smart Preview Mode**. If Supabase keys are not configured yet, the app runs in interactive demo mode with sample conversations, photo previews, audio tracks, and simulated friend responses.

---

## 🗄️ Supabase Setup Guide

### Step 1: Create a Supabase Project
1. Log into [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project**, name it `DuoChat`, and select your preferred region.

### Step 2: Run Database Migrations
1. In the Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Click **New query**.
3. Copy the entire contents of [`supabase/migrations/20261012000000_duochat_schema.sql`](supabase/migrations/20261012000000_duochat_schema.sql).
4. Click **Run**.
   - This automatically creates all tables (`profiles`, `conversations`, `conversation_members`, `messages`, `message_receipts`, `invitations`, `message_reactions`, `user_preferences`).
   - Configures automatic triggers (`handle_new_user`, `handle_updated_at`).
   - Configures atomic database functions (`accept_invitation`).
   - Sets up strict Row Level Security (RLS) policies.
   - Adds tables to the `supabase_realtime` publication.
   - Initializes the private `chat-media` storage bucket and security policies.

### Step 3: Configure Storage (Private Bucket)
The migration script automatically creates the private `chat-media` bucket. To verify:
1. In the Supabase Dashboard, go to **Storage**.
2. Confirm the `chat-media` bucket exists and is marked **Private** (Public bucket = Disabled).
3. Under **Policies**, confirm that conversation members can view and upload objects.

### Step 4: Configure Authentication
1. Go to **Authentication** -> **Providers** -> **Email**.
2. For seamless local testing, you can disable **Confirm email** during development, or configure your SMTP provider for production emails.
3. In **Authentication** -> **URL Configuration**, add your application URLs:
   - Site URL: `http://localhost:3000` (or your Vercel deployment URL)
   - Redirect URLs: `http://localhost:3000/**`, `https://your-domain.vercel.app/**`

---

## 🧪 Testing

Run unit and validation tests with Vitest:

```bash
npm run test
```

Run production build check:

```bash
npm run build
```

---

## 🌐 Deployment to Vercel

1. Push your code to a GitHub repository.
2. Import the project into [Vercel](https://vercel.com/new).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel domain, e.g., `https://duochat.vercel.app`)
4. Click **Deploy**.
5. Copy your live Vercel HTTPS URL and add it to **Redirect URLs** in your Supabase Auth settings.

---

## 🔒 Security & Row Level Security (RLS)

- **Strict Access Control**: Conversations, messages, receipts, and attachments can only be accessed by authenticated participants of that conversation.
- **Private Media**: Storage objects are stored in private paths (`${conversation_id}/${filename}`) and served via short-lived signed URLs.
- **Cryptographic Tokens**: Invitation URLs expose raw tokens that are matched only against SHA-256 hashes in PostgreSQL. Single-use enforcement and expiration prevent replay attacks.
- **Client Isolation**: No service role credentials are ever exposed to the client browser.

---

## 📄 License
MIT License. Built with modern web standards and security best practices.
