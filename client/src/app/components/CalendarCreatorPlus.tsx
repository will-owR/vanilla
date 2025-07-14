"use client";

import React, { useState } from "react";
import Image from "next/image";
import axios from "axios";
import {
  ThemeSelector,
  FontSelector,
  BackgroundSelector,
  CustomizationTemplate,
} from "./CustomizationSelectors";
import { useCustomization } from "./CustomizationContext";
import Sidebar from "./Sidebar";
import GenAIPromptPanel from "./GenAIPromptPanel";
import TopBar from "./TopBar";
import CalendarArea from "./CalendarArea";
import styles from "./CalendarCreatorPlus.module.css";
import { CalendarViewProvider } from "./CalendarViewContext";
import { getApiBaseUrl } from "../utils/api";

const CalendarCreatorPlus: React.FC = () => {
  // Example template options (replace with real data)
  const templates: CustomizationTemplate[] = [
    { id: "light", name: "Light Theme", preview: "#fff", type: "theme" },
    { id: "dark", name: "Dark Theme", preview: "#222", type: "theme" },
    {
      id: "sans",
      name: "Sans Font",
      preview: "Geist, Arial, sans-serif",
      type: "font",
    },
    {
      id: "mono",
      name: "Mono Font",
      preview: "Geist Mono, monospace",
      type: "font",
    },
    {
      id: "bg1",
      name: "Blue Sky",
      preview: "/next.svg", // <-- remove 'public'
      type: "background",
    },
    {
      id: "bg2",
      name: "Vercel",
      preview: "/vercel.svg", // <-- remove 'public'
      type: "background",
    },
  ];

  const {
    themeId,
    fontId,
    backgroundId,
    setThemeId,
    setFontId,
    setBackgroundId,
  } = useCustomization();

  // GenAI prompt state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState<React.ReactNode>(null);
  const [aiError, setAiError] = useState<string | undefined>(undefined);

  // Real GenAI API call to backend
  const handleGenAIPrompt = async (prompt: string) => {
    setAiLoading(true);
    setAiError(undefined);
    setAiOutput(null);
    try {
      const apiUrl = getApiBaseUrl();
      const res = await axios.post(`${apiUrl}/theme/suggest`, {
        prompt,
        // Allow self-signed certificate in development
        httpsAgent: new (
          await import("https")
        ).Agent({ rejectUnauthorized: false }),
      });
      const suggestion = res.data.suggestion;
      setAiOutput(
        <div>
          <strong>AI Suggestion:</strong> {suggestion.themeName}
          <br />
          <span style={{ color: suggestion.colors[0] }}>
            {suggestion.description}
          </span>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontFamily: suggestion.font }}>
              Font: {suggestion.font}
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Image
              src={suggestion.background}
              alt="Theme background preview"
              width={80}
              height={40}
              style={{ borderRadius: 4 }}
            />
          </div>
        </div>
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setAiError(
          err.response?.data?.error ||
            "Failed to generate theme. Please try again."
        );
      } else {
        setAiError("Failed to generate theme. Please try again.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <CalendarViewProvider>
      <div className={styles["calendar-plus-root"]}>
        <aside>
          <GenAIPromptPanel
            onSubmitPrompt={handleGenAIPrompt}
            isLoading={aiLoading}
            aiOutput={aiOutput}
            error={aiError}
          />
          <ThemeSelector
            templates={templates}
            selectedId={themeId}
            onSelect={setThemeId}
          />
          <FontSelector
            templates={templates}
            selectedId={fontId}
            onSelect={setFontId}
          />
          <BackgroundSelector
            templates={templates}
            selectedId={backgroundId}
            onSelect={setBackgroundId}
          />
        </aside>
        <TopBar />
        <div className={styles["calendar-plus-main"]}>
          <Sidebar />
          <CalendarArea />
        </div>
      </div>
    </CalendarViewProvider>
  );
};

export default CalendarCreatorPlus;
