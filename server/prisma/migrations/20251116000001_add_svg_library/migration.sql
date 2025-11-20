-- SVG Library Table - Phase A-B Module 1
-- Stores SVG assets with searchable metadata (JSONB) for image reuse
-- Implements query-first strategy to reduce AI image generation costs

CREATE TABLE IF NOT EXISTS svg_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Visual asset
  svg_data TEXT NOT NULL,
  png_url VARCHAR(512),

  -- Searchable metadata (JSONB for flexibility)
  metadata JSONB NOT NULL,

  -- Tracking
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  created_by VARCHAR(255),

  -- Performance metrics
  file_size_bytes INTEGER,
  render_time_ms INTEGER
);

-- Create indexes for common searches
-- Index on concept (for content-based search)
CREATE INDEX IF NOT EXISTS idx_svg_library_concept 
  ON svg_library USING GIN (metadata jsonb_path_ops);

-- Index on style (for aesthetic filtering)
CREATE INDEX IF NOT EXISTS idx_svg_library_style 
  ON svg_library USING GIN (metadata jsonb_path_ops);

-- Index on usage count (for reuse tracking)
CREATE INDEX IF NOT EXISTS idx_svg_library_usage 
  ON svg_library ((metadata->>'usageCount')::INT DESC)
  WHERE deleted_at IS NULL;

-- Index on creation date (for time-based queries)
CREATE INDEX IF NOT EXISTS idx_svg_library_created_at 
  ON svg_library (created_at DESC)
  WHERE deleted_at IS NULL;

-- Index on soft delete (for active items query)
CREATE INDEX IF NOT EXISTS idx_svg_library_active 
  ON svg_library (deleted_at)
  WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON TABLE svg_library IS 'SVG asset library for Phase A-B classification system. Implements query-first strategy for image reuse and cost optimization.';
COMMENT ON COLUMN svg_library.metadata IS 'JSONB metadata: concept, style, theme[], audience, sourcePrompt, generatedPrompt, sourceProvider, usageCount, tags[], license';
