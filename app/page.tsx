import ImageEditor from "@/components/ImageEditor";
import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 flex justify-center">
        <div className="h-[380px] w-[550px] -translate-y-1/3 rounded-full bg-gradient-to-tr from-indigo-500/15 via-purple-500/15 to-pink-500/10 blur-[120px]" />
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI-Powered Image Studio</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Transform Ideas Into{" "}
            <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 bg-clip-text text-transparent">
              Visual Art
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-muted-foreground">
            Generate stunning high-resolution visuals or edit images seamlessly with AI-powered processing and cloud persistence.
          </p>
        </div>

        {/* Main Editor */}
        <ImageEditor />
      </div>
    </div>
  );
}
