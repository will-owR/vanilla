/**
 * Batch Chapter Processing Orchestrator
 *
 * Module 5.1: Integration orchestrator for batch processing pipeline
 * Coordinates: batch infrastructure, error recovery, metrics tracking
 *
 * This module handles the complete generation pipeline:
 * 1. Ch1: Individual (boundary chapter, full context)
 * 2. Ch2-N-1: Batches of 3 middle chapters with unified context
 * 3. ChN: Individual (conclusion, full story arc)
 *
 * Returns results in ebookService-compatible format with metrics attached.
 */

const batchProcessor = require("./index");
const { v4: uuidv4 } = require("uuid");

let METRICS;
try {
  METRICS = require("../metrics/GenerationMetrics");
} catch (e) {
  METRICS = null;
}

/**
 * Generate chapters using batch processing pipeline with metrics
 *
 * @param {Object} aiSvc - AI service with generateContentWithRotation()
 * @param {Array} outline - Chapter specifications from structure
 * @param {Object} ebookMetadata - { pageCount, title, theme, ...}
 * @param {Object} structure - Full structure object
 * @param {string} sessionId - Session ID for metrics (optional)
 * @returns {Promise<Array>} Array of chapter objects ready for composition
 */
async function generateChaptersWithBatching(
  aiSvc,
  outline,
  ebookMetadata,
  structure,
  sessionId
) {
  if (!aiSvc) throw new Error("aiSvc required");
  if (!Array.isArray(outline) || outline.length === 0) {
    throw new Error("outline must be non-empty array");
  }

  const chapters = [];
  let contextFromPrevious = "";
  let nextBatchIndex = 1; // Track batch numbers for logging

  console.log(
    `[BATCH ORCHESTRATOR] Starting chapter generation (${outline.length} chapters)`
  );
  console.log(`[BATCH ORCHESTRATOR] Session ID: ${sessionId || "none"}`);

  // =========================================================================
  // PHASE 1: Chapter 1 (Boundary Chapter)
  // =========================================================================
  // Generate first chapter individually with full context
  // This sets up narrative voice and tone for the entire ebook

  const ch1Spec = outline[0];
  console.log(`[BATCH ORCHESTRATOR] Ch1: Generating boundary chapter...`);

  try {
    const ch1StartTime = Date.now();
    const ch1Prompt = buildIndividualChapterPrompt(
      ch1Spec,
      outline.length,
      ebookMetadata,
      "",
      "boundary_chapter_opening"
    );

    const ch1Response = aiSvc.generateContentWithRotation
      ? await aiSvc.generateContentWithRotation(ch1Prompt, 1)
      : await aiSvc.generateContent(ch1Prompt);

    const ch1Duration = Date.now() - ch1StartTime;
    const ch1Data = parseChapterResponse(ch1Response, ch1Spec);

    chapters.push(ch1Data);
    contextFromPrevious = ch1Data.summary;

    console.log(
      `[BATCH ORCHESTRATOR] Ch1: Generated successfully (${ch1Duration}ms)`
    );

    // Record to metrics
    if (METRICS && sessionId) {
      try {
        METRICS.recordIndividualChapter(sessionId, {
          chapter: 1,
          reason: "boundary_chapter_opening",
          duration: ch1Duration,
          status: "success",
        });
      } catch (e) {
        console.warn(
          "[BATCH ORCHESTRATOR] Metrics recording failed:",
          e.message
        );
      }
    }
  } catch (error) {
    console.error(
      `[BATCH ORCHESTRATOR] Ch1 generation failed: ${error.message}`
    );

    const fallbackCh1 = createFallbackChapter(ch1Spec, "", "generation_failed");
    chapters.push(fallbackCh1);
    contextFromPrevious = fallbackCh1.summary;

    if (METRICS && sessionId) {
      try {
        METRICS.recordFallback(sessionId, 1, "generation_failed");
      } catch (e) {
        console.warn(
          "[BATCH ORCHESTRATOR] Metrics fallback recording failed:",
          e.message
        );
      }
    }
  }

  // =========================================================================
  // PHASE 2: Middle Chapters (Batches of 3)
  // =========================================================================
  // If only 1-2 chapters total, skip batching
  // If 3+ chapters, batch middle chapters in groups of 3

  const middleChapters = outline.slice(1, -1); // All except first and last
  const batchSize = 3;

  if (middleChapters.length > 0) {
    console.log(
      `[BATCH ORCHESTRATOR] Middle: Processing ${middleChapters.length} chapters in batches of ${batchSize}`
    );

    for (let i = 0; i < middleChapters.length; i += batchSize) {
      const batch = middleChapters.slice(
        i,
        Math.min(i + batchSize, middleChapters.length)
      );
      const batchStartTime = Date.now();

      console.log(
        `[BATCH ORCHESTRATOR] Batch ${nextBatchIndex}: Processing chapters ${
          batch[0].chapter
        }-${batch[batch.length - 1].chapter}...`
      );

      try {
        // Call batch processor with metrics
        const batchResult = await batchProcessor.processBatch(
          batch,
          contextFromPrevious,
          ebookMetadata,
          structure,
          nextBatchIndex + 1, // callIndex for dual-model routing
          sessionId
        );

        if (batchResult.success) {
          chapters.push(...batchResult.chapters);
          contextFromPrevious = batchResult.nextContext;

          const batchDuration = Date.now() - batchStartTime;
          console.log(
            `[BATCH ORCHESTRATOR] Batch ${nextBatchIndex}: Success (${batchDuration}ms, ${batchResult.chapters.length} chapters)`
          );
        } else {
          // Batch failed - attempt individual recovery
          console.warn(
            `[BATCH ORCHESTRATOR] Batch ${nextBatchIndex}: Failed (${batchResult.error?.message}), attempting individual recovery...`
          );

          for (const ch of batch) {
            try {
              const indStartTime = Date.now();
              const indPrompt = buildIndividualChapterPrompt(
                ch,
                outline.length,
                ebookMetadata,
                contextFromPrevious,
                "batch_recovery"
              );

              const indResponse = aiSvc.generateContentWithRotation
                ? await aiSvc.generateContentWithRotation(
                    indPrompt,
                    nextBatchIndex + 1
                  )
                : await aiSvc.generateContent(indPrompt);

              const indDuration = Date.now() - indStartTime;
              const chData = parseChapterResponse(indResponse, ch);
              chapters.push(chData);
              contextFromPrevious = chData.summary;

              if (METRICS && sessionId) {
                try {
                  METRICS.recordIndividualChapter(sessionId, {
                    chapter: ch.chapter,
                    reason: "batch_recovery",
                    duration: indDuration,
                    status: "success",
                  });
                } catch (e) {
                  console.warn(
                    "[BATCH ORCHESTRATOR] Metrics recording failed:",
                    e.message
                  );
                }
              }
            } catch (indError) {
              console.error(
                `[BATCH ORCHESTRATOR] Recovery for Ch${ch.chapter} failed: ${indError.message}`
              );

              const fallbackCh = createFallbackChapter(
                ch,
                contextFromPrevious,
                "batch_recovery_failed"
              );
              chapters.push(fallbackCh);
              contextFromPrevious = fallbackCh.summary;

              if (METRICS && sessionId) {
                try {
                  METRICS.recordFallback(
                    sessionId,
                    ch.chapter,
                    "batch_recovery_failed"
                  );
                } catch (e) {
                  console.warn(
                    "[BATCH ORCHESTRATOR] Metrics fallback recording failed:",
                    e.message
                  );
                }
              }
            }
          }
        }
      } catch (batchError) {
        console.error(
          `[BATCH ORCHESTRATOR] Batch ${nextBatchIndex} processing failed: ${batchError.message}`
        );

        // Fall back to individual recovery for entire batch
        for (const ch of batch) {
          try {
            const fallbackCh = createFallbackChapter(
              ch,
              contextFromPrevious,
              "batch_orchestrator_error"
            );
            chapters.push(fallbackCh);
            contextFromPrevious = fallbackCh.summary;

            if (METRICS && sessionId) {
              try {
                METRICS.recordFallback(
                  sessionId,
                  ch.chapter,
                  "batch_orchestrator_error"
                );
              } catch (e) {
                console.warn(
                  "[BATCH ORCHESTRATOR] Metrics fallback recording failed:",
                  e.message
                );
              }
            }
          } catch (fallbackErr) {
            console.error(
              `[BATCH ORCHESTRATOR] Fallback for Ch${ch.chapter} failed: ${fallbackErr.message}`
            );
            // This should not happen, but if it does, at least continue
          }
        }
      }

      nextBatchIndex++;
    }
  }

  // =========================================================================
  // PHASE 3: Last Chapter (Boundary Chapter)
  // =========================================================================
  // Generate final chapter individually with full story arc context
  // This is the conclusion, so it needs complete narrative arc

  if (outline.length > 1) {
    const lastChSpec = outline[outline.length - 1];
    console.log(
      `[BATCH ORCHESTRATOR] Ch${lastChSpec.chapter}: Generating boundary chapter...`
    );

    try {
      const lastStartTime = Date.now();
      const lastPrompt = buildIndividualChapterPrompt(
        lastChSpec,
        outline.length,
        ebookMetadata,
        contextFromPrevious,
        "boundary_chapter_conclusion"
      );

      const lastResponse = aiSvc.generateContentWithRotation
        ? await aiSvc.generateContentWithRotation(
            lastPrompt,
            nextBatchIndex + 1
          )
        : await aiSvc.generateContent(lastPrompt);

      const lastDuration = Date.now() - lastStartTime;
      const lastData = parseChapterResponse(lastResponse, lastChSpec);
      chapters.push(lastData);

      console.log(
        `[BATCH ORCHESTRATOR] Ch${lastChSpec.chapter}: Generated successfully (${lastDuration}ms)`
      );

      if (METRICS && sessionId) {
        try {
          METRICS.recordIndividualChapter(sessionId, {
            chapter: lastChSpec.chapter,
            reason: "boundary_chapter_conclusion",
            duration: lastDuration,
            status: "success",
          });
        } catch (e) {
          console.warn(
            "[BATCH ORCHESTRATOR] Metrics recording failed:",
            e.message
          );
        }
      }
    } catch (error) {
      console.error(
        `[BATCH ORCHESTRATOR] Ch${lastChSpec.chapter} generation failed: ${error.message}`
      );

      const fallbackLast = createFallbackChapter(
        lastChSpec,
        contextFromPrevious,
        "generation_failed"
      );
      chapters.push(fallbackLast);

      if (METRICS && sessionId) {
        try {
          METRICS.recordFallback(
            sessionId,
            lastChSpec.chapter,
            "generation_failed"
          );
        } catch (e) {
          console.warn(
            "[BATCH ORCHESTRATOR] Metrics fallback recording failed:",
            e.message
          );
        }
      }
    }
  }

  console.log(
    `[BATCH ORCHESTRATOR] Chapter generation complete (${chapters.length} chapters total)`
  );

  // =========================================================================
  // SOLUTION A: Defensive sort to ensure chapters in correct order
  // Ensures that even if batch processing or assembly introduces misalignment,
  // final output will be in sequential order by chapter number
  // =========================================================================
  chapters.sort((a, b) => {
    const aNum =
      typeof a.chapter === "string" ? parseInt(a.chapter) : a.chapter;
    const bNum =
      typeof b.chapter === "string" ? parseInt(b.chapter) : b.chapter;
    return aNum - bNum;
  });

  if (global.__DEBUG_BATCH__) {
    const chapterOrder = chapters.map((ch) => ch.chapter).join(",");
    console.log(
      `[BATCH ORCHESTRATOR] Final chapter order (sorted): [${chapterOrder}]`
    );
  }

  return chapters;
}

/**
 * Build individual chapter prompt with full context
 */
function buildIndividualChapterPrompt(
  chapterSpec,
  totalChapters,
  ebookMetadata,
  previousContext,
  reason
) {
  const { pageCount, title: ebookTitle, theme } = ebookMetadata;

  const prompt = `You are writing Chapter ${chapterSpec.chapter}: "${
    chapterSpec.title
  }"

Context:
- Total eBook: ${pageCount} pages (${totalChapters} chapters)
- Chapter: ${chapterSpec.chapter} of ${totalChapters}
- Theme: ${theme}
- Key topics: ${(chapterSpec.estimated_topics || []).join(", ")}
- Previous narrative: ${previousContext || "(Beginning of book)"}
- Generation reason: ${reason}

Generate JSON response with:
{
  "chapter": number,
  "title": string,
  "content": string (2000-3000 words),
  "summary": string (1-2 sentences for next chapter),
  "image": {
    "concept": string,
    "suggested_style": string,
    "tone": string
  }
}

Maintain narrative continuity, tone, and pacing consistent with previous chapters.`;

  return prompt;
}

/**
 * Parse chapter response from AI
 */
function parseChapterResponse(response, chapterSpec) {
  let chapterData;

  // Try to extract JSON from response
  const text =
    (response &&
      (response.content?.body ||
        response.content?.title ||
        response.rawText)) ||
    "";

  try {
    const jsonMatch = String(text).match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      chapterData = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // JSON parsing failed, fall back to heuristics
  }

  if (!chapterData) {
    // Build from text
    const body = text || `Content for ${chapterSpec.title}`;
    chapterData = {
      chapter: chapterSpec.chapter,
      title: chapterSpec.title,
      content: body,
      summary: (body || "").split("\n").slice(0, 2).join(" ").slice(0, 200),
      image: {
        concept: `Concept ${chapterSpec.chapter}`,
        suggested_style: null,
        tone: "neutral",
      },
    };
  }

  return {
    id: `ch_${chapterData.chapter || chapterSpec.chapter}`,
    chapter: chapterData.chapter || chapterSpec.chapter,
    title: chapterData.title || chapterSpec.title,
    content: chapterData.content || "",
    summary: chapterData.summary || "",
    image: {
      concept:
        (chapterData.image && chapterData.image.concept) ||
        `Scene for ${chapterSpec.title}`,
      style:
        (chapterData.image && chapterData.image.suggested_style) || "neutral",
      tone: (chapterData.image && chapterData.image.tone) || "neutral",
    },
  };
}

/**
 * Create fallback chapter when generation fails
 */
function createFallbackChapter(chapterSpec, previousContext, reason) {
  const fallbackContent = `[Placeholder content for Chapter ${
    chapterSpec.chapter
  }]

Title: ${chapterSpec.title}
Topics: ${(chapterSpec.estimated_topics || []).join(", ")}

This chapter explores the key topics in the context of the broader narrative. 
Continuing from: ${
    previousContext ? previousContext.slice(0, 100) : "the beginning"
  }

[Content for this chapter would be generated here, maintaining narrative continuity and pacing.]`;

  return {
    id: `ch_${chapterSpec.chapter}`,
    chapter: chapterSpec.chapter,
    title: chapterSpec.title,
    content: fallbackContent,
    summary: `Placeholder for ${chapterSpec.title}`,
    image: {
      concept: `Placeholder for ${chapterSpec.title}`,
      style: "neutral",
      tone: "neutral",
    },
    degraded: true,
    degradation_reason: reason,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  generateChaptersWithBatching,
  buildIndividualChapterPrompt,
  parseChapterResponse,
  createFallbackChapter,
};
