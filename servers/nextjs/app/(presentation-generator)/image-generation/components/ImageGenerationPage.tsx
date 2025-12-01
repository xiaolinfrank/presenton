"use client";

import React, { useState, useCallback } from "react";
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
  ZoomIn
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
  createdAt: Date;
}

interface ImageGenerationConfig {
  model: string;
  count: number;
  aspectRatio: string;
  resolution: string;
}

// Constants
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

  const handleConfigChange = useCallback((key: keyof ImageGenerationConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入图像描述");
      return;
    }

    setIsGenerating(true);

    try {
      // Generate images based on count
      const newImages: GeneratedImage[] = [];

      for (let i = 0; i < config.count; i++) {
        const response = await fetch(
          `/api/v1/ppt/images/generate?prompt=${encodeURIComponent(prompt)}`,
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

        newImages.push({
          id: `${Date.now()}-${i}`,
          url: imagePath.replace(/"/g, ''),
          prompt: prompt,
          model: config.model,
          aspectRatio: config.aspectRatio,
          createdAt: new Date(),
        });
      }

      setGeneratedImages(prev => [...newImages, ...prev]);
      toast.success(`成功生成 ${newImages.length} 张图像`);
    } catch (error) {
      console.error("Image generation error:", error);
      toast.error("图像生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
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

  const getModelName = (modelId: string) => {
    return MODELS.find(m => m.id === modelId)?.name || modelId;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
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
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg shadow-gray-200/50 bg-white/80 backdrop-blur min-h-[600px]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-violet-500" />
                    生成结果
                  </h2>
                  {generatedImages.length > 0 && (
                    <span className="text-sm text-gray-500">
                      {generatedImages.length} 张图像
                    </span>
                  )}
                </div>

                {generatedImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                    <p className="text-lg font-medium">暂无生成的图像</p>
                    <p className="text-sm mt-1">输入描述并点击生成按钮开始创作</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {generatedImages.map((image) => (
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
                    ))}
                  </div>
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
