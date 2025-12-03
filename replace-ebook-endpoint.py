#!/usr/bin/env python3
"""
Replace the synchronous ebook endpoint with the polling model
This script reads the endpoint code and replaces it with the new polling version
"""

import re

# Read the original file
with open('/workspaces/AetherPress/server/index.js', 'r') as f:
    content = f.read()

# Find the start of the POST ebook endpoint (line 2931)
start_marker = '''app.post("/api/ebook/generate", async (req, res) => {
  const startTime = Date.now();
  const reqId = req.id || "unknown";
  console.log(
    `[${new Date().toISOString()}] [${reqId}] POST /api/ebook/generate started`
  );

  // Set a long timeout for large ebook generation (20 pages can take 5+ minutes with Gemini)
  // Default is usually 2 minutes, but LLM generation is inherently slow
  req.setTimeout(600000); // 10 minutes for ebook generation
  res.setTimeout(600000); // 10 minutes'''

# Find the end of the POST ebook endpoint (before POST /api/override)
end_marker = '''});

/**
 * POST /api/override'''

# Read the polling implementation
with open('/workspaces/AetherPress/server/ebook-polling-endpoints.js.fragment', 'r') as f:
    polling_code = f.read()

# Extract just the POST endpoint code from the fragment
# (We'll add the helper function and other endpoints separately)
polling_post_start = polling_code.find('/**\n * POST /api/ebook/generate')
polling_post_end = polling_code.find('/**\n * GET /api/ebook/generate/:jobId/status')

if polling_post_start != -1 and polling_post_end != -1:
    polling_post_code = polling_code[:polling_post_end]
    polling_endpoints_code = polling_code[polling_post_start:]
    
    # Replace in content
    if start_marker in content and end_marker in content:
        start_idx = content.find(start_marker)
        end_idx = content.find(end_marker)
        
        if start_idx != -1 and end_idx != -1:
            # Find the beginning of the app.post line
            line_start = content.rfind('\napp.post', 0, start_idx) + 1
            
            # Get everything before the endpoint
            before = content[:line_start]
            
            # Get the new polling endpoints code
            new_endpoints = polling_endpoints_code
            
            # Get everything after the old endpoint ends
            after = content[end_idx:]
            
            # Also need to add the helper function before the endpoints
            helper_func_start = polling_code.find('/**\n * Helper function to generate ebook')
            helper_func_end = polling_code.find('/**\n * POST /api/ebook/generate')
            helper_func = polling_code[helper_func_start:helper_func_end]
            
            # Construct the new content
            new_content = before + helper_func + '\n' + new_endpoints + '\n' + after
            
            # Write back
            with open('/workspaces/AetherPress/server/index.js', 'w') as f:
                f.write(new_content)
            
            print("✓ Successfully replaced ebook endpoints with polling model")
            print(f"  - Removed {end_idx - line_start} characters of old code")
            print(f"  - Added new polling endpoints and helper function")
        else:
            print("✗ Could not find exact marker locations")
    else:
        print("✗ Start or end marker not found in file")
else:
    print("✗ Could not extract polling code sections from fragment")
