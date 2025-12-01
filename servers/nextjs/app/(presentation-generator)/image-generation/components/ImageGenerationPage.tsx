"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Download,
  Loader2,
  Image as ImageIcon,
  Wand2,
  Copy,
  Trash2,
  ZoomIn,
  History,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

// Types
interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  createdAt: string;
  isLoading?: boolean;
}

interface HistorySession {
  id: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  images: GeneratedImage[];
  createdAt: string;
}

interface ImageGenerationConfig {
  model: string;
  count: number;
  aspectRatio: string;
  resolution: string;
}

// Constants
const STORAGE_KEY = "presenton_image_generation_history";

const MODELS = [
  { id: "gemini-3-pro-image-preview", name: "Nano Banana 3", description: "高质量多模态图像生成" },
  { id: "dall-e-3", name: "DALL-E 3", description: "OpenAI 图像生成模型" },
  { id: "gpt-image-1", name: "GPT Image 1", description: "GPT 系列图像模型" },
];

const ASPECT_RATIOS = [
  { id: "1:1", name: "1:1", description: "正方形" },
  { id: "16:9", name: "16:9", description: "宽屏横向" },
  { id: "9:16", name: "9:16", description: "竖屏纵向" },
  { id: "4:3", name: "4:3", description: "标准横向" },
  { id: "3:4", name: "3:4", description: "标准纵向" },
  { id: "3:2", name: "3:2", description: "照片横向" },
  { id: "2:3", name: "2:3", description: "照片纵向" },
];

const RESOLUTIONS = [
  { id: "1024x1024", name: "1024 x 1024", description: "标准" },
  { id: "1536x1536", name: "1536 x 1536", description: "高清" },
  { id: "2048x2048", name: "2048 x 2048", description: "超高清" },
];

const COUNTS = [1, 2, 3, 4];

// Skeleton Loading Component
const ImageSkeleton: React.FC<{ aspectRatio: string }> = ({ aspectRatio }) => {
  return (
    <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 aspect-square shadow-md">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent skeleton-shimmer" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-300/50 flex items-center justify-center mb-3 animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <p className="text-sm font-medium animate-pulse">生成中...</p>
      </div>
    </div>
  );
};

const ImageGenerationPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState<ImageGenerationConfig>({
    model: "gemini-3-pro-image-preview",
    count: 1,
    aspectRatio: "1:1",
    resolution: "1024x1024",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: HistorySession[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  }, []);

  const handleConfigChange = useCallback((key: keyof ImageGenerationConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入图像描述");
      return;
    }

    setIsGenerating(true);
    const sessionId = `session-${Date.now()}`;
    const currentPrompt = prompt;
    const currentConfig = { ...config };

    // Create placeholder loading images
    const placeholders: GeneratedImage[] = Array.from({ length: config.count }, (_, i) => ({
      id: `${sessionId}-${i}`,
      url: "",
      prompt: currentPrompt,
      model: currentConfig.model,
      aspectRatio: currentConfig.aspectRatio,
      resolution: currentConfig.resolution,
      createdAt: new Date().toISOString(),
      isLoading: true,
    }));

    // Add placeholders to the current view
    setGeneratedImages(prev => [...placeholders, ...prev]);

    const completedImages: GeneratedImage[] = [];
    let hasError = false;

    // Generate images one by one and replace placeholders
    for (let i = 0; i < currentConfig.count; i++) {
      try {
        const response = await fetch(
          `/api/v1/ppt/images/generate?prompt=${encodeURIComponent(currentPrompt)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("图像生成失败");
        }

        const imagePath = await response.text();
        const newImage: GeneratedImage = {
          id: `${sessionId}-${i}`,
          url: imagePath.replace(/"/g, ''),
          prompt: currentPrompt,
          model: currentConfig.model,
          aspectRatio: currentConfig.aspectRatio,
          resolution: currentConfig.resolution,
          createdAt: new Date().toISOString(),
          isLoading: false,
        };

        completedImages.push(newImage);

        // Replace the placeholder with the actual image
        setGeneratedImages(prev => prev.map(img =>
          img.id === `${sessionId}-${i}` ? newImage : img
        ));
      } catch (error) {
        console.error(`Image ${i + 1} generation error:`, error);
        hasError = true;
        // Remove failed placeholder
        setGeneratedImages(prev => prev.filter(img => img.id !== `${sessionId}-${i}`));
      }
    }

    // Save to history if we have at least one successful image
    if (completedImages.length > 0) {
      const newSession: HistorySession = {
        id: sessionId,
        prompt: currentPrompt,
        model: currentConfig.model,
        aspectRatio: currentConfig.aspectRatio,
        resolution: currentConfig.resolution,
        images: completedImages,
        createdAt: new Date().toISOString(),
      };

      const newHistory = [newSession, ...history].slice(0, 50); // Keep last 50 sessions
      saveHistory(newHistory);

      toast.success(`成功生成 ${completedImages.length} 张图像`);
    }

    if (hasError && completedImages.length === 0) {
      toast.error("图像生成失败，请重试");
    } else if (hasError) {
      toast.warning(`部分图像生成失败，成功 ${completedImages.length}/${currentConfig.count} 张`);
    }

    setIsGenerating(false);
  };

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("图像下载成功");
    } catch (error) {
      toast.error("下载失败");
    }
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("提示词已复制");
  };

  const handleDelete = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
    toast.success("图像已删除");
  };

  const handleDeleteSession = (sessionId: string) => {
    const newHistory = history.filter(s => s.id !== sessionId);
    saveHistory(newHistory);
    toast.success("历史记录已删除");
  };

  const handleClearHistory = () => {
    saveHistory([]);
    toast.success("历史记录已清空");
  };

  const handleLoadFromHistory = (session: HistorySession) => {
    setPrompt(session.prompt);
    setConfig({
      model: session.model,
      count: session.images.length,
      aspectRatio: session.aspectRatio,
      resolution: session.resolution,
    });
    toast.success("已加载历史配置");
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const getModelName = (modelId: string) => {
    return MODELS.find(m => m.id === modelId)?.name || modelId;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter out loading images for display count
  const loadedImages = generatedImages.filter(img => !img.isLoading);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Add shimmer animation styles */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .skeleton-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-700">AI 图像生成</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            将想象变为现实
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            使用先进的 AI 模型，通过文字描述生成高质量图像
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Prompt Input Card */}
            <Card className="border-0 shadow-lg shadow-gray-200/50 bg-white/80 backdrop-blur">
              <CardContent className="p-6 space-y-5">
                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-violet-500" />
                    模型选择
                  </label>
                  <Select
                    value={config.model}
                    onValueChange={(value) => handleConfigChange("model", value)}
                  >
                    <SelectTrigger className="w-full bg-gray-50 border-gray-200 focus:ring-violet-500 focus:border-violet-500">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-xs text-gray-500">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt Textarea */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    图像描述
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要生成的图像...&#10;&#10;例如：一只可爱的橘猫正在阳光下的花园里玩耍，周围有蝴蝶飞舞，画面温馨明亮，采用水彩画风格"
                    className="min-h-[160px] bg-gray-50 border-gray-200 focus:ring-violet-500 focus:border-violet-500 resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    提示：详细的描述可以获得更好的结果
                  </p>
                </div>

                {/* Configuration Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Count */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      生成数量
                    </label>
                    <Select
                      value={config.count.toString()}
                      onValueChange={(value) => handleConfigChange("count", parseInt(value))}
                    >
                      <SelectTrigger className="w-full bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTS.map((count) => (
                          <SelectItem key={count} value={count.toString()}>
                            {count} 张
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      宽高比
                    </label>
                    <Select
                      value={config.aspectRatio}
                      onValueChange={(value) => handleConfigChange("aspectRatio", value)}
                    >
                      <SelectTrigger className="w-full bg-gray-50 border-gray-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio.id} value={ratio.id}>
                            <span className="font-medium">{ratio.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{ratio.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Resolution */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    分辨率
                  </label>
                  <Select
                    value={config.resolution}
                    onValueChange={(value) => handleConfigChange("resolution", value)}
                  >
                    <SelectTrigger className="w-full bg-gray-50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLUTIONS.map((res) => (
                        <SelectItem key={res.id} value={res.id}>
                          <span className="font-medium">{res.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{res.description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-200"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      生成图像
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Tips Card */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-50">
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-800 mb-3">提示技巧</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-violet-500 mt-1">•</span>
                    描述主体、场景、光线和氛围
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-500 mt-1">•</span>
                    指定艺术风格（如水彩、油画、3D渲染）
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-500 mt-1">•</span>
                    使用具体的颜色和材质描述
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-500 mt-1">•</span>
                    参考知名艺术家或作品风格
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Generated Images */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Generation Results */}
            <Card className="border-0 shadow-lg shadow-gray-200/50 bg-white/80 backdrop-blur min-h-[400px]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-violet-500" />
                    生成结果
                  </h2>
                  {loadedImages.length > 0 && (
                    <span className="text-sm text-gray-500">
                      {loadedImages.length} 张图像
                    </span>
                  )}
                </div>

                {generatedImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                    <p className="text-lg font-medium">暂无生成的图像</p>
                    <p className="text-sm mt-1">输入描述并点击生成按钮开始创作</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {generatedImages.map((image) => (
                      image.isLoading ? (
                        <ImageSkeleton key={image.id} aspectRatio={image.aspectRatio} />
                      ) : (
                        <div
                          key={image.id}
                          className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-square shadow-md hover:shadow-xl transition-shadow duration-300"
                        >
                          <img
                            src={image.url}
                            alt={image.prompt}
                            className="w-full h-full object-cover"
                          />

                          {/* Overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {/* Top Actions */}
                            <div className="absolute top-3 right-3 flex gap-2">
                              <button
                                onClick={() => setSelectedImage(image)}
                                className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg transition-colors"
                                title="放大查看"
                              >
                                <ZoomIn className="w-4 h-4 text-gray-700" />
                              </button>
                              <button
                                onClick={() => handleDownload(image)}
                                className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg transition-colors"
                                title="下载图像"
                              >
                                <Download className="w-4 h-4 text-gray-700" />
                              </button>
                              <button
                                onClick={() => handleDelete(image.id)}
                                className="p-2 bg-white/90 hover:bg-red-50 rounded-lg shadow-lg transition-colors"
                                title="删除图像"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>

                            {/* Bottom Info */}
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur rounded-full text-white">
                                  {getModelName(image.model)}
                                </span>
                                <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur rounded-full text-white">
                                  {image.aspectRatio}
                                </span>
                              </div>
                              <p className="text-sm text-white/90 line-clamp-2 mb-2">
                                {image.prompt}
                              </p>
                              <button
                                onClick={() => handleCopyPrompt(image.prompt)}
                                className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                                复制提示词
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History Section */}
            <Card className="border-0 shadow-lg shadow-gray-200/50 bg-white/80 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-lg font-semibold text-gray-800 hover:text-violet-600 transition-colors"
                  >
                    <History className="w-5 h-5 text-violet-500" />
                    生成历史
                    {showHistory ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearHistory}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      清空历史
                    </Button>
                  )}
                </div>

                {/* Storage Warning */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg mb-4 text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">
                    历史记录保存在浏览器本地存储中。清除浏览器缓存或更换浏览器后，历史记录将会丢失。
                  </p>
                </div>

                {showHistory && (
                  <>
                    {history.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">暂无历史记录</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {history.map((session) => (
                          <div
                            key={session.id}
                            className="border border-gray-200 rounded-xl overflow-hidden hover:border-violet-300 transition-colors"
                          >
                            {/* Session Header */}
                            <div
                              className="p-4 bg-gray-50 cursor-pointer"
                              onClick={() => toggleSession(session.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                                      {getModelName(session.model)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {session.images.length} 张图像
                                    </span>
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatDate(session.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {session.prompt}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLoadFromHistory(session);
                                    }}
                                    className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    使用
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSession(session.id);
                                    }}
                                    className="text-gray-400 hover:text-red-500"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                  {expandedSessions.has(session.id) ? (
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Session Images */}
                            {expandedSessions.has(session.id) && (
                              <div className="p-4 border-t border-gray-200 bg-white">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {session.images.map((image) => (
                                    <div
                                      key={image.id}
                                      className="group relative rounded-lg overflow-hidden bg-gray-100 aspect-square cursor-pointer"
                                      onClick={() => setSelectedImage(image)}
                                    >
                                      <img
                                        src={image.url}
                                        alt={image.prompt}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage.url}
                alt={selectedImage.prompt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm">{selectedImage.prompt}</p>
                <div className="flex items-center gap-4 mt-3">
                  <Button
                    onClick={() => handleDownload(selectedImage)}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载
                  </Button>
                  <Button
                    onClick={() => handleCopyPrompt(selectedImage.prompt)}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制提示词
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageGenerationPage;
