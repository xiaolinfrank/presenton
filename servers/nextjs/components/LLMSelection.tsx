"use client";
import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Check, ChevronsUpDown, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import OpenAIConfig from "./OpenAIConfig";
import GoogleConfig from "./GoogleConfig";
import AnthropicConfig from "./AnthropicConfig";
import OllamaConfig from "./OllamaConfig";
import CustomConfig from "./CustomConfig";
import {
  updateLLMConfig,
  changeProvider as changeProviderUtil,
} from "@/utils/providerUtils";
import { IMAGE_PROVIDERS, LLM_PROVIDERS } from "@/utils/providerConstants";
import { LLMConfig } from "@/types/llm_config";

// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

interface LLMProviderSelectionProps {
  initialLLMConfig: LLMConfig;
  onConfigChange: (config: LLMConfig) => void;
  buttonState: ButtonState;
  setButtonState: (state: ButtonState | ((prev: ButtonState) => ButtonState)) => void;
}

export default function LLMProviderSelection({
  initialLLMConfig,
  onConfigChange,
  setButtonState,
}: LLMProviderSelectionProps) {
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(initialLLMConfig);
  const [openImageProviderSelect, setOpenImageProviderSelect] = useState(false);
  const isImageGenerationDisabled = llmConfig.DISABLE_IMAGE_GENERATION ?? false;

  useEffect(() => {
    onConfigChange(llmConfig);
  }, [llmConfig]);

  useEffect(() => {
    const needsModelSelection =
      (llmConfig.LLM === "openai" && !llmConfig.OPENAI_MODEL) ||
      (llmConfig.LLM === "google" && !llmConfig.GOOGLE_MODEL) ||
      (llmConfig.LLM === "ollama" && !llmConfig.OLLAMA_MODEL) ||
      (llmConfig.LLM === "custom" && !llmConfig.CUSTOM_MODEL) ||
      (llmConfig.LLM === "anthropic" && !llmConfig.ANTHROPIC_MODEL);

    const needsProviderApiKey =
      (llmConfig.LLM === "openai" && !llmConfig.OPENAI_API_KEY) ||
      (llmConfig.LLM === "google" && !llmConfig.GOOGLE_API_KEY) ||
      (llmConfig.LLM === "anthropic" && !llmConfig.ANTHROPIC_API_KEY);

    const needsImageProviderApiKey =
      !llmConfig.DISABLE_IMAGE_GENERATION &&
      (
        (llmConfig.IMAGE_PROVIDER === "dall-e-3" && !llmConfig.OPENAI_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "gemini_flash" && !llmConfig.GOOGLE_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "pexels" && !llmConfig.PEXELS_API_KEY) ||
        (llmConfig.IMAGE_PROVIDER === "pixabay" && !llmConfig.PIXABAY_API_KEY)
      );

    const needsApiKey = needsProviderApiKey || needsImageProviderApiKey;

    const needsOllamaUrl = (llmConfig.LLM === "ollama" && !llmConfig.OLLAMA_URL);

    setButtonState({
      isLoading: false,
      isDisabled: needsModelSelection || needsApiKey || needsOllamaUrl,
      text: needsModelSelection ? "请选择模型" : needsApiKey ? "请输入 API 密钥" : needsOllamaUrl ? "请输入 Ollama 地址" : "保存配置",
      showProgress: false
    });

  }, [llmConfig]);

  const input_field_changed = (new_value: string | boolean, field: string) => {
    const updatedConfig = updateLLMConfig(llmConfig, field, new_value);
    setLlmConfig(updatedConfig);
  };

  const handleProviderChange = (provider: string) => {
    const newConfig = changeProviderUtil(llmConfig, provider);
    setLlmConfig(newConfig);
  };

  useEffect(() => {
    if (!llmConfig.USE_CUSTOM_URL) {
      setLlmConfig({ ...llmConfig, OLLAMA_URL: "http://localhost:11434" });
    } else {
      if (!llmConfig.OLLAMA_URL) {
        setLlmConfig({ ...llmConfig, OLLAMA_URL: "http://localhost:11434" });
      }
    }
  }, [llmConfig.USE_CUSTOM_URL]);

  useEffect(() => {
    setLlmConfig((prevConfig) => {
      const updates: Partial<LLMConfig> = {};

      if (!prevConfig.DISABLE_IMAGE_GENERATION && !prevConfig.IMAGE_PROVIDER) {
        if (prevConfig.LLM === "openai") {
          updates.IMAGE_PROVIDER = "dall-e-3";
        } else if (prevConfig.LLM === "google") {
          updates.IMAGE_PROVIDER = "gemini_flash";
        } else {
          updates.IMAGE_PROVIDER = "pexels";
        }
      }

      if (!prevConfig.OLLAMA_URL) {
        updates.OLLAMA_URL = "http://localhost:11434";
      }

      if (Object.keys(updates).length === 0) {
        return prevConfig;
      }

      return { ...prevConfig, ...updates };
    });
  }, []);

  return (
    <div className="h-full flex flex-col mt-10">
      {/* Provider Selection - Fixed Header */}
      <div className="p-2 rounded-2xl border border-gray-200">
        <Tabs
          value={llmConfig.LLM || "openai"}
          onValueChange={handleProviderChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 bg-transparent h-10">
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="google">Google</TabsTrigger>
            <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
            <TabsTrigger value="ollama">Ollama</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>


      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-0 custom_scrollbar">
        <Tabs
          value={llmConfig.LLM || "openai"}
          onValueChange={handleProviderChange}
          className="w-full"
        >
          {/* OpenAI Content */}
          <TabsContent value="openai" className="mt-6">
            <OpenAIConfig
              openaiApiKey={llmConfig.OPENAI_API_KEY || ""}
              openaiModel={llmConfig.OPENAI_MODEL || ""}
              webGrounding={llmConfig.WEB_GROUNDING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Google Content */}
          <TabsContent value="google" className="mt-6">
            <GoogleConfig
              googleApiKey={llmConfig.GOOGLE_API_KEY || ""}
              googleModel={llmConfig.GOOGLE_MODEL || ""}
              webGrounding={llmConfig.WEB_GROUNDING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Anthropic Content */}
          <TabsContent value="anthropic" className="mt-6">
            <AnthropicConfig
              anthropicApiKey={llmConfig.ANTHROPIC_API_KEY || ""}
              anthropicModel={llmConfig.ANTHROPIC_MODEL || ""}
              extendedReasoning={llmConfig.EXTENDED_REASONING || false}
              webGrounding={llmConfig.WEB_GROUNDING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Ollama Content */}
          <TabsContent value="ollama" className="mt-6">
            <OllamaConfig
              ollamaModel={llmConfig.OLLAMA_MODEL || ""}
              ollamaUrl={llmConfig.OLLAMA_URL || ""}
              useCustomUrl={llmConfig.USE_CUSTOM_URL || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>

          {/* Custom Content */}
          <TabsContent value="custom" className="mt-6">
            <CustomConfig
              customLlmUrl={llmConfig.CUSTOM_LLM_URL || ""}
              customLlmApiKey={llmConfig.CUSTOM_LLM_API_KEY || ""}
              customModel={llmConfig.CUSTOM_MODEL || ""}
              toolCalls={llmConfig.TOOL_CALLS || false}
              disableThinking={llmConfig.DISABLE_THINKING || false}
              onInputChange={input_field_changed}
            />
          </TabsContent>
        </Tabs>

        {/* Image Generation Toggle */}
        <div className="my-8">
          <div className="flex items-center justify-between mb-4 bg-green-50 p-2 rounded-sm">
            <label className="text-sm font-medium text-gray-700">
              禁用图片生成
            </label>
            <Switch
              checked={isImageGenerationDisabled}
              onCheckedChange={(checked) => {
                input_field_changed(checked, "disable_image_generation");
                if (checked) {
                  setOpenImageProviderSelect(false);
                }
              }}
            />
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
            启用后，幻灯片将不包含自动生成的图片。
          </p>
        </div>

        {!isImageGenerationDisabled && (
          <>
            {/* Image Provider Selection */}
            <div className="my-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                选择图片提供商
              </label>
              <div className="w-full">
                <Popover
                  open={openImageProviderSelect}
                  onOpenChange={setOpenImageProviderSelect}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openImageProviderSelect}
                      className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors hover:border-gray-400 justify-between"
                    >
                      <div className="flex gap-3 items-center">
                        <span className="text-sm font-medium text-gray-900">
                          {llmConfig.IMAGE_PROVIDER
                            ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]?.label ||
                            llmConfig.IMAGE_PROVIDER
                            : "选择图片提供商"}
                        </span>
                      </div>
                      <ChevronsUpDown className="w-4 h-4 text-gray-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0"
                    align="start"
                    style={{ width: "var(--radix-popover-trigger-width)" }}
                  >
                    <Command>
                      <CommandInput placeholder="搜索提供商..." />
                      <CommandList>
                        <CommandEmpty>未找到提供商</CommandEmpty>
                        <CommandGroup>
                          {Object.values(IMAGE_PROVIDERS).map(
                            (provider, index) => (
                              <CommandItem
                                key={index}
                                value={provider.value}
                                onSelect={(value) => {
                                  input_field_changed(value, "image_provider");
                                  setOpenImageProviderSelect(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    llmConfig.IMAGE_PROVIDER === provider.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex gap-3 items-center">
                                  <div className="flex flex-col space-y-1 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium text-gray-900 capitalize">
                                        {provider.label}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-600 leading-relaxed">
                                      {provider.description}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            )
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Dynamic API Key Input for Image Provider */}
            {llmConfig.IMAGE_PROVIDER &&
              IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER] &&
              (() => {
                const provider = IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER];

                // Show info message when using same API key as main provider
                if (provider.value === "dall-e-3" && llmConfig.LLM === "openai") {
                  return <></>;
                }

                if (provider.value === "gemini_flash" && llmConfig.LLM === "google") {
                  return <></>;
                }

                // Show API key input for other providers
                return (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {provider.apiKeyFieldLabel}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`请输入 ${provider.apiKeyFieldLabel}`}
                        className="w-full px-4 py-2.5 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                        value={
                          provider.apiKeyField === "PEXELS_API_KEY"
                            ? llmConfig.PEXELS_API_KEY || ""
                            : provider.apiKeyField === "PIXABAY_API_KEY"
                              ? llmConfig.PIXABAY_API_KEY || ""
                              : ""
                        }
                        onChange={(e) => {
                          if (provider.apiKeyField === "PEXELS_API_KEY") {
                            input_field_changed(e.target.value, "pexels_api_key");
                          } else if (provider.apiKeyField === "PIXABAY_API_KEY") {
                            input_field_changed(e.target.value, "pixabay_api_key");
                          }
                        }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                      <span className="block w-1 h-1 rounded-full bg-gray-400"></span>
                      用于 {provider.label} 图片生成的 API 密钥
                    </p>
                  </div>
                );
              })()}
          </>
        )}

        {/* Model Information */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                已选择的模型
              </h3>
              <p className="text-sm text-blue-700">
                使用{" "}
                {llmConfig.LLM === "ollama"
                  ? llmConfig.OLLAMA_MODEL ?? "xxxxx"
                  : llmConfig.LLM === "custom"
                    ? llmConfig.CUSTOM_MODEL ?? "xxxxx"
                    : llmConfig.LLM === "anthropic"
                      ? llmConfig.ANTHROPIC_MODEL ?? "xxxxx"
                      : llmConfig.LLM === "google"
                        ? llmConfig.GOOGLE_MODEL ?? "xxxxx"
                        : llmConfig.LLM === "openai"
                          ? llmConfig.OPENAI_MODEL ?? "xxxxx"
                          : "xxxxx"}{" "}
                进行文本生成{" "}
                {isImageGenerationDisabled ? (
                  "，已禁用图片生成。"
                ) : (
                  <>
                    ，使用{" "}
                    {llmConfig.IMAGE_PROVIDER &&
                      IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER]
                      ? IMAGE_PROVIDERS[llmConfig.IMAGE_PROVIDER].label
                      : "xxxxx"}{" "}
                    生成图片
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
} 