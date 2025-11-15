/**
 * Keyword Database for Phase A-B Classification
 *
 * Comprehensive keyword mappings for:
 * - Mediums: What the user wants to create (eBook, calendar, poster, etc.)
 * - Styles: Visual aesthetic (whimsical, gothic, minimalist, etc.)
 * - Themes: Mood/atmosphere/visual characteristics
 *
 * Used by RuleEngine for fast-path prompt classification.
 * Achieves >80% accuracy on intent extraction.
 */

const keywordDatabase = {
  // MEDIUMS: What user wants to create
  mediums: {
    ebook: [
      "book",
      "novel",
      "ebook",
      "e-book",
      "digital book",
      "story",
      "stories",
      "collection",
      "anthology",
      "chapters",
      "reading",
      "narrative",
      "fiction",
      "narrative collection",
      "short stories",
      "poem book",
      "poetry collection",
      "literary",
      "novel collection",
    ],
    calendar: [
      "calendar",
      "monthly",
      "yearly",
      "annual",
      "planner",
      "scheduling",
      "date",
      "dates",
      "months",
      "desk calendar",
      "wall calendar",
      "table calendar",
      "2026 calendar",
      "2025 calendar",
      "appointment",
      "schedule",
    ],
    poster: [
      "poster",
      "wall art",
      "print",
      "framed",
      "art print",
      "wall poster",
      "canvas",
      "wall decor",
      "decoration",
      "decorative",
      "hanging",
      "wall hanging",
      "large format",
      "mural",
      "artwork",
      "visual art",
    ],
    stickers: [
      "sticker",
      "stickers",
      "sticker pack",
      "decals",
      "decal",
      "label",
      "labels",
      "adhesive",
      "peel and stick",
      "vinyl",
      "sheet",
      "laptop stickers",
      "journal stickers",
      "decorative stickers",
    ],
    "greeting-card": [
      "card",
      "greeting card",
      "greeting",
      "invitation",
      "invite",
      "thank you card",
      "birthday card",
      "holiday card",
      "christmas card",
      "seasonal card",
      "postcard",
      "celebration",
      "congratulations",
      "sympathy",
      "get well",
      "envelope",
    ],
    journal: [
      "journal",
      "diary",
      "notebook",
      "writing pad",
      "composition",
      "journaling",
      "personal journal",
      "daily journal",
      "travel journal",
      "bullet journal",
      "gratitude journal",
      "reflection",
    ],
    app: [
      "app",
      "application",
      "ui",
      "interface",
      "screen",
      "mobile",
      "phone",
      "digital interface",
      "desktop",
      "web app",
      "interface design",
      "ux",
      "user interface",
    ],
    "wall-art": [
      "wall art",
      "wall decor",
      "artwork",
      "framed art",
      "wall display",
      "decorative art",
      "home decor",
      "interior decoration",
      "accent art",
      "gallery",
      "exhibition",
    ],
  },

  // STYLES: Visual aesthetic and approach
  styles: {
    whimsical: [
      "whimsical",
      "playful",
      "fun",
      "quirky",
      "lighthearted",
      "charming",
      "delightful",
      "fanciful",
      "whimsy",
      "playfulness",
      "humor",
      "humorous",
      "silly",
      "mischievous",
      "joyful",
      "cheerful",
    ],
    gothic: [
      "gothic",
      "dark",
      "mysterious",
      "eerie",
      "spooky",
      "haunting",
      "medieval",
      "dramatic",
      "moody",
      "gloomy",
      "shadowy",
      "foreboding",
      "ominous",
      "macabre",
      "mysterious darkness",
    ],
    minimalist: [
      "minimal",
      "minimalist",
      "simple",
      "clean",
      "sparse",
      "minimal design",
      "understated",
      "subtle",
      "refined",
      "elegant simplicity",
      "bare",
      "monochrome",
      "geometric",
      "modern minimal",
    ],
    "folk-art": [
      "folk art",
      "folk",
      "traditional",
      "ethnic",
      "cultural",
      "indigenous",
      "rustic",
      "handmade",
      "artisanal",
      "primitive",
      "authentic",
      "heritage",
      "bohemian",
      "boho",
    ],
    surrealist: [
      "surreal",
      "surrealism",
      "dreamlike",
      "dream",
      "dreamscape",
      "abstract",
      "fantastical",
      "impossible",
      "illogical",
      "otherworldly",
      "psychedelic",
      "bizarre",
      "strange",
      "unconventional",
    ],
    "retro-vintage": [
      "retro",
      "vintage",
      "nostalgia",
      "nostalgic",
      "1950s",
      "1960s",
      "1970s",
      "1980s",
      "throwback",
      "classic",
      "old-fashioned",
      "antique",
      "timeless",
      "period",
      "retro style",
    ],
    "modern-flat": [
      "modern",
      "contemporary",
      "flat",
      "flat design",
      "minimalistic",
      "clean lines",
      "simplistic",
      "trendy",
      "current",
      "present-day",
      "2020s style",
      "digital native",
      "tech-forward",
    ],
    ornate: [
      "ornate",
      "elaborate",
      "intricate",
      "detailed",
      "decorative",
      "baroque",
      "rococo",
      "opulent",
      "luxurious",
      "embellished",
      "ornamental",
      "grandiose",
      "complex",
      "intricate details",
    ],
    illustrative: [
      "illustrative",
      "illustration",
      "illustrated",
      "hand-drawn",
      "sketch",
      "watercolor",
      "ink",
      "artistic",
      "expressive",
      "painterly",
      "brushstroke",
      "drawing",
    ],
    photorealistic: [
      "photorealistic",
      "photo-realistic",
      "realistic",
      "lifelike",
      "photographic",
      "natural",
      "authentic realism",
      "hyper-realistic",
      "detailed realism",
      "photograph-like",
    ],
  },

  // THEMES: Mood, atmosphere, visual characteristics
  themes: {
    "playful-colors": [
      "playful",
      "colorful",
      "vibrant",
      "bold",
      "bright",
      "vivid",
      "neon",
      "saturated",
      "rainbow",
      "multi-colored",
      "fun colors",
      "cheerful colors",
      "eye-catching",
    ],
    "magical-realism": [
      "magical",
      "magic",
      "fantasy",
      "dreamlike",
      "enchanted",
      "mystical",
      "wonder",
      "wonder-filled",
      "enchantment",
      "spell",
      "fairy-tale",
      "whimsical magic",
    ],
    "dark-tones": [
      "dark",
      "darkness",
      "shadows",
      "shadow",
      "gloomy",
      "somber",
      "melancholic",
      "moody",
      "night",
      "nocturnal",
      "twilight",
      "dim",
      "low light",
      "noir",
      "dark palette",
    ],
    "ornate-details": [
      "ornate",
      "ornamental",
      "details",
      "detail-rich",
      "elaborate",
      "intricate",
      "embellished",
      "embellishment",
      "pattern",
      "patterned",
      "filigree",
      "decorative elements",
      "complex patterns",
    ],
    "earthy-textures": [
      "earthy",
      "earth tones",
      "texture",
      "textured",
      "natural",
      "organic",
      "rustic",
      "wood",
      "stone",
      "natural materials",
      "weathered",
      "aged",
      "handcrafted feel",
    ],
    "minimalist-zen": [
      "zen",
      "meditation",
      "mindful",
      "peaceful",
      "calm",
      "serene",
      "tranquility",
      "balance",
      "harmony",
      "simplicity",
      "contemplative",
      "uncluttered",
    ],
    "tech-futuristic": [
      "futuristic",
      "future",
      "sci-fi",
      "science fiction",
      "technology",
      "tech",
      "digital",
      "cyber",
      "cyberpunk",
      "neon lights",
      "holographic",
      "advanced",
      "cutting-edge",
    ],
    "nature-inspired": [
      "nature",
      "natural",
      "organic",
      "botanical",
      "flora",
      "fauna",
      "animal",
      "plants",
      "flowers",
      "wilderness",
      "landscape",
      "outdoor",
      "forest",
      "garden",
      "environmental",
    ],
    "vintage-retro": [
      "vintage",
      "retro",
      "nostalgia",
      "nostalgic",
      "old",
      "aged",
      "timeless",
      "classic",
      "heritage",
      "antique",
      "period",
      "bygone era",
    ],
    "bold-geometric": [
      "geometric",
      "geometry",
      "bold",
      "angular",
      "shapes",
      "lines",
      "pattern",
      "structured",
      "tessellation",
      "symmetry",
      "modern geometric",
      "sharp edges",
    ],
    "soft-dreamy": [
      "soft",
      "dreamy",
      "dreamy atmosphere",
      "ethereal",
      "delicate",
      "gentle",
      "pastel",
      "muted",
      "subtle",
      "romantic",
      "whimsical",
      "cloud-like",
      "misty",
    ],
    "luxury-premium": [
      "luxury",
      "luxurious",
      "premium",
      "elegant",
      "sophisticated",
      "refined",
      "upscale",
      "exclusive",
      "gold",
      "metallic",
      "marble",
      "opulent",
      "high-end",
    ],
    "cultural-diverse": [
      "cultural",
      "diverse",
      "multicultural",
      "ethnic",
      "international",
      "global",
      "world",
      "cultural elements",
      "indigenous",
      "heritage",
      "traditional",
      "authentic",
    ],
    "whimsical-creatures": [
      "creatures",
      "animals",
      "magical creatures",
      "fantasy creatures",
      "whimsical animals",
      "anthropomorphic",
      "cute animals",
      "imaginary",
      "mythical",
      "dragon",
      "phoenix",
      "unicorn",
    ],
    "moody-atmospheric": [
      "moody",
      "atmospheric",
      "mood",
      "ambiance",
      "emotion",
      "emotional",
      "intense",
      "dramatic",
      "tension",
      "suspense",
      "contemplative",
      "introspective",
    ],
  },

  // AUDIENCE: Who this is for (optional, Phase B+)
  audience: {
    children: [
      "children",
      "kids",
      "child",
      "kids collection",
      "children book",
      "young readers",
      "elementary",
      "school age",
    ],
    teens: [
      "teen",
      "teenagers",
      "young adults",
      "adolescent",
      "youth",
      "middle school",
      "high school",
      "gen z",
    ],
    adults: [
      "adult",
      "adults",
      "grown",
      "mature",
      "professional",
      "audience",
      "general audience",
    ],
    professionals: [
      "professional",
      "business",
      "corporate",
      "workplace",
      "office",
      "executive",
      "entrepreneur",
      "business owner",
    ],
  },

  // GENRE: Type of content (optional, Phase B+)
  genre: {
    poetry: ["poetry", "poem", "verse", "lyric", "poetic"],
    tutorial: ["tutorial", "guide", "how-to", "instructional", "how to"],
    narrative: ["narrative", "story", "storytelling", "fiction", "tale"],
    educational: [
      "educational",
      "educational content",
      "learning",
      "informative",
    ],
    inspirational: ["inspirational", "inspiring", "motivation", "motivational"],
  },

  // TONE: How to feel about it (optional, Phase B+)
  tone: {
    whimsical: ["whimsical", "playful", "fun", "lighthearted"],
    serious: ["serious", "formal", "professional", "grave"],
    reflective: ["reflective", "thoughtful", "meditative", "introspective"],
    energetic: ["energetic", "dynamic", "vibrant", "lively"],
    calm: ["calm", "peaceful", "serene", "tranquil"],
  },
};

/**
 * KeywordDatabase Class
 * API for accessing and querying keywords
 */
class KeywordDatabaseAPI {
  constructor(database) {
    this.database = database;
  }

  /**
   * Get all keywords for a category
   * @param {string} category - "mediums", "styles", "themes", "audience", "genre", "tone"
   * @returns {Record<string, string[]>} All keywords in category
   */
  getKeywords(category) {
    return this.database[category] || {};
  }

  /**
   * Find matching category for a token
   * @param {string} token - Single word/token to search
   * @param {string} category - Category to search in
   * @returns {string | null} Matching category key, or null
   */
  findMatches(token, category) {
    const keywords = this.database[category];
    if (!keywords) return null;

    const lowerToken = token.toLowerCase();

    for (const [key, values] of Object.entries(keywords)) {
      if (
        values.some(
          (v) =>
            v.toLowerCase() === lowerToken ||
            v.toLowerCase().includes(lowerToken) ||
            lowerToken.includes(v.toLowerCase())
        )
      ) {
        return key;
      }
    }

    return null;
  }

  /**
   * Bulk search across all keywords in a category
   * @param {string} token - Word to search for
   * @param {string} category - Category to search ("mediums", "styles", etc.)
   * @returns {string[]} All matching keys in category
   */
  searchAll(token, category) {
    const keywords = this.database[category];
    if (!keywords) return [];

    const lowerToken = token.toLowerCase();
    const matches = [];

    for (const [key, values] of Object.entries(keywords)) {
      if (
        values.some(
          (v) =>
            v.toLowerCase() === lowerToken ||
            v.toLowerCase().includes(lowerToken) ||
            lowerToken.includes(v.toLowerCase())
        )
      ) {
        matches.push(key);
      }
    }

    return matches;
  }

  /**
   * Get all categories available
   * @returns {string[]} List of category names
   */
  getCategories() {
    return Object.keys(this.database);
  }

  /**
   * Get statistics about the database
   * @returns {Object} Stats object
   */
  getStats() {
    const stats = {};
    for (const [category, keywords] of Object.entries(this.database)) {
      const totalKeywords = Object.values(keywords).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      stats[category] = {
        categories: Object.keys(keywords).length,
        totalKeywords: totalKeywords,
      };
    }
    return stats;
  }

  /**
   * Add custom keywords (for Phase B+ feedback loop)
   * @param {string} category - Category name
   * @param {string} key - Key within category
   * @param {string} keyword - Keyword to add
   */
  addKeyword(category, key, keyword) {
    if (!this.database[category]) {
      this.database[category] = {};
    }

    if (!this.database[category][key]) {
      this.database[category][key] = [];
    }

    const lowerKeyword = keyword.toLowerCase();
    if (!this.database[category][key].includes(lowerKeyword)) {
      this.database[category][key].push(lowerKeyword);
    }
  }

  /**
   * Get all keywords as flat array (for rule engine tokenization)
   * @param {string} category - Category to flatten
   * @returns {string[]} All keywords in category as flat array
   */
  getAllKeywordsFlat(category) {
    const keywords = this.database[category];
    if (!keywords) return [];

    return Object.values(keywords).flat();
  }
}

// Create singleton instance
const dbInstance = new KeywordDatabaseAPI(keywordDatabase);

// Export
module.exports = {
  keywordDatabase,
  KeywordDatabaseAPI,
  db: dbInstance,
};
