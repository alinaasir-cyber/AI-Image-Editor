# 🎨 PixelAI — AI Image Editor & Generator

A modern, full-stack AI Image Studio built with **Next.js 16 (App Router & Turbopack)**, **Tailwind CSS 4**, **Neon PostgreSQL**, and **shadcn/ui**. Generate high-resolution visual artwork from prompts or edit existing images with cloud persistence and instant downloads.

🌐 **Live Demo:** [ai-image-editor-ivory.vercel.app](https://ai-image-editor-ivory.vercel.app)

---

## ✨ Features

- 🪄 **Text-to-Image Generation**: Turn any creative text prompt into vivid, high-resolution visuals.
- 🎨 **Image Editing & Transformation**: Upload images (Drag & Drop up to 5 images) and apply AI transformations.
- 🐘 **Neon Serverless PostgreSQL**: Automatically persists generated artwork and prompt history to the cloud.
- 🌓 **Dark / Light Mode**: Seamless theme switching with system detection powered by `next-themes`.
- 🔍 **Fullscreen Lightbox Modal**: Click any artwork to preview in high definition with zoom controls.
- ⚡ **One-Click Quick Prompts**: Instant prompt suggestion chips (3D robots, cyberpunk cars, landscapes, portraits).
- 💾 **Safe Image Download Proxy**: Internal server streaming endpoint to bypass browser CORS restrictions and download files directly.
- 🇸🇴 **Multilingual Prompt Processing**: Native understanding and translation of Somali & English prompt keywords.
- 📱 **Fully Responsive SaaS UI**: Clean, accessible layout optimized for mobile, tablet, and desktop screens.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) |
| **Database** | [Neon](https://neon.tech/) Serverless PostgreSQL (`@neondatabase/serverless`) |
| **Theme** | [next-themes](https://github.com/pacocoursey/next-themes) |
| **Notifications** | [Sonner](https://sonner.emilkowal.ski/) Toast Notifications |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **File Upload** | [React Dropzone](https://react-dropzone.js.org/) |
| **Hosting** | [Vercel](https://vercel.com/) |

---

## 🗄️ Database Schema

Stored in Neon PostgreSQL:

```sql
CREATE TABLE generated_images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  prompt TEXT,
  type VARCHAR(50) NOT NULL, -- 'generate' | 'edit'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/alinaasir-cyber/AI-Image-Editor.git
cd AI-Image-Editor
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env.local` file in the root directory:
```env
# Neon PostgreSQL Connection String
DATABASE_URL="postgresql://neondb_owner:password@endpoint.aws.neon.tech/neondb?sslmode=require"

# AI Model API Keys (Optional)
REPLICATE_API_TOKEN=""
HUGGINGFACE_API_KEY=""
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Deployment on Vercel

1. Push your repository to GitHub.
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. In **Settings** > **Environment Variables**, add:
   - `DATABASE_URL` = your Neon PostgreSQL connection string.
4. Deploy!

---

## 📄 License
This project is licensed under the MIT License.

Developed by [alinaasir-cyber](https://github.com/alinaasir-cyber).
