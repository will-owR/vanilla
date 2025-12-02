/**
 * PromptTemplates
 *
 * Generate optimized prompts for different generation stages:
 * 1. Structure generation (Pro model)
 * 2. Page 1 generation (Flash model)
 * 3. Batch generation (Flash model, 3 pages)
 * 4. Fallback page generation (Flash model, recovery)
 * 5. Final page generation (Flash model)
 */

class PromptTemplates {
  /**
   * Generate prompt for structure generation (Pro model)
   *
   * @param {Object} params - {title, subtitle, topic, targetAudience, tone, contentType}
   * @returns {string} - Structure generation prompt
   */
  static structurePrompt({
    title,
    subtitle,
    topic,
    targetAudience,
    tone,
    contentType,
  }) {
    return `You are an expert book structure designer. Generate a detailed chapter-by-chapter outline for an ebook.

Title: "${title}"
${subtitle ? `Subtitle: "${subtitle}"` : ""}
Topic: ${topic}
Target Audience: ${targetAudience}
Tone: ${tone}
Content Type: ${contentType}

Generate a comprehensive structure with:
- Number of chapters (optimal for this topic and audience)
- Chapter titles
- Key points per chapter
- Approximate word count per chapter
- Page breaks and section divisions

Format as JSON:
{
  "chapters": [
    {
      "number": 1,
      "title": "string",
      "keyPoints": ["string"],
      "suggestedWordCount": number,
      "pageCount": number
    }
  ],
  "totalPages": number,
  "contentNotes": "string"
}`;
  }

  /**
   * Generate prompt for Page 1 (voice/tone establishment)
   *
   * @param {Object} params - {title, subtitle, topic, targetAudience, tone, voiceStyle, structure}
   * @returns {string} - Page 1 generation prompt
   */
  static page1Prompt({
    title,
    subtitle,
    topic,
    targetAudience,
    tone,
    voiceStyle,
    structure,
  }) {
    const firstChapter = structure?.chapters?.[0];
    const chapterTitle = firstChapter?.title || "Opening";
    const keyPoints = firstChapter?.keyPoints?.slice(0, 3) || [];

    return `You are writing the opening page of an ebook. This page must establish the narrative voice, set the emotional tone, and engage the reader.

EBOOK INFORMATION:
- Title: "${title}"
${subtitle ? `- Subtitle: "${subtitle}"` : ""}
- Topic: ${topic}
- Target Audience: ${targetAudience}
- Tone: ${tone}
- Voice Style: ${voiceStyle}

FIRST CHAPTER: "${chapterTitle}"
Key Points to Cover:
${keyPoints.map((p) => `- ${p}`).join("\n")}

REQUIREMENTS:
1. Write engaging, original opening text (800-1000 words)
2. Establish the narrative voice clearly in the first 2-3 sentences
3. Create emotional connection with the target audience
4. Introduce the main topic with curiosity/intrigue
5. Set expectations for what readers will learn
6. Include a hook that makes readers want to continue
7. Match the specified tone: ${tone}

Write naturally and compellingly. This is Page 1 - make it unforgettable.`;
  }

  /**
   * Generate prompt for batch generation (middle pages)
   *
   * @param {Object} params - {pageNumbers, structure, voice, tone, themes, characters, previousPageSummary, upcomingPageTitle}
   * @returns {string} - Batch generation prompt (N pages)
   */
  static batchPrompt({
    pageNumbers,
    structure,
    voice,
    tone,
    themes,
    characters,
    previousPageSummary,
    upcomingPageTitle,
  }) {
    const pageCount = pageNumbers.length;
    const chapters = pageNumbers.map((num) => {
      const chapter = structure?.chapters?.[num - 1];
      return `Page ${num}: "${chapter?.title || `Chapter ${num}`}"`;
    });

    return `You are continuing an ebook with an established narrative voice and style. Generate the next ${pageCount} pages (pages ${pageNumbers.join(
      ", "
    )}) seamlessly.

ESTABLISHED VOICE & TONE:
- Voice: ${voice}
- Tone: ${tone}
- Themes: ${themes?.join(", ") || "varied"}

KEY CHARACTERS:
${
  Object.entries(characters || {})
    .map(([name, desc]) => `- ${name}${desc ? ": " + desc : ""}`)
    .join("\n") || "(None)"
}

CONTEXT FROM PREVIOUS PAGE:
${
  previousPageSummary ||
  "(Opening page established the narrative voice and engagement)"
}

PAGES TO GENERATE:
${chapters.join("\n")}

Upcoming Page: "${upcomingPageTitle}"

REQUIREMENTS FOR THIS BATCH:
1. Generate ${pageCount} consecutive pages (${pageNumbers.join(
      ", "
    )}) in ONE response
2. Each page should be 600-900 words
3. Maintain the established voice and tone throughout
4. Progress the narrative naturally from page to page
5. Reference previous page content to ensure continuity
6. Build toward the upcoming page content
7. Incorporate the identified themes naturally
8. If characters exist, show their development across pages
9. Format: Use clear page breaks (e.g., "--- PAGE ${pageNumbers[0]} ---")
10. Keep internal consistency within the batch

Generate high-quality, engaging content that maintains the reader's momentum.`;
  }

  /**
   * Generate prompt for fallback page (recovery when batch fails)
   *
   * @param {Object} params - {pageNumber, structure, voice, tone, themes, previousPageSummary, upcomingPageTitle}
   * @returns {string} - Fallback page generation prompt
   */
  static fallbackPagePrompt({
    pageNumber,
    structure,
    voice,
    tone,
    themes,
    previousPageSummary,
    upcomingPageTitle,
  }) {
    const chapter = structure?.chapters?.[pageNumber - 1];
    const chapterTitle = chapter?.title || `Chapter ${pageNumber}`;
    const keyPoints = chapter?.keyPoints?.slice(0, 2) || [];

    return `You are generating a single page for an ebook with an established narrative style. Generate page ${pageNumber} seamlessly.

ESTABLISHED STYLE:
- Voice: ${voice}
- Tone: ${tone}
- Themes: ${themes?.join(", ") || "varied"}

PAGE INFORMATION:
- Page Number: ${pageNumber}
- Title: "${chapterTitle}"
- Key Points: ${keyPoints.join(", ") || "See previous page context"}

CONTEXT:
- Previous Page Content: ${previousPageSummary || "(See narrative flow)"}
- Upcoming Page: "${upcomingPageTitle}"

REQUIREMENTS:
1. Write page ${pageNumber} (600-900 words)
2. Maintain established voice and tone precisely
3. Connect smoothly to previous page
4. Flow naturally into the upcoming page
5. If key points exist, incorporate them naturally
6. Keep internal consistency with established themes
7. Do not break character or style
8. Write as if this is part of a larger, cohesive narrative

Generate engaging, polished content that reads naturally within the ebook.`;
  }

  /**
   * Generate prompt for final page (conclusion/wrap-up)
   *
   * @param {Object} params - {structure, voice, tone, themes, characters, narrativeSummary}
   * @returns {string} - Final page generation prompt
   */
  static finalPagePrompt({
    structure,
    voice,
    tone,
    themes,
    characters,
    narrativeSummary,
  }) {
    const finalChapter = structure?.chapters?.[structure?.chapters?.length - 1];
    const finalTitle = finalChapter?.title || "Conclusion";
    const totalPages = structure?.totalPages || "(multiple)";

    return `You are writing the final page of an ebook. This conclusion must tie together themes, provide closure, and leave a lasting impression.

EBOOK INFORMATION:
- Total Pages: ${totalPages}
- Final Chapter: "${finalTitle}"
- Narrative Voice: ${voice}
- Tone: ${tone}
- Primary Themes: ${themes?.join(", ") || "varied"}

KEY CHARACTERS (if any):
${
  Object.entries(characters || {})
    .map(([name]) => `- ${name}`)
    .join("\n") || "(None)"
}

NARRATIVE SUMMARY SO FAR:
${narrativeSummary || "(See previous pages for context)"}

REQUIREMENTS FOR FINAL PAGE:
1. Write the concluding page (800-1000 words)
2. Tie together all major themes from the ebook
3. Provide satisfying closure for reader journey
4. Reference key moments/characters from earlier pages
5. Leave reader with lasting insight or feeling
6. Maintain the established voice and tone perfectly
7. Include a powerful final paragraph that resonates
8. Avoid abrupt endings - build to the conclusion
9. Match the emotional arc established throughout
10. End with a thought-provoking, memorable final sentence

This is the reader's last impression. Make it count.`;
  }
}

module.exports = { PromptTemplates };
