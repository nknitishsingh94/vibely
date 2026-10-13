# Vibely ✨
> **Where two souls sync. An intimate, private messaging sanctuary built exclusively for two.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 🌿 About Vibely

**Vibely** is designed for the one person who matters most. Free from chaotic group chats, public feeds, algorithms, and social noise, Vibely gives couples, best friends, and soulmates an aesthetic, zero-distraction sanctuary to share daily life, memories, and unfiltered feelings.

Styled in a signature luxury palette of **Deep Forest Emerald (`#0C3B2E`)** and **Pure White (`#FFFFFF`)**.

---

## ✨ Features

- **💌 Little Notes**: Compose editorial love notes with subtle parchment textures, poetic typography, and save them directly to your shared vault.
- **🎵 Shared Tracks & Voice Snaps**: Share audio snippets, voice notes, and songs with real-time audio waveforms.
- **🖼️ Moments & Memory Vault**: An automatically organized shared album for all your uploaded photos, videos, audio tracks, and pinned messages.
- **🔒 Zero-Trust Privacy & Vibe ID**: Connect effortlessly using unique `#VIBE-XXXXXXXX` tags or encrypted 1-time invite links. No phone numbers required.
- **💕 Our Days Counter**: Track relationship milestones and days together with gentle anniversary counters.
- **🔑 Flexible Authentication**: Secure authentication via Supabase supporting both Email/Password and Google OAuth.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Storage, Auth)
- **Styling**: Tailwind CSS with custom Emerald Luxe token architecture
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/) & React Testing Library

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/nknitishsingh94/vibely.git
cd vibely
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXT_PUBLIC_APP_URL=https://vibely-sigma-roan.vercel.app
```

### 4. Database Setup
Run the SQL script located at `supabase/COMPLETE_SETUP.sql` inside your **Supabase Dashboard -> SQL Editor**.

### 5. Production App
The production app is live at: [https://vibely-sigma-roan.vercel.app](https://vibely-sigma-roan.vercel.app)

---

## 🧪 Testing

```bash
npm test
```

---

## 📄 License
Made with ❤️ for two souls. All rights reserved.
