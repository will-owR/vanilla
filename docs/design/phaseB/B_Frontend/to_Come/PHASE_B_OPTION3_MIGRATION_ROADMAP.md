# Phase B Frontend: Option 3 Migration Roadmap

**Status**: Post-Option 2 (2-3 sessions out)  
**Timeline**: 6-8 hours  
**Complexity**: Medium-High  
**Risk**: Medium

---

## Executive Summary

**Option 3** migrates Phase B from a **modal/embedded UI** (Option 2) into a **dedicated application page** with full project management capabilities.

### Why Migrate from Option 2 → Option 3?

| Aspect               | Option 2                 | Option 3                     |
| -------------------- | ------------------------ | ---------------------------- |
| **Use Case**         | One-off eBook generation | Multi-project workflow       |
| **Data Persistence** | Single session           | Save/load projects           |
| **UX Pattern**       | Inline controls          | Dedicated workspace          |
| **Dashboard**        | None                     | Project list, recent edits   |
| **Mobile**           | Cramped                  | Full-screen, touch-optimized |
| **Scaling**          | Hard                     | Easy                         |

### Option 3 Enables

✅ **Project Dashboard**: Browse all saved eBooks  
✅ **Save/Load**: Persist generation configs between sessions  
✅ **Batch Operations**: Generate multiple eBooks at once  
✅ **Project History**: Track changes, versions  
✅ **Sharing**: Export project configs as JSON  
✅ **Full-Screen UI**: Better use of screen real estate

---

## Architecture: Option 3

### Route Structure

```
/ebook-generator
├── /ebook-generator/        (Dashboard)
│   └── List saved projects
│   └── "New Project" button
│   └── Search/filter
│   └── "Batch Generate" button
│
├── /ebook-generator/new     (Create New)
│   └── Config form (theme, pageCount, etc.)
│   └── Prompt input
│   └── Generate → redirects to /edit/{projectId}
│
└── /ebook-generator/edit/{projectId}  (Editor)
    ├── Theme selector
    ├── Page count slider
    ├── Preview panel
    ├── Override form
    ├── Export/save controls
    └── Project history/versions
```

### Data Model Extension

```javascript
// New ProjectStore (extends ebookStore from Option 2)
interface EbookProject {
  id: string; // UUID
  name: string; // "Quick guide to React"
  description: string; // Optional

  config: EbookStore.config;
  result: EbookStore.result | null;

  prompt: string; // Saved prompt
  createdAt: ISO8601;
  updatedAt: ISO8601;

  versions: Array<{
    id: string,
    timestamp: ISO8601,
    config: EbookStore.config,
    html: string,
  }>;

  exportedAt?: ISO8601;
  pdfUrl?: string;
}
```

### Store Hierarchy

```
projectStore (Svelte store)
  ├─ currentProject: EbookProject | null
  ├─ projects: EbookProject[]
  ├─ loading: boolean
  ├─ error: string | null
  └─ Methods:
     ├─ loadProject(projectId)
     ├─ saveProject(project)
     ├─ deleteProject(projectId)
     ├─ listProjects()
     ├─ createNew()
     └─ exportProject(projectId)

ebookStore (from Option 2)
  └─ Used internally by projectStore
     (Config + generation logic)
```

---

## Migration Path

### Phase 3a: Routing & Page Structure (2 hours)

#### 3a.1: Setup SvelteKit/Routing (if needed)

**Current State**: App.svelte is single-page SPA (no routing)

**Options**:

1. **SvelteKit**: Full framework (overkill for simple routing)
2. **Simple Hash Router**: Lightweight, ~50 lines
3. **Manual Router**: Conditional rendering (simplest)

**Recommendation**: Option 3 - Manual router (minimal migration)

**Implementation**:

```javascript
// client/src/lib/router.js
export const routes = writable('');

// App.svelte
{#if $routes === '/ebook-generator'}
  <EbookDashboard />
{:else if $routes === '/ebook-generator/new'}
  <EbookCreate />
{:else if $routes === '/ebook-generator/edit/:projectId'}
  <EbookEditor projectId={extractId($routes)} />
{:else}
  <Demo />
{/if}
```

#### 3a.2: Create Dashboard Page (45 min)

**File**: `client/src/routes/EbookDashboard.svelte` (~250 lines)

**Deliverables**:

- [x] Project list with name, updated date, status
- [x] Search/filter box
- [x] Sort options (date, name, status)
- [x] Delete project (with confirmation)
- [x] Open project button
- [x] "New Project" button
- [x] "Batch Generate" button
- [x] Loading skeleton for projects

**UI Layout**:

```
┌─────────────────────────────────────────────────┐
│  eBook Generator Dashboard                 [+]  │
├─────────────────────────────────────────────────┤
│  Search: [________]  Sort: [Date ▼]  [Batch]   │
├─────────────────────────────────────────────────┤
│ Project List                                     │
│ ┌──────────────────────────────────────────────┐│
│ │ My First Guide                  Nov 22, 2:30 PM │
│ │ 8 pages • Dark theme • Pending export        [⋮]│
│ └──────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────┐│
│ │ API Documentation                Nov 21, 5:15 PM │
│ │ 12 pages • Light theme • PDF ready  [Download]│
│ └──────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────┐│
│ │ Design System                     Nov 20, 9:00 AM │
│ │ 5 pages • Corporate theme • PDF ready [⋮]   │
│ └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

**Checklist**:

```javascript
1. Subscribe to projectStore.projects
2. Render list with map()
3. Add delete button + confirmation modal
4. Add search filter (by name)
5. Add sort dropdown (date/name/status)
6. Add icons for status (pending, ready, error)
7. Add "New Project" button → route to /new
8. Add "Batch Generate" button → show multi-select
9. Add loading spinner during fetch
10. Add empty state message if no projects
```

#### 3a.3: Create Project Editor Page (45 min)

**File**: `client/src/routes/EbookEditor.svelte` (~350 lines)

**Deliverables**:

- [x] Project metadata form (name, description)
- [x] All Option 2 components (theme, page slider, override, preview)
- [x] Save/discard buttons
- [x] Back to dashboard button
- [x] Version history sidebar
- [x] Export button
- [x] Auto-save indicator

**UI Layout**:

```
┌──────────────────────────────────────────────────────────┐
│ My First Guide        [Back] [Save] [Export] [History▼] │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────────────────────┐│
│ │ Config:          │ │ Preview                          ││
│ │ Theme: [Dark▼]   │ │ ┌────────────────────────────────┐││
│ │ Pages: [●━━━━]8  │ │ │ Sample eBook Cover             │││
│ │ Palette: [Std▼]  │ │ └────────────────────────────────┘││
│ │ Font: 1.0 [+|-]  │ │ ┌────────────────────────────────┐││
│ │                  │ │ │ Page 1 content...              │││
│ │ [Generate]       │ │ └────────────────────────────────┘││
│ └──────────────────┘ └──────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────┐│
│ │ Overrides (if result):                               ││
│ │ Theme: [Light▼]  Palette: [Vibrant▼]  [Apply]       ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Checklist**:

```javascript
1. Accept projectId as prop/route param
2. Load project from projectStore.loadProject(projectId)
3. Render project metadata in editable form
4. Import all 4 Phase B components from Option 2
5. Connect to ebookStore (from Option 2)
6. Add Save button → calls projectStore.saveProject()
7. Add Discard button → resets to last saved
8. Add Export button → calls projectStore.exportProject()
9. Add version history sidebar
10. Add auto-save on config change (debounced 2s)
11. Add unsaved changes indicator ("*" in title)
12. Add back button → routes to /ebook-generator
```

---

### Phase 3b: Project Store & Persistence (2 hours)

#### 3b.1: Create projectStore.js (1 hour)

**File**: `client/src/stores/projectStore.js` (~300 lines)

**Deliverables**:

- [x] Writable store with projects state
- [x] CRUD methods (create, read, update, delete)
- [x] Persistence layer (localStorage or backend API)
- [x] Auto-save with debounce
- [x] Version tracking
- [x] Error handling

**Interface**:

```javascript
export async function createProject(name, description)
  // Creates new empty project, returns projectId

export async function loadProject(projectId)
  // Loads project into currentProject state

export async function saveProject(project)
  // Saves project to backend/localStorage

export async function deleteProject(projectId)
  // Deletes project, removes from projects list

export async function listProjects()
  // Fetches all projects

export async function exportProject(projectId, format = 'json')
  // Exports project config as JSON or PDF

export function createVersion(projectId, config, html)
  // Creates new version in project.versions

export function undoVersion(projectId)
  // Reverts to previous version
```

**Persistence Strategy** (choose one):

**A. localStorage (Simple, no backend)**

```javascript
const STORAGE_KEY = "aether_projects_v1";

function loadProjectsFromStorage() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveProjectsToStorage(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
```

**B. Backend API (Scalable)**

```javascript
const PROJECT_API = "/api/projects";

async function loadProjectsFromAPI() {
  const res = await fetch(PROJECT_API);
  return await res.json();
}

async function saveProjectToAPI(project) {
  const res = await fetch(`${PROJECT_API}/${project.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  return await res.json();
}
```

**Recommendation**: Start with **localStorage** for Option 3a, migrate to **API** in Option 3b.

#### 3b.2: Backend API Endpoints (1 hour) _(optional for Option 3a)_

**Endpoints** (if using backend persistence):

```
GET /api/projects          # List all projects
POST /api/projects         # Create new project
GET /api/projects/{id}     # Get single project
PUT /api/projects/{id}     # Update project
DELETE /api/projects/{id}  # Delete project
POST /api/projects/{id}/versions  # Create version
```

---

### Phase 3c: Feature Enhancement (2 hours)

#### 3c.1: Auto-Save & Versioning (45 min)

**File**: Modifications to `projectStore.js`

**Implementation**:

```javascript
import { debounce } from "../lib/utils.js";

// Auto-save on config change (2s debounce)
export const autoSave = debounce((projectId, config) => {
  return saveProject({
    id: projectId,
    config,
    updatedAt: new Date().toISOString(),
  });
}, 2000);

// Version tracking
export function createVersion(projectId, config, html) {
  const version = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    config,
    html,
  };

  // Add to currentProject.versions
  // Keep last 10 versions (cleanup oldest)

  return version;
}
```

#### 3c.2: Project Settings Panel (30 min)

**File**: `client/src/routes/EbookEditorSettings.svelte` (~100 lines)

**Features**:

- [x] Project name/description editing
- [x] Visibility (private/public)
- [x] Tags/categories
- [x] Delete project button
- [x] Export project button

#### 3c.3: Batch Generation (45 min)

**File**: `client/src/routes/BatchGenerator.svelte` (~150 lines)

**Workflow**:

1. User selects multiple projects from dashboard
2. Clicks "Batch Generate"
3. Sets generation options (theme, overrides to apply)
4. System generates all in queue
5. Progress bar shows completion

**Implementation**:

```javascript
async function batchGenerate(projectIds, options) {
  const results = [];

  for (const projectId of projectIds) {
    try {
      const project = await loadProject(projectId);
      const result = await ebookStore.generate(project.prompt);
      results.push({ projectId, status: "success", result });
      await saveProject({ ...project, result });
    } catch (err) {
      results.push({ projectId, status: "error", error: err.message });
    }
  }

  return results;
}
```

---

### Phase 3d: UI/UX Polish (1 hour)

#### 3d.1: Responsive Design

- [x] Mobile: Full-screen editor, stacked sidebar
- [x] Tablet: 2-column layout
- [x] Desktop: 3-column with version history

#### 3d.2: Navigation & Breadcrumbs

- [x] Dashboard → Editor: Breadcrumb shows "My First Guide"
- [x] Back button clears unsaved changes warning (if any)
- [x] Keyboard shortcuts (Cmd+S to save, Cmd+Z to undo)

#### 3d.3: Loading & Error States

- [x] Skeleton loaders for project list
- [x] Error boundaries around pages
- [x] Retry buttons for failed API calls
- [x] Toast notifications for save success/failure

---

### Phase 3e: Testing & Validation (1 hour)

#### 3e.1: E2E Workflows

```javascript
1. Create new project:
   Dashboard → [+] → Fill form → Save
   ✅ Project appears in list

2. Edit project:
   Dashboard → Click project → Change theme → Auto-save
   ✅ Dashboard shows "Updated 30s ago"

3. Generate new version:
   Editor → Change config → [Generate]
   ✅ Version appears in history sidebar

4. Delete project:
   Dashboard → [⋮] → Delete → Confirm
   ✅ Project removed from list

5. Export project:
   Editor → [Export] → Download JSON
   ✅ File contains complete project config
```

#### 3e.2: Performance

- [x] Dashboard loads <1s (50 projects)
- [x] Editor opens <500ms
- [x] Auto-save doesn't block UI
- [x] Batch generate shows progress

#### 3e.3: Accessibility

- [x] All pages keyboard navigable
- [x] Screen readers announce project status
- [x] Focus indicators visible
- [x] Modal dialogs (delete confirm) properly trapped

---

## Implementation Timeline

| Phase     | Task                   | Duration       | Dependencies      |
| --------- | ---------------------- | -------------- | ----------------- |
| 3a.1      | Setup routing          | 30m            | Option 2 complete |
| 3a.2      | Dashboard page         | 45m            | 3a.1              |
| 3a.3      | Editor page            | 45m            | 3a.1, 3a.2        |
| 3b.1      | projectStore.js        | 60m            | 3a.3, Option 2    |
| 3b.2      | Backend API (optional) | 60m            | 3b.1              |
| 3c.1      | Auto-save & versioning | 45m            | 3b.1              |
| 3c.2      | Settings panel         | 30m            | 3a.3              |
| 3c.3      | Batch generation       | 45m            | 3b.1              |
| 3d.1      | Responsive design      | 30m            | All pages         |
| 3d.2      | Navigation & shortcuts | 15m            | All pages         |
| 3d.3      | Loading/error states   | 15m            | All pages         |
| 3e.1      | E2E workflows          | 30m            | All features      |
| 3e.2      | Performance testing    | 15m            | All features      |
| 3e.3      | Accessibility audit    | 15m            | All features      |
| **TOTAL** |                        | **~6-7 hours** |                   |

---

## Success Criteria

✅ Dashboard lists all saved projects  
✅ User can create/edit/delete projects  
✅ Changes auto-save every 2s  
✅ Version history works (undo/redo)  
✅ Batch generate processes multiple projects  
✅ Project export works (JSON format)  
✅ Mobile-responsive layout  
✅ <1s dashboard load time (50 projects)  
✅ All E2E workflows pass  
✅ Accessibility audit: 0 critical issues  
✅ Phase 2 (Option 2) still works as fallback

---

## Next Steps

**On Completion of Option 3**:

1. Commit: `feat(phase-b-frontend): Option 3 dedicated page with project management`
2. Create PR + demo video showing workflows
3. **Proceed to Option 5 Blueprint** (see `PHASE_B_OPTION5_BLUEPRINT.md`)
