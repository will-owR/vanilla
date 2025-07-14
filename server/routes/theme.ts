import express from "express";
import type { Request, Response } from "express";

const router = express.Router();

// POST /theme/suggest
router.post("/suggest", async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt is required" });
  }
  try {
    // TODO: Integrate with Gemini or GenAI backend service
    // Simulate AI theme suggestion
    const suggestion = {
      themeName: `AI Theme for: ${prompt}`,
      colors: ["#0070f3", "#f8f9fa", "#222"],
      font: "Geist, Arial, sans-serif",
      background: "/public/next.svg",
      description: `A theme generated for: ${prompt}`,
    };
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate theme suggestion" });
  }
});

export default router;
