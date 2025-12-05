"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Download,
  Loader2,
  Image as ImageIcon,
  Wand2,
  Copy,
  Trash2,
  ZoomIn,
  Plus,
  MessageSquare,
  Send,
  Settings2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Zap,
  Palette,
  Bot,
  Paperclip,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  imageSessionStorage,
  type ChatSession,
  type ChatMessage,
  type GeneratedImage,
  type ImageGenerationConfig,
} from "../lib/imageSessionStorage";

// Local types (not exported from lib)
interface ReferenceImage {
  id: string;
  file: File;
  previewUrl: string;
  base64?: string;
}

// Constants

const MODELS = [
  {
    id: "gemini-3-pro-image-preview",
    name: "Nano Banana Pro",
    description: "高质量多模态图像生成",
    icon: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
    color: "from-yellow-400 to-orange-500",
    singleTurnOnly: false,
  },
  {
    id: "z-image",
    name: "Z-Image",
    description: "通义万相图像生成（单轮对话）",
    icon: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
    color: "from-purple-400 to-pink-500",
    singleTurnOnly: true,  // Z-Image only supports single-turn conversations
  },
];

const ASPECT_RATIOS = [
  { id: "1:1", name: "1:1", description: "正方形" },
  { id: "16:9", name: "16:9", description: "宽屏横向" },
  { id: "9:16", name: "9:16", description: "竖屏纵向" },
  { id: "4:3", name: "4:3", description: "标准横向" },
  { id: "3:4", name: "3:4", description: "标准纵向" },
  { id: "3:2", name: "3:2", description: "照片横向" },
  { id: "2:3", name: "2:3", description: "照片纵向" },
  { id: "4:5", name: "4:5", description: "社交媒体纵向" },
  { id: "5:4", name: "5:4", description: "社交媒体横向" },
  { id: "21:9", name: "21:9", description: "超宽屏" },
];

const RESOLUTIONS = [
  { id: "1K", name: "1K", description: "标准" },
  { id: "2K", name: "2K", description: "高清" },
  { id: "4K", name: "4K", description: "超高清" },
];

const COUNTS = [1, 2, 3, 4];

const DEFAULT_CONFIG: ImageGenerationConfig = {
  model: "gemini-3-pro-image-preview",
  count: 1,
  aspectRatio: "1:1",
  resolution: "1K",
};

// Helper function to generate title from first prompt
const generateTitle = (prompt: string): string => {
  const maxLength = 20;
  if (prompt.length <= maxLength) return prompt;
  return prompt.substring(0, maxLength) + "...";
};

const ImageGenerationPage: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [config, setConfig] = useState<ImageGenerationConfig>(DEFAULT_CONFIG);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [previewReferenceImage, setPreviewReferenceImage] = useState<string | null>(null);  // base64 of reference image to preview
  const [showSettings, setShowSettings] = useState(true);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get current session
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Load sessions from IndexedDB on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const storedSessions = await imageSessionStorage.getAllSessions();
        setSessions(storedSessions);
        // Auto-select the most recent session if exists
        if (storedSessions.length > 0) {
          setCurrentSessionId(storedSessions[0].id);
          setConfig(storedSessions[0].config);
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
      }
    };
    loadSessions();
  }, []);

  // Save sessions to IndexedDB
  const saveSessions = useCallback((newSessions: ChatSession[]) => {
    // Always update React state first
    setSessions(newSessions);
    // Save to IndexedDB asynchronously (no quota issues with IndexedDB)
    imageSessionStorage.saveSessions(newSessions).catch(error => {
      console.error("Failed to save sessions to IndexedDB:", error);
    });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [currentSession?.messages]);

  // Create new session
  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: "新对话",
      messages: [],
      config: { ...DEFAULT_CONFIG },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newSessions = [newSession, ...sessions];
    saveSessions(newSessions);
    setCurrentSessionId(newSession.id);
    setConfig(DEFAULT_CONFIG);
    setPrompt("");
  }, [sessions, saveSessions]);

  // Select session
  const handleSelectSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setConfig(session.config);
      setPrompt("");
    }
  }, [sessions]);

  // Delete session
  const handleDeleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(newSessions);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
      if (newSessions.length > 0) {
        setConfig(newSessions[0].config);
      }
    }
    toast.success("会话已删除");
  }, [sessions, currentSessionId, saveSessions]);

  const handleConfigChange = useCallback((key: keyof ImageGenerationConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    // Clear reference images when switching to a single-turn model
    if (key === "model") {
      const newModel = MODELS.find(m => m.id === value);
      if (newModel?.singleTurnOnly && referenceImages.length > 0) {
        referenceImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
        setReferenceImages([]);
        toast.info("单轮模型不支持参考图像，已清除");
      }
    }
  }, [referenceImages]);

  // Handle reference image upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ReferenceImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} 不是有效的图像文件`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} 文件大小超过 10MB`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);

      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      newImages.push({
        id: `ref-${Date.now()}-${i}`,
        file,
        previewUrl,
        base64,
      });
    }

    if (newImages.length > 0) {
      setReferenceImages(prev => [...prev, ...newImages]);
      toast.success(`已添加 ${newImages.length} 张参考图像`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Remove reference image
  const handleRemoveReferenceImage = useCallback((imageId: string) => {
    setReferenceImages(prev => {
      const image = prev.find(img => img.id === imageId);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
      return prev.filter(img => img.id !== imageId);
    });
  }, []);

  // Clear all reference images
  const handleClearReferenceImages = useCallback(() => {
    referenceImages.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setReferenceImages([]);
  }, [referenceImages]);

  // Helper function to convert image URL to base64
  const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to convert image to base64:", error);
      return "";
    }
  };

  // Build conversation history for API request (OpenAI multimodal format)
  const buildConversationHistory = async (
    sessionMessages: ChatMessage[],
    newPrompt: string,
    currentUserMessageId?: string,  // ID of current user message to exclude
    refImages?: ReferenceImage[]    // Reference images to include
  ): Promise<Array<{ role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}>}>> => {
    const messages: Array<{ role: string; content: string | Array<{type: string; text?: string; image_url?: {url: string}}>}> = [];

    // Process existing messages (exclude loading messages and current user message)
    for (const msg of sessionMessages) {
      if (msg.isLoading) continue;
      if (currentUserMessageId && msg.id === currentUserMessageId) continue;  // Skip current user message

      if (msg.role === "user") {
        messages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant" && msg.images && msg.images.length > 0) {
        // For assistant messages with images, include successful images as USER role
        // to avoid "thought_signature" errors. The API requires thought_signature for
        // images in assistant messages, but not for user messages.
        const successfulImages = msg.images.filter(img => img.url && !img.error);

        if (successfulImages.length > 0) {
          // Convert all successful images to base64 and send as user role
          const imageContents: Array<{type: string; text?: string; image_url?: {url: string}}> = [];

          for (const img of successfulImages) {
            try {
              const base64 = await imageUrlToBase64(img.url);
              if (base64) {
                imageContents.push({
                  type: "image_url",
                  image_url: { url: base64 }
                });
              }
            } catch (error) {
              // Skip this image if conversion fails
            }
          }

          if (imageContents.length > 0) {
            // Add a text description to indicate these are previously generated images
            imageContents.push({
              type: "text",
              text: "[以上是之前生成的图片]"
            });
            messages.push({
              role: "user",
              content: imageContents,
            });
          }
        }
      }
    }

    // Add the new user message with optional reference images
    if (refImages && refImages.length > 0) {
      // Build multimodal content with reference images + text prompt
      const userContent: Array<{type: string; text?: string; image_url?: {url: string}}> = [];

      // Add reference images first
      for (const refImg of refImages) {
        if (refImg.base64) {
          userContent.push({
            type: "image_url",
            image_url: { url: refImg.base64 }
          });
        }
      }

      // Add text prompt
      userContent.push({
        type: "text",
        text: newPrompt
      });

      messages.push({
        role: "user",
        content: userContent,
      });
    } else {
      // Simple text-only message
      messages.push({
        role: "user",
        content: newPrompt,
      });
    }

    return messages;
  };

  const handleGenerate = async (overridePrompt?: string, overrideConfig?: ImageGenerationConfig) => {
    const currentPrompt = overridePrompt || prompt;
    if (!currentPrompt.trim()) {
      toast.error("请输入图像描述");
      return;
    }

    const currentConfig = overrideConfig || { ...config };

    // Create session if none exists
    let sessionId = currentSessionId;
    let updatedSessions = [...sessions];

    if (!sessionId) {
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: generateTitle(currentPrompt),
        messages: [],
        config: { ...currentConfig },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedSessions = [newSession, ...sessions];
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
    }

    setIsGenerating(true);

    // Build the enhanced prompt with aspect ratio
    const enhancedPrompt = `${currentPrompt}（图像比例 ${currentConfig.aspectRatio}）`;

    // Add user message (track reference image count and base64s for retry)
    const refBase64s = referenceImages.length > 0
      ? referenceImages.map(img => img.base64).filter((b): b is string => !!b)
      : undefined;
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: currentPrompt,
      referenceImageCount: referenceImages.length > 0 ? referenceImages.length : undefined,
      referenceImageBase64s: refBase64s,
      timestamp: new Date().toISOString(),
    };

    // Add assistant loading message
    const loadingMessageId = `msg-${Date.now()}-assistant`;
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      role: "assistant",
      content: "",
      images: Array.from({ length: currentConfig.count }, (_, i) => ({
        id: `img-${Date.now()}-${i}`,
        url: "",
        prompt: currentPrompt,
        model: currentConfig.model,
        aspectRatio: currentConfig.aspectRatio,
        resolution: currentConfig.resolution,
        createdAt: new Date().toISOString(),
        isLoading: true,
      })),
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    // Update session with messages
    updatedSessions = updatedSessions.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          title: s.messages.length === 0 ? generateTitle(currentPrompt) : s.title,
          messages: [...s.messages, userMessage, loadingMessage],
          config: currentConfig,
          updatedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    saveSessions(updatedSessions);
    if (!overridePrompt) {
      setPrompt("");
    }

    // Get the current session's existing messages for conversation history
    const existingSession = updatedSessions.find(s => s.id === sessionId);
    const existingMessages = existingSession?.messages.filter(m => m.id !== loadingMessageId) || [];

    // Build conversation history (this converts images to base64)
    // Pass userMessage.id to exclude the current user message (we add it with enhanced prompt)
    // Include reference images if any
    const currentRefImages = [...referenceImages];
    const conversationHistory = await buildConversationHistory(existingMessages, enhancedPrompt, userMessage.id, currentRefImages);

    // Clear reference images after starting generation
    handleClearReferenceImages();

    // Check if the current model is Z-Image (single-turn only)
    const isZImageModel = currentConfig.model === "z-image";

    // Generate images in parallel using multi-turn API (or single-turn for Z-Image)
    const generateSingleImage = async (index: number): Promise<GeneratedImage | null> => {
      try {
        let response: Response;

        if (isZImageModel) {
          // Z-Image uses a dedicated endpoint and only supports single-turn
          response = await fetch("/api/v1/ppt/images/z-image/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: enhancedPrompt,
              aspect_ratio: currentConfig.aspectRatio,
            }),
          });
        } else {
          // Other models use multi-turn chat endpoint
          response = await fetch("/api/v1/ppt/images/chat/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: conversationHistory,
              aspect_ratio: currentConfig.aspectRatio,
              image_size: currentConfig.resolution,
            }),
          });
        }

        if (!response.ok) {
          let errorMessage = "图像生成失败";
          // Clone the response so we can try both json() and text()
          const responseText = await response.text();
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.detail || errorMessage;
          } catch {
            if (responseText) errorMessage = responseText;
          }
          throw new Error(errorMessage);
        }

        const imagePath = await response.text();
        const cleanUrl = imagePath.replace(/"/g, '').trim();

        // Validate that we got a valid image path
        if (!cleanUrl || cleanUrl === 'null' || cleanUrl === 'undefined') {
          throw new Error("服务器返回空响应，图像生成失败");
        }

        // Validate that the URL looks like a valid file path or URL
        if (!cleanUrl.startsWith('/') && !cleanUrl.startsWith('http')) {
          throw new Error(`服务器返回无效响应: ${cleanUrl.substring(0, 100)}`);
        }

        return {
          id: `img-${Date.now()}-${index}`,
          url: cleanUrl,
          prompt: currentPrompt,
          model: currentConfig.model,
          aspectRatio: currentConfig.aspectRatio,
          resolution: currentConfig.resolution,
          createdAt: new Date().toISOString(),
          isLoading: false,
        };
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : "图像生成失败";
        if (!errorMessage) errorMessage = "图像生成失败";
        console.error(`Image ${index + 1} generation error:`, errorMessage);
        return {
          id: `img-${Date.now()}-${index}`,
          url: "",
          prompt: currentPrompt,
          model: currentConfig.model,
          aspectRatio: currentConfig.aspectRatio,
          resolution: currentConfig.resolution,
          createdAt: new Date().toISOString(),
          isLoading: false,
          error: errorMessage,
        };
      }
    };

    // Launch all requests in parallel
    const results = await Promise.all(
      Array.from({ length: currentConfig.count }, (_, i) => generateSingleImage(i))
    );

    let completedImages = results.filter((img): img is GeneratedImage => img !== null);
    const successfulImages = completedImages.filter(img => !img.error);

    // Ensure we always have at least one image (even if it's an error) to show in the UI
    if (completedImages.length === 0) {
      completedImages = [{
        id: `img-${Date.now()}-error`,
        url: "",
        prompt: currentPrompt,
        model: currentConfig.model,
        aspectRatio: currentConfig.aspectRatio,
        resolution: currentConfig.resolution,
        createdAt: new Date().toISOString(),
        isLoading: false,
        error: "图像生成失败，请重试",
      }];
    }

    // Update the assistant message with results using functional update
    // This ensures we're working with the latest state
    setSessions(currentSessions => {
      const finalSessions = currentSessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: s.messages.map(m => {
              if (m.id === loadingMessageId) {
                return {
                  ...m,
                  content: successfulImages.length > 0
                    ? `已生成 ${successfulImages.length} 张图像`
                    : "图像生成失败",
                  images: completedImages,
                  isLoading: false,
                };
              }
              return m;
            }),
            updatedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      // Save to IndexedDB (no quota issues, keep all data including base64)
      imageSessionStorage.saveSessions(finalSessions).catch(error => {
        console.error("Failed to save sessions to IndexedDB:", error);
      });

      return finalSessions;
    });

    if (successfulImages.length > 0) {
      toast.success(`成功生成 ${successfulImages.length} 张图像`);
      // Show single-turn reminder for Z-Image model
      if (isZImageModel) {
        setTimeout(() => {
          toast.info("Z-Image 模型仅支持单轮对话，建议新建对话进行下一次生成", {
            duration: 5000,
          });
        }, 500);
      }
    } else {
      toast.error("图像生成失败，请重试");
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

  const getModelName = (modelId: string) => {
    return MODELS.find(m => m.id === modelId)?.name || modelId;
  };

  const getModelInfo = (modelId: string) => {
    return MODELS.find(m => m.id === modelId);
  };

  // Retry a whole failed message (when no images are present)
  const handleRetryMessage = async (failedMessage: ChatMessage) => {
    if (isGenerating) return;

    // Find the session and previous user message
    const session = sessions.find(s => s.messages.some(m => m.id === failedMessage.id));
    if (!session) return;

    const msgIndex = session.messages.findIndex(m => m.id === failedMessage.id);
    if (msgIndex < 1) return; // Should have user message before

    const userMessage = session.messages[msgIndex - 1];
    if (userMessage.role !== 'user') return;

    // Call handleGenerate with the previous prompt and session config
    handleGenerate(userMessage.content, session.config);
  };

  // Retry failed image generation
  const handleRetry = async (failedImage: GeneratedImage) => {
    if (isGenerating) return;

    setIsGenerating(true);
    toast.info("正在重新生成图像...");

    // Update the image to loading state immediately
    setSessions(currentSessions => {
      const updatedSessions = currentSessions.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: s.messages.map(m => ({
              ...m,
              images: m.images?.map(img =>
                img.id === failedImage.id ? { ...img, isLoading: true, error: undefined } : img
              ),
            })),
          };
        }
        return s;
      });
      return updatedSessions;
    });

    const enhancedPrompt = `${failedImage.prompt}（图像比例 ${failedImage.aspectRatio}）`;

    // Get current session messages in real-time (to capture any recent retry successes)
    // This ensures if another image was retried and succeeded, we can see it
    const allMessages = currentSession?.messages.filter(m => !m.isLoading) || [];

    // Find the message containing the failed image
    const failedMessageIndex = allMessages.findIndex(m =>
      m.images?.some(img => img.id === failedImage.id)
    );

    // Find the user message that triggered this generation (it's right before the assistant message)
    // The user message contains the reference images used for this generation
    let userMessageWithRefs: ChatMessage | undefined;
    if (failedMessageIndex > 0) {
      // Look for the user message right before the failed assistant message
      for (let i = failedMessageIndex - 1; i >= 0; i--) {
        if (allMessages[i].role === "user") {
          userMessageWithRefs = allMessages[i];
          break;
        }
      }
    }

    // Get reference image base64s from the original user message
    const refImageBase64sForRetry = userMessageWithRefs?.referenceImageBase64s;

    // Include all messages BEFORE the failed image's message
    // For assistant messages, buildConversationHistory will only include successful images
    // Example: if failed image is in msg3, include msg0, msg1, msg2
    // This means:
    // - All user messages before the failed generation are included
    // - All successful images from assistant messages before the failed one are included
    // - The failed image's message is NOT included (we're regenerating it)
    const messagesForHistory = failedMessageIndex > 0
      ? allMessages.slice(0, failedMessageIndex)  // All messages before the failed image's message
      : [];

    // Build conversation history with reference images if they exist
    // Convert base64 strings to ReferenceImage format for buildConversationHistory
    const refImagesForHistory: ReferenceImage[] | undefined = refImageBase64sForRetry?.map((base64, i) => ({
      id: `retry-ref-${i}`,
      file: new File([], ""),  // Dummy file, not needed for retry
      previewUrl: "",
      base64,
    }));

    const conversationHistory = await buildConversationHistory(
      messagesForHistory,
      enhancedPrompt,
      undefined,
      refImagesForHistory
    );

    // Check if the failed image was generated with Z-Image model
    const isZImageModel = failedImage.model === "z-image";

    try {
      let response: Response;

      if (isZImageModel) {
        // Z-Image uses dedicated endpoint (single-turn only)
        response = await fetch("/api/v1/ppt/images/z-image/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            aspect_ratio: failedImage.aspectRatio,
          }),
        });
      } else {
        // Other models use multi-turn chat endpoint
        response = await fetch("/api/v1/ppt/images/chat/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: conversationHistory,
            aspect_ratio: failedImage.aspectRatio,
            image_size: failedImage.resolution,
          }),
        });
      }

      if (!response.ok) {
        let errorMessage = "图像生成失败";
        // Get response text first, then try to parse as JSON
        const responseText = await response.text();
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          if (responseText) errorMessage = responseText;
        }
        throw new Error(errorMessage);
      }

      const imagePath = await response.text();
      const cleanUrl = imagePath.replace(/"/g, '').trim();

      // Validate that we got a valid image path
      if (!cleanUrl || cleanUrl === 'null' || cleanUrl === 'undefined') {
        throw new Error("服务器返回空响应，图像生成失败");
      }

      // Validate that the URL looks like a valid file path or URL
      if (!cleanUrl.startsWith('/') && !cleanUrl.startsWith('http')) {
        throw new Error(`服务器返回无效响应: ${cleanUrl.substring(0, 100)}`);
      }

      const newImage: GeneratedImage = {
        ...failedImage,
        url: cleanUrl,
        error: undefined,
        createdAt: new Date().toISOString(),
      };

      // Update the session with the new image using functional update
      setSessions(currentSessions => {
        const updatedSessions = currentSessions.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: s.messages.map(m => ({
                ...m,
                images: m.images?.map(img =>
                  img.id === failedImage.id ? newImage : img
                ),
              })),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });

        // Save to IndexedDB (no quota issues, keep all data including base64)
        imageSessionStorage.saveSessions(updatedSessions).catch(error => {
          console.error("Failed to save sessions to IndexedDB:", error);
        });

        return updatedSessions;
      });
      toast.success("图像重新生成成功");
      // Show single-turn reminder for Z-Image model
      if (isZImageModel) {
        setTimeout(() => {
          toast.info("Z-Image 模型仅支持单轮对话，建议新建对话进行下一次生成", {
            duration: 5000,
          });
        }, 500);
      }
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : "图像生成失败";
      if (!errorMessage) errorMessage = "图像生成失败";

      // Update the image with the new error message to ensure retry button shows
      const updatedErrorImage: GeneratedImage = {
        ...failedImage,
        error: errorMessage,
        createdAt: new Date().toISOString(),
      };

      setSessions(currentSessions => {
        const updatedSessions = currentSessions.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: s.messages.map(m => ({
                ...m,
                images: m.images?.map(img =>
                  img.id === failedImage.id ? updatedErrorImage : img
                ),
              })),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });

        // Save to IndexedDB
        imageSessionStorage.saveSessions(updatedSessions).catch(err => {
          console.error("Failed to save sessions to IndexedDB:", err);
        });

        return updatedSessions;
      });

      toast.error(`重试失败: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return "昨天";
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && prompt.trim()) {
        handleGenerate();
      }
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-gray-50">
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

      {/* Left Sidebar - Session History */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-100">
          <Button
            onClick={handleNewSession}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            新建对话
          </Button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无对话</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={cn(
                    "group p-3 rounded-lg cursor-pointer transition-colors",
                    currentSessionId === session.id
                      ? "bg-violet-50 border border-violet-200"
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        currentSessionId === session.id ? "text-violet-700" : "text-gray-700"
                      )}>
                        {session.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(session.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Warning */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              对话保存在本地，清除缓存后将丢失
            </p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-violet-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">AI 图像生成</h2>
              <p className="text-sm text-gray-500 mb-6">描述你想要的图像，AI 将为你创作</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {["一只可爱的橘猫", "未来科技城市", "水彩风格的花园", "星空下的山脉"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setPrompt(suggestion)}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full hover:border-violet-300 hover:bg-violet-50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">
              {currentSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "user" ? (
                    // User Message
                    <div className="max-w-[80%] bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
                      {message.referenceImageBase64s && message.referenceImageBase64s.length > 0 && (
                        <div className="mb-3 pb-3 border-b border-white/20">
                          <div className="flex items-center gap-1 mb-2">
                            <Paperclip className="w-3 h-3" />
                            <span className="text-xs opacity-80">{message.referenceImageBase64s.length} 张参考图像</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {message.referenceImageBase64s.map((base64, idx) => (
                              <button
                                key={idx}
                                onClick={() => setPreviewReferenceImage(base64)}
                                className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/30 hover:border-white/60 transition-colors cursor-pointer"
                              >
                                <img
                                  src={base64}
                                  alt={`参考图像 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  ) : (
                    // Assistant Message
                    <div className="max-w-[90%] space-y-3">
                      {message.isLoading ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">正在生成图像...</span>
                        </div>
                      ) : (!message.images || message.images.length === 0 || (message.images.length > 0 && message.images.every(img => !!(img.error || !img.url)))) ? (
                        // No images OR all images failed - show error message with retry
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-700">图像生成失败</p>
                            <p className="text-xs text-red-500 mt-0.5">{message.content === "图像生成失败" ? "所有图像生成均失败，请重试" : message.content || "请重试"}</p>
                          </div>
                          <Button
                            onClick={() => handleRetryMessage(message)}
                            disabled={isGenerating}
                            variant="destructive"
                            size="sm"
                            className="h-8"
                          >
                            {isGenerating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            重试
                          </Button>
                        </div>
                      ) : null}

                      {message.images && message.images.length > 0 && !message.images.every(img => !!(img.error || !img.url)) && (
                        <div className={cn(
                          "grid gap-3",
                          message.images.length === 1 ? "grid-cols-1" :
                          message.images.length === 2 ? "grid-cols-2" :
                          message.images.length === 3 ? "grid-cols-3" : "grid-cols-2"
                        )}>
                          {message.images.map((image) => (
                            image.isLoading ? (
                              // Loading skeleton
                              <div
                                key={image.id}
                                className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 aspect-square shadow-md"
                              >
                                <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/40 to-transparent skeleton-shimmer" />
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                  <p className="text-sm">生成中...</p>
                                </div>
                              </div>
                            ) : (image.error || !image.url) ? (
                              // Error state with retry button
                              <div
                                key={image.id}
                                className="relative rounded-xl overflow-hidden bg-gradient-to-br from-red-50 to-red-100 aspect-square shadow-md border border-red-200"
                              >
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                  </div>
                                  <p className="text-sm font-medium text-red-700 mb-1">生成失败</p>
                                  <p className="text-xs text-red-500 line-clamp-2 mb-3 max-w-[90%]">{image.error || "生成失败"}</p>
                                  <button
                                    onClick={() => handleRetry(image)}
                                    disabled={isGenerating}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg transition-colors"
                                  >
                                    {isGenerating ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                    重试
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Success image
                              <div
                                key={image.id}
                                className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-square shadow-md hover:shadow-xl transition-shadow cursor-pointer"
                                onClick={() => setSelectedImage(image)}
                              >
                                <img
                                  src={image.url}
                                  alt={image.prompt}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedImage(image);
                                      }}
                                      className="p-2 bg-white/90 hover:bg-white rounded-lg"
                                    >
                                      <ZoomIn className="w-4 h-4 text-gray-700" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(image);
                                      }}
                                      className="p-2 bg-white/90 hover:bg-white rounded-lg"
                                    >
                                      <Download className="w-4 h-4 text-gray-700" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-4xl mx-auto">
            {/* Reference Images Preview */}
            {referenceImages.length > 0 && (
              <div className="mb-3 p-3 bg-violet-50 rounded-xl border border-violet-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-violet-700 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    参考图像 ({referenceImages.length})
                  </span>
                  <button
                    onClick={handleClearReferenceImages}
                    className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    清除全部
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {referenceImages.map((img) => (
                    <div
                      key={img.id}
                      className="relative group w-16 h-16 rounded-lg overflow-hidden border border-violet-200 bg-white"
                    >
                      <img
                        src={img.previewUrl}
                        alt="参考图像"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleRemoveReferenceImage(img.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-violet-300 hover:border-violet-400 flex items-center justify-center text-violet-400 hover:text-violet-500 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Settings Panel - Always visible by default */}
            {showSettings && (
              <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 shadow-sm">
                {/* Model Selection - Card Style */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 block flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" />
                    模型选择
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {MODELS.filter(model => model.id !== "z-image").map((model) => (
                      <button
                        key={model.id}
                        onClick={() => handleConfigChange("model", model.id)}
                        className={cn(
                          "relative p-3 rounded-lg border-2 transition-all text-left",
                          config.model === model.id
                            ? "border-violet-500 bg-violet-50 shadow-md"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
                            model.color
                          )}>
                            <img
                              src={model.icon}
                              alt={model.name}
                              className="w-5 h-5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={cn(
                                "text-sm font-medium truncate",
                                config.model === model.id ? "text-violet-700" : "text-gray-800"
                              )}>
                                {model.name}
                              </p>
                              {model.singleTurnOnly && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                                  单轮
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{model.description}</p>
                          </div>
                        </div>
                        {config.model === model.id && (
                          <div className="absolute top-1 right-1">
                            <div className="w-2 h-2 rounded-full bg-violet-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Other Settings - Horizontal Row */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Count */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      数量
                    </label>
                    <Select
                      value={config.count.toString()}
                      onValueChange={(value) => handleConfigChange("count", parseInt(value))}
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-200 hover:border-gray-300">
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      宽高比
                    </label>
                    <Select
                      value={config.aspectRatio}
                      onValueChange={(value) => handleConfigChange("aspectRatio", value)}
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-200 hover:border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((ratio) => (
                          <SelectItem key={ratio.id} value={ratio.id}>
                            <span className="font-medium">{ratio.name}</span>
                            <span className="text-gray-400 ml-1">· {ratio.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Resolution */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      分辨率
                    </label>
                    <Select
                      value={config.resolution}
                      onValueChange={(value) => handleConfigChange("resolution", value)}
                    >
                      <SelectTrigger className="h-10 bg-white border-gray-200 hover:border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTIONS.map((res) => (
                          <SelectItem key={res.id} value={res.id}>
                            {res.name} - {res.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />

            {/* Input Row */}
            <div className="flex items-end gap-3">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  "p-2.5 rounded-lg transition-colors",
                  showSettings
                    ? "bg-violet-100 text-violet-600"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                <Settings2 className="w-5 h-5" />
              </button>

              {/* Upload button - hidden for single-turn models like Z-Image */}
              {!MODELS.find(m => m.id === config.model)?.singleTurnOnly && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors",
                    referenceImages.length > 0
                      ? "bg-violet-100 text-violet-600"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                  title="上传参考图像"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              )}

              <div className="flex-1 relative">
                <Textarea
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={referenceImages.length > 0 ? "描述你想基于参考图像生成的内容..." : "描述你想要生成的图像... (Enter 发送, Shift+Enter 换行)"}
                  className="min-h-[48px] max-h-[200px] pr-12 resize-none rounded-xl border-gray-200 focus:border-violet-400 focus:ring-violet-400"
                  rows={1}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1 text-xs text-gray-400">
                  {referenceImages.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded">{referenceImages.length} 图</span>
                  )}
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded">{config.aspectRatio}</span>
                </div>
              </div>

              <Button
                onClick={() => handleGenerate()}
                disabled={isGenerating || !prompt.trim()}
                className="h-12 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
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
                <p className="text-white text-sm mb-3">{selectedImage.prompt}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur rounded-full text-white">
                    {getModelName(selectedImage.model)}
                  </span>
                  <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur rounded-full text-white">
                    {selectedImage.aspectRatio}
                  </span>
                  <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur rounded-full text-white">
                    {selectedImage.resolution}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3">
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

      {/* Reference Image Preview Dialog */}
      <Dialog open={!!previewReferenceImage} onOpenChange={() => setPreviewReferenceImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          {previewReferenceImage && (
            <div className="relative">
              <img
                src={previewReferenceImage}
                alt="参考图像预览"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-white/80" />
                  <span className="text-white text-sm">参考图像</span>
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
