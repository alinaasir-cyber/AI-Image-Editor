"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Wand2,
  Sparkles,
  X,
  Trash2,
  ImageIcon,
  Loader2,
  Paintbrush,
  Download,
  Copy,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

interface EditResult {
  id?: number | string;
  url: string;
  prompt?: string;
  timestamp: number;
  type: string;
  imageCount?: number;
}

const quickPrompts = [
  {
    label: "🤖 3D Robot",
    text: "A Pixar-style 3D rendered character of a cute small robot with big expressive glowing eyes, octane render, 8k",
  },
  {
    label: "🦁 Majestic Lion",
    text: "Majestic male lion standing on a rock cliff in savanna at golden hour, volumetric lighting, ultra-realistic",
  },
  {
    label: "🏎️ Cyberpunk Car",
    text: "Futuristic sports car speeding through a neon-lit cyberpunk city at night with rain reflections, 8k",
  },
  {
    label: "🌅 Sunset Ocean",
    text: "Breathtaking panoramic sunset over a calm turquoise ocean with gentle waves and pink golden clouds",
  },
  {
    label: "💼 Business Suit",
    text: "Professional handsome man in a tailored dark navy suit in a modern glass office, ultra-realistic portrait",
  },
];

const ImageEditor = () => {
  const [activeTab, setActiveTab] = useState("edit");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<EditResult[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Fullscreen Preview Modal State
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    prompt?: string;
  } | null>(null);

  // Load saved results from localStorage & Neon Database on mount
  useEffect(() => {
    // 1. Instant local load
    try {
      const saved = localStorage.getItem("ai_image_editor_results");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setResults(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load results from localStorage", e);
    } finally {
      setIsLoaded(true);
    }

    // 2. Fetch from Neon Database to keep in sync
    fetch("/api/history")
      .then((res) => (res.ok ? res.json() : { history: [] }))
      .then((data) => {
        if (Array.isArray(data.history) && data.history.length > 0) {
          const dbResults: EditResult[] = data.history.map((item: any) => ({
            id: item.id,
            url: item.url,
            prompt: item.prompt,
            timestamp: new Date(item.created_at).getTime() || Date.now(),
            type: item.type || "generate",
          }));
          setResults((prev) => {
            const urls = new Set(prev.map((r) => r.url));
            const fresh = dbResults.filter((r) => !urls.has(r.url));
            return [...prev, ...fresh];
          });
        }
      })
      .catch((err) => console.log("DB sync fallback:", err));
  }, []);

  // Persist results to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(
          "ai_image_editor_results",
          JSON.stringify(results)
        );
      } catch (e) {
        console.error("Failed to save results to localStorage", e);
      }
    }
  }, [results, isLoaded]);

  const removeImage = (indexToRemove: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
    setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const clearAllImages = () => {
    setImagePreviews([]);
    setSelectedImages([]);
  };

  const handleDeleteResult = async (indexToDelete: number, resultId?: number | string) => {
    setResults((prev) => prev.filter((_, i) => i !== indexToDelete));
    toast.success("Image removed from results");
    if (resultId) {
      try {
        await fetch(`/api/history?id=${resultId}`, { method: "DELETE" });
      } catch (err) {
        console.error("Failed to delete from DB", err);
      }
    }
  };

  const handleClearAllResults = async () => {
    setResults([]);
    toast.success("All results cleared");
    try {
      await fetch("/api/history", { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear DB", err);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      // Use internal proxy route to bypass browser CORS restrictions
      const proxyUrl = `/api/download?url=${encodeURIComponent(
        url
      )}&filename=${encodeURIComponent(filename)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Proxy download failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Image downloaded successfully!");
    } catch (error) {
      try {
        // Fallback: direct browser fetch
        const directResponse = await fetch(url);
        const blob = await directResponse.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        toast.success("Image downloaded successfully!");
      } catch (e) {
        // Ultimate fallback: open image in new tab to save
        window.open(url, "_blank");
        toast.info("Image opened in a new tab to save");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const convertImageToBase64 = (image: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(image);
    });
  };

  const handleProcessImage = async () => {
    if (activeTab === "edit" && (selectedImages.length === 0 || !prompt.trim())) {
      toast.error("Please upload at least one image and enter a prompt");
      return;
    }

    if (activeTab === "generate" && !prompt.trim()) {
      toast.error("Please enter a prompt for image generation");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 1000);

    try {
      let requestBody: any = { prompt: prompt.trim() };
      let apiEndPoint = "/api/image-edit";

      if (activeTab === "edit") {
        // configure request body for edit
        toast.info("Processing images...");
        const base64Images = await Promise.all(
          selectedImages.map((file) => convertImageToBase64(file))
        );
        requestBody.image = base64Images;
      } else {
        // configure request body for generate
        apiEndPoint = "/api/generate";
        toast.info("Generating image...");
      }

      const response = await fetch(apiEndPoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to process image");
      }

      if (data.success && data.output) {
        const newResult: EditResult = {
          id: Date.now(),
          url: data.output,
          prompt: prompt.trim(),
          timestamp: Date.now(),
          type: activeTab === "edit" ? "edit" : "generate",
          imageCount: activeTab === "edit" ? selectedImages.length : 1,
        };

        setResults((prev) => [newResult, ...prev]);
        clearInterval(progressInterval);
        setProgress(100);
        toast.success(
          `Image ${activeTab === "edit" ? "edited" : "generated"} successfully`
        );
      } else {
        throw new Error(data.error || "Failed to process image");
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      toast.error(error.message || "Failed to process image");
      setIsProcessing(false);
      setProgress(0);
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedImages(acceptedFiles);

    const previewPromises = acceptedFiles.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previewPromises).then((preview) => {
      setImagePreviews(preview);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"],
    },
    multiple: true,
    onDrop,
    maxFiles: 5,
  });

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Editor Controls Card */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              {activeTab === "edit" ? (
                <>
                  <Upload className="w-5 h-5" />
                  Upload & Edit
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Generate Image
                </>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <Tabs
              defaultValue="edit"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/60">
                <TabsTrigger
                  value="edit"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload & Edit
                </TabsTrigger>
                <TabsTrigger
                  value="generate"
                  className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Image
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4 mt-6">
                {imagePreviews.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {imagePreviews.map((preview, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-lg overflow-hidden border border-border/80 group"
                        >
                          <Image
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllImages}
                        className="text-xs text-destructive hover:text-destructive flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear Images
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragActive
                        ? "border-primary bg-primary/5 scale-[0.99]"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {isDragActive
                            ? "Drop your images here"
                            : "Click to upload or drag & drop"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PNG, JPG, WEBP up to 5 images
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="generate" className="space-y-4 mt-6">
                <div className="rounded-xl p-6 text-center border border-dashed border-border bg-muted/20">
                  <div className="space-y-3">
                    <div className="inline-flex p-3 rounded-2xl bg-muted text-foreground">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        AI Text-to-Image Studio
                      </p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                        Describe what you want to create and our engine will generate high-resolution visual art.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/40 border border-border/60 p-3.5 rounded-lg flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-foreground">
                    <Wand2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">High-Speed Cloud Inference</p>
                    <p className="text-muted-foreground">Real-time processing with automated prompt enhancement</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Quick Suggestions Chips */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {activeTab === "edit" ? "Editing Prompt" : "Generation Prompt"}
                </Label>
                <span className="text-[11px] text-muted-foreground/80">Try an example:</span>
              </div>

              <div className="flex flex-wrap gap-1.5 pb-1">
                {quickPrompts.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPrompt(chip.text);
                      if (activeTab === "edit" && selectedImages.length === 0) {
                        setActiveTab("generate");
                      }
                    }}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/80 bg-muted/40 hover:bg-muted hover:border-foreground/30 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <Textarea
                id="prompt"
                placeholder={
                  activeTab === "edit"
                    ? "e.g. Turn into a majestic lion standing on a cliff..."
                    : "e.g. A futuristic sports car speeding through a cyberpunk city with neon lights..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="resize-none text-sm focus-visible:ring-ring"
              />
            </div>

            {/* Process Button */}
            <Button
              onClick={handleProcessImage}
              disabled={
                (activeTab === "edit" &&
                  (selectedImages.length === 0 || !prompt.trim())) ||
                (activeTab === "generate" && !prompt.trim()) ||
                isProcessing
              }
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-sm"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing Visual Art...
                </>
              ) : activeTab === "edit" ? (
                <>
                  <Paintbrush className="w-4 h-4 mr-2" />
                  Edit {selectedImages.length > 0 ? `${selectedImages.length} Image(s)` : "Image"}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Image
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Inference Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground animate-pulse">
                  {progress < 40
                    ? "Initializing AI model..."
                    : progress < 80
                    ? "Synthesizing pixels..."
                    : "Finalizing high-res output..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Showcase Card */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow backdrop-blur-sm bg-card/95 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <ImageIcon className="w-5 h-5 text-foreground" />
              <span>Results</span>
              <Badge variant="secondary" className="ml-1 text-xs px-2 py-0.5 rounded-full font-mono font-medium">
                {results.length}
              </Badge>
            </CardTitle>
            {results.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllResults}
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear All
              </Button>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden">
            {results.length === 0 ? (
              <div className="text-center py-16 px-4 text-muted-foreground space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground/60 border border-border/50">
                  <ImageIcon className="w-8 h-8 opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">No artwork generated yet</p>
                  <p className="text-xs max-w-xs mx-auto text-muted-foreground">
                    Upload an image to edit or choose a quick prompt to generate high-resolution art.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-h-[680px] overflow-y-auto pr-2">
                {results.map((result, index) => (
                  <div
                    key={result.id || index}
                    className="border border-border/70 rounded-xl p-4 space-y-3.5 bg-background/50 hover:border-foreground/30 transition-colors"
                  >
                    {/* Header info & Delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium px-2 py-0.5 bg-muted text-foreground border-none"
                        >
                          {result.type === "generate" ? (
                            <>
                              <Sparkles className="w-3 h-3 mr-1 inline" />
                              Generated
                            </>
                          ) : (
                            <>
                              <Paintbrush className="w-3 h-3 mr-1 inline" />
                              Edited
                            </>
                          )}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteResult(index, result.id)}
                        className="text-muted-foreground/60 hover:text-destructive p-1 rounded-md transition-colors"
                        title="Delete image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Result Image with Zoom on Click */}
                    {result.url && (
                      <div
                        onClick={() =>
                          setPreviewModal({
                            url: result.url,
                            prompt: result.prompt,
                          })
                        }
                        className="group relative w-full rounded-lg overflow-hidden border border-border/60 bg-muted/30 flex items-center justify-center cursor-zoom-in"
                        title="Click to view fullscreen"
                      >
                        <img
                          src={result.url}
                          alt={result.prompt || "Result"}
                          className="w-full h-auto max-h-[460px] object-contain rounded-md transition-transform duration-300 group-hover:scale-[1.01]"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-medium backdrop-blur-[2px]">
                          <Maximize2 className="w-4 h-4" />
                          <span>View Fullscreen</span>
                        </div>
                      </div>
                    )}

                    {/* Prompt Details */}
                    {result.prompt && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Prompt:
                        </p>
                        <div className="bg-muted/40 border border-border/60 rounded-md p-2.5 text-xs text-foreground/90 leading-relaxed font-sans">
                          {result.prompt}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleDownload(
                            result.url,
                            `pixelai-${index + 1}.png`
                          )
                        }
                        className="flex-1 text-xs gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.url)}
                        className="flex-1 text-xs gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy URL
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Image Preview Lightbox Modal */}
      {previewModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewModal(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </button>

            {/* Modal Image */}
            <div className="relative max-h-[75vh] w-full flex items-center justify-center overflow-hidden rounded-xl bg-black/40 border border-white/10">
              <img
                src={previewModal.url}
                alt={previewModal.prompt || "Preview"}
                className="max-h-[75vh] max-w-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Modal Footer Info */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-white text-xs px-2">
              <p className="line-clamp-2 max-w-xl text-white/80 text-center sm:text-left">
                {previewModal.prompt || "Generated Artwork"}
              </p>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    handleDownload(previewModal.url, "artwork-full.png")
                  }
                  className="text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(previewModal.url)}
                  className="text-xs gap-1.5 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy URL
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditor;
