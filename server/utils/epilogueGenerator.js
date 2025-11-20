/**
 * Epilogue Generator - Phase A (Demo Mode)
 * Generates standardized back matter for PDF documents
 * Phase A: Single "all" template (closing + bio + resources)
 * Future (Phase B): Individual templates (closing, bio, resources independently)
 */

/**
 * Generate standard epilogue structure
 * @param {Object} metadata - { author, contactEmail, resources: [{title, url}, ...] }
 * @returns {Object} Epilogue object with closing, bio, resources sections
 */
function generateEpilogue(metadata = {}) {
  const author = metadata.author || "CELS";
  const contactEmail = metadata.contactEmail || "contact@example.com";
  const resources = Array.isArray(metadata.resources) ? metadata.resources : [];

  return {
    type: "epilogue",
    enabled: true,
    epilogueType: "all", // Phase A: only "all" type
    sections: {
      closing: generateClosing(),
      bio: generateBio(author, contactEmail),
      resources: generateResources(resources),
    },
  };
}

/**
 * Generate closing remarks section
 * @returns {Object} { title, content }
 */
function generateClosing() {
  return {
    title: "Closing Remarks",
    content: `Thank you for exploring this presentation. We hope the insights and perspectives shared have provided value and inspiration for your continued learning and growth. If you have any questions, feedback, or would like to discuss these topics further, please don't hesitate to reach out. Your engagement and participation are greatly appreciated.`,
  };
}

/**
 * Generate bio section
 * @param {string} author - Author name
 * @param {string} contactEmail - Contact email
 * @returns {Object} { title, content, email }
 */
function generateBio(author, contactEmail) {
  return {
    title: "About the Author",
    content: `${author} is dedicated to creating and sharing knowledge that drives innovation and positive change. With a focus on clarity and accessibility, ${author} works to make complex topics understandable and actionable for diverse audiences. Through writing, teaching, and mentoring, ${author} continues to contribute to the advancement of knowledge and skills in the field.`,
    email: contactEmail,
  };
}

/**
 * Generate resources section
 * @param {Array} resources - Array of { title, url } objects
 * @returns {Object} { title, items }
 */
function generateResources(resources) {
  return {
    title: "Further Resources",
    items: resources.map((resource) => ({
      title: resource.title || "Resource",
      url: resource.url || "#",
    })),
  };
}

module.exports = {
  generateEpilogue,
  generateClosing,
  generateBio,
  generateResources,
};
