import React, { useState } from "react";
import styles from "./GenAIPromptPanel.module.css";

interface GenAIPromptPanelProps {
  onSubmitPrompt: (prompt: string) => void;
  isLoading: boolean;
  aiOutput: React.ReactNode;
  error?: string;
}

const GenAIPromptPanel: React.FC<GenAIPromptPanelProps> = ({
  onSubmitPrompt,
  isLoading,
  aiOutput,
  error,
}) => {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmitPrompt(prompt);
    }
  };

  return (
    <section className={styles.panel} aria-label="AI Theme Generator">
      <h3>AI Theme Generator</h3>
      <form onSubmit={handleSubmit} className={styles.form}>
        <label htmlFor="genai-prompt">
          Describe your ideal calendar theme:
        </label>
        <input
          id="genai-prompt"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Minimal, blue, modern, with nature background"
          disabled={isLoading}
          aria-disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !prompt.trim()}>
          {isLoading ? "Generating..." : "Generate Theme"}
        </button>
      </form>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <div className={styles.outputPreview} aria-live="polite">
        {aiOutput}
      </div>
    </section>
  );
};

export default GenAIPromptPanel;
