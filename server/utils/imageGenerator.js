/**
 * Image Generator - Phase A (Demo Mode)
 * Generate or provide placeholder images (1 per page)
 * Phase A: Returns placeholder gray images for now
 * Future (Phase B): Integrate real image generation API (DALL-E, etc.)
 */

/**
 * Extract key concept from page content for image generation
 * @param {string} text - Page content text
 * @returns {string} Key concept/term to use in image generation
 */
function extractConcept(text) {
  if (!text || text.trim().length === 0) {
    return "Professional illustration";
  }

  // Extract meaningful terms (nouns, typically 2-3 words)
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4); // Filter for longer words (more likely to be meaningful)

  if (words.length === 0) {
    return "Professional illustration";
  }

  // Take first 1-2 meaningful words
  const concept = words.slice(0, 2).join(" ");
  return concept.charAt(0).toUpperCase() + concept.slice(1);
}

/**
 * Create placeholder gray image
 * Phase A fallback: returns placeholder when real API not available
 * @param {number} pageNumber - Page number for caption
 * @returns {Object} { url, caption, altText }
 */
function createPlaceholder(pageNumber) {
  return {
    url: `file:///tmp-exports/placeholder-gray-${pageNumber}.png`,
    caption: `Figure ${pageNumber}: [Placeholder Image]`,
    altText: `Placeholder image for page ${pageNumber}`,
  };
}

/**
 * Generate image for page or return placeholder
 * @param {string} pageContent - Content of the page
 * @param {number} pageNumber - Page number (1-5)
 * @param {string} jobId - Job ID for file naming
 * @returns {Promise<Object>} { url, caption, altText }
 */
async function generateImageForPage(pageContent, pageNumber, jobId) {
  try {
    // Extract concept from content
    const concept = extractConcept(pageContent);

    // Phase A: Return placeholder (future: call real API)
    // const prompt = `Professional illustration of ${concept}`;
    // const imageBuffer = await callImageAPI(prompt);
    // const filepath = await saveToDisk(imageBuffer, jobId, pageNumber);

    // For now, return placeholder
    return {
      url: `file:///tmp-exports/demo-img-${jobId}-${pageNumber}.png`,
      caption: `Figure ${pageNumber}: ${concept}`,
      altText: `Illustration of ${concept}`,
    };
  } catch (error) {
    // Fallback to placeholder on any error
    return createPlaceholder(pageNumber);
  }
}

/**
 * Batch generate images for multiple pages
 * @param {Array} pages - Array of page objects with content
 * @param {string} jobId - Job ID for file naming
 * @returns {Promise<Array>} Array of image objects
 */
async function generateImagesForPages(pages, jobId) {
  const images = [];
  for (let i = 0; i < pages.length; i++) {
    const pageContent = pages[i].content || "";
    const image = await generateImageForPage(pageContent, i + 1, jobId);
    images.push(image);
  }
  return images;
}

module.exports = {
  extractConcept,
  createPlaceholder,
  generateImageForPage,
  generateImagesForPages,
};
