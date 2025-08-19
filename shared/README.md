# AetherPress Shared

Shared utilities, types, and constants for the AetherPress project.

## Purpose

This module contains code that is shared between the client and server components:

- Common TypeScript types
- Shared utility functions
- Constants and configurations

## Structure

- `types/`: TypeScript type definitions
- `utils/`: Shared utility functions
- `__tests__/`: Tests for shared code
- `scripts/`: (Future) Any shared development utilities

## Usage

This module is used as a local dependency by both the client and server.
When adding new shared functionality, ensure it's truly needed by both components
to maintain clear separation of concerns.
