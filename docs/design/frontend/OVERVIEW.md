# Frontend Overview

date: 2025-11-08
status: active
description: |
Active overview document for the Aether frontend implementation.
Reflects current state and planned enhancements.

## Application Structure

### Core Components

```
client/
├── src/
│   ├── App.svelte           # Application root
│   ├── components/          # UI components
│   │   ├── PromptInput.svelte
│   │   ├── Preview.svelte
│   │   └── ModeSelector.svelte (planned)
│   ├── lib/                # Core logic
│   │   ├── flows.js        # Main flows
│   │   ├── api.js          # API client
│   │   └── stores/         # State management
│   └── styles/             # Global styles
└── tests/                  # Test suites
```

### Key Components

1. **App.svelte**
   - Application container
   - Global state initialization
   - Health monitoring
   - Mode/view management

2. **PromptInput.svelte**
   - Core input interface
   - Validation logic
   - Generation triggers
   - Loading states

3. **Preview.svelte**
   - Result visualization
   - Dynamic updates
   - Error handling
   - Style injection

4. **ModeSelector.svelte** (planned)
   - Mode switching interface
   - Selection persistence
   - View coordination

## Data Flow

### Generation Flow

```
User Input → Validation → Generation Request → Preview
     ↓          ↓             ↓                ↓
  Prompt    Validation    API Request     Preview Update
  Store      Feedback    Status Update    Content Render
```

### State Management

1. **Content Store**
   - Prompt data
   - Generation results
   - Content history
   - Mode state

2. **UI Store**
   - Loading states
   - Error conditions
   - User feedback
   - View state

3. **Preview Store**
   - Preview content
   - Render state
   - Style management
   - Cache control

## API Integration

### Core Endpoints

- `/health` - Backend status
- `/prompt` - Generation requests
- `/preview` - Content preview
- `/persist` - Content storage

### Implementation Details

1. **Request Handling**
   - Retry with backoff
   - Error recovery
   - Timeout management
   - Cache strategies

2. **Response Processing**
   - Content normalization
   - Preview generation
   - Error handling
   - State updates

## Current Features

### Core Functionality

- Single prompt generation
- Real-time preview
- Error handling
- State persistence
- Health monitoring

### UI/UX

- Clean, focused interface
- Clear feedback
- Loading indicators
- Error visualization
- Responsive design

## Planned Enhancements

### Mode Selection UI

```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│                 │ │                 │ │                 │
│ Basic Prompt →  │ │ Demo Prompt  →  │ │ eBook Prompt →  │
│      Book       │ │      Book       │ │      Book       │
│                 │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Feature Additions

1. **Multi-mode Support**
   - Basic prompt handling
   - Demo mode with metadata
   - eBook specific features

2. **Enhanced Preview**
   - Faster rendering
   - Better style handling
   - More format options

3. **Improved Feedback**
   - Detailed error messages
   - Progress indicators
   - Success confirmations

## Technical Stack

- **Framework**: Svelte
- **Build**: Vite
- **State**: Svelte stores
- **API**: Fetch with retry
- **Styling**: Scoped CSS
- **Testing**: Vitest/Playwright

## Development Guidelines

### Code Organization

- Component-focused structure
- Clear state management
- Consistent naming
- Documentation inline

### Styling Principles

- System fonts
- Consistent spacing
- Clear hierarchy
- Responsive design

### Best Practices

- Keep components focused
- State management clarity
- Error handling consistency
- Test coverage
- Performance consideration

---

This document is actively maintained.
Last Updated: 2025-11-08
