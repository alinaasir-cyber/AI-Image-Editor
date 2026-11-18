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
import { Upload, Wand2, Sparkles, X, Trash2, ImageIcon, Loader2, Paintbrush, Download, Copy } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

interface EditResult {
  url: string;
  prompt?: string;
  timestamp: number;
  type: string;
  imageCount?: number;
}

const ImageEditor = () => {
  const [activeTab, setActiveTab] = useState("edit");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<EditResult[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved results from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_image_editor_results");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setResults(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load results from localStorage", e);
    } finally {
      setIsLoaded(true);
    }
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

  const handleDownload = async (url: string, filename: string) => {
    try {
      // Use internal proxy route to bypass browser CORS restrictions
      const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
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
      console.log(data);

      if (data.success && data.output) {
        const newResult: EditResult = {
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
    maxFiles: 5, // 5 images
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload and Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              {activeTab === "edit" ? "Upload & Edit" : "Generate Image"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as string)}
              className="w-full"
            >
              {/* Tab List */}
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload & Edit
                </TabsTrigger>
                <TabsTrigger value="generate" className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Generate Image
                </TabsTrigger>
              </TabsList>

              {/* Upload & Edit Tab Content */}
              <TabsContent value="edit" className="space-y-6 mt-6">
                {imagePreviews.length > 0 ? (
                  <div className="space-y-4">
                    {/* Grid layout for multiple images */}
                    <div
                      className={`grid gap-3 ${imagePreviews.length === 1
                          ? "grid-cols-1"
                          : imagePreviews.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-2 md:grid-cols-3"
                        }`}
                    >
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <Image
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            width={150}
                            height={150}
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                          <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {index + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 left-1 bg-red-600/80 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
                            title="Remove image"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
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
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive
                        ? "border-primary bg-primary/10"
                        : "border-muted-foreground/25 hover:border-primary/50"
                      }`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-10 h-10 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">
                        {isDragActive ? "Drop images here..." : "Drag & drop images"}
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="generate" className="space-y-6 mt-6">
                {/* Generation Preview */}
                <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gradient-to-br from-primary/5 to-secondary/5">
                  <div className="space-y-4">
                    <Sparkles className="w-12 h-12 mx-auto text-primary" />
                    <div>
                      <p className="text-lg font-medium">AI Image Generation</p>
                      <p className="text-sm text-muted-foreground">
                        Describe what you want to create and AI will generate it
                      </p>
                    </div>
                  </div>
                </div>

                {/* Model Info for Generation */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-medium">Google Gemini 2.5 Flash</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Advanced AI model for generating high-quality, realistic images from text descriptions.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Prompt Input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">
                {activeTab === "edit" ? "Editing Prompt" : "Generation Prompt"}
              </Label>
              <Textarea
                id="prompt"
                placeholder={
                  activeTab === "edit"
                    ? "Describe how you want to edit the image..."
                    : "Describe what you want to generate in detail..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
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
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {activeTab === "edit" ? (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Edit{" "}
                      {selectedImages.length > 0
                        ? `${selectedImages.length} Image(s)`
                        : "Images"}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Image
                    </>
                  )}
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  {progress < 30
                    ? "Uploading image..."
                    : progress < 60
                      ? "Processing with nano-banana..."
                      : progress < 90
                        ? "Generating result..."
                        : "Almost done..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Results ({results.length})
            </CardTitle>
            {results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResults([])}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No results yet</p>
                <p className="text-sm">
                  Upload images and process them to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {result.type === "generate" ? (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            Generated
                          </>
                        ) : (
                          <>
                            <Paintbrush className="w-3 h-3 mr-1" />
                            {result.imageCount} Image
                            {result.imageCount && result.imageCount > 1
                              ? "s"
                              : ""}{" "}
                            Edited
                          </>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Result Image */}
                    {result.url && (
                      <div className="relative w-full rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center">
                        <img
                          src={result.url}
                          alt={result.prompt || "Result"}
                          className="w-full h-auto max-h-[480px] object-contain rounded-md"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    {/* Prompt Details */}
                    {result.prompt && (
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold text-foreground">
                          Prompt:
                        </p>
                        <div className="bg-muted/40 border rounded-md p-2.5 text-xs text-muted-foreground">
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
                            `generated-${index + 1}.png`
                          )
                        }
                        className="flex-1"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(result.url)}
                        className="flex-1"
                      >
                        <Copy className="w-3 h-3 mr-1" />
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
    </div>
  );
};

export default ImageEditor;
