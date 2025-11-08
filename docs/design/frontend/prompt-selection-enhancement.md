# Prompt Selection UI Enhancement

date: 2025-11-08
status: draft
description: |
Design document for extending the current prompt selection UI to support
multiple prompt types while maintaining simplicity and familiarity.

## Current State

Single option in UI:

```
[Basic Prompt → Book]
```

## Proposed Enhancement

Extend current UI with two additional options:

```
[Basic Prompt → Book] [Demo Prompt → Book] [eBook Prompt → Book]
```

## Design Principles

1. **KISS (Keep It Simple Silly)**

   - Extend existing patterns
   - Maintain current interaction model
   - No unnecessary complexity

2. **Familiarity**

   - Use existing button/selection styling
   - Keep current layout approach
   - Maintain existing visual hierarchy
   - Same state management pattern

3. **Minimal Changes**
   - Add options horizontally
   - Preserve current click-to-select behavior
   - Reuse existing component structure

## Implementation Approach

1. **UI Elements**

   - Extend current selection container horizontally
   - Add two new selection options
   - Maintain consistent spacing between options
   - Use existing button/selection component

2. **State Management**

   - Extend current selection state to handle three options
   - Maintain single active selection
   - Use existing state management pattern

3. **Layout**

   - Horizontal arrangement
   - Equal spacing between options
   - Consistent with current styling
   - Responsive to container width

4. **User Interaction**
   - Click to select (current behavior)
   - Clear visual feedback for selected state
   - Single active selection at a time

## Content Views

Each selection maps to a specific view:

1. **Basic Prompt → Book**

   - Current implementation
   - No changes needed

2. **Demo Prompt → Book**

   - New view based on basic pattern
   - Maps to demo functionality

3. **eBook Prompt → Book**
   - New view based on basic pattern
   - Maps to eBook functionality

## Future Considerations

1. **Extensibility**

   - Design allows for additional options if needed
   - Maintains horizontal layout pattern
   - Consistent with existing UI patterns

2. **Maintenance**
   - Simple structure means easier updates
   - Consistent patterns reduce maintenance overhead
   - Clear separation of concerns

---

This design focuses on minimal, effective changes while maintaining the current user experience patterns. It prioritizes simplicity and familiarity over complex interactions or animations.
