---
description: Refactor LightObsidian incrementally. Keep App.tsx as a composition root, move business logic into feature hooks and services, preserve behavior, minimize coupling, and avoid unnecessary abstractions or overengineering.
---

# LightObsidian Architecture Workflow

## Goal

Refactor the project incrementally while preserving functionality.

The target architecture is **Feature + Hooks + Services**, not full Clean Architecture.

Every refactoring must reduce complexity without introducing unnecessary abstractions.

---

# Core Principles

- Preserve existing behavior.
- Keep changes incremental.
- Refactor before adding new functionality.
- Prefer composition over inheritance.
- Avoid overengineering.
- Follow SOLID where it improves readability.
- Keep files focused on a single responsibility.

---

# Architectural Targets

## App.tsx

App.tsx is the application composition root.

It should only:

- initialize application state
- connect feature hooks
- render layout
- pass props

App.tsx must NOT contain:

- business logic
- markdown parsing
- graph generation
- import/export logic
- database operations
- flashcard algorithms

---

## Feature Structure

Organize new code by feature instead of file type.

Example:

src/

features/

    notes/

        components/

        hooks/

        services/

    editor/

    graph/

    review/

    timeline/

    settings/

Shared code belongs in:

shared/

core/

---

## Hooks

Move state management into custom hooks.

Examples:

- useNotes()
- useWorkspace()
- useSettings()
- useDialogs()
- useSearch()

Hooks own state and UI behavior.

Components consume hooks.

---

## Services

Business logic belongs in services.

Examples:

- MarkdownService
- GraphService
- FlashcardService
- ExportService

Services must:

- be framework independent
- avoid React imports
- avoid JSX
- be reusable

---

## Repository Layer

UI must not directly access IndexedDB.

Use repositories.

Example:

NoteRepository

Responsibilities:

- load
- save
- rename
- delete
- move
- search

Repository hides storage implementation.

---

## Components

Components should focus on rendering.

Avoid:

- complex data processing
- large algorithms
- database access

Components should receive prepared data.

---

## Utilities

Do not create large utility files.

Instead of:

utils.ts

Prefer:

markdown.ts

wikilinks.ts

rename.ts

export.ts

parser.ts

Each file should have one purpose.

---

## State Management

Keep state close to the feature that owns it.

Avoid global state unless multiple unrelated features require it.

---

## Dependencies

Preferred dependency direction:

UI

↓

Hooks

↓

Services

↓

Repositories

↓

Database

Never reverse this dependency flow.

---

## File Size Guidelines

Target sizes:

App.tsx

<250 lines

React component

<250 lines

Hook

200–400 lines

Service

<400 lines

Utility

<200 lines

Large files should be split by responsibility.

---

## Refactoring Order

When improving architecture, always follow this order:

1. Extract Settings hook
2. Extract Dialogs hook
3. Extract Workspace hook
4. Introduce NoteRepository
5. Extract Notes hook
6. Extract MarkdownService
7. Extract GraphService
8. Extract FlashcardService
9. Extract ExportService
10. Simplify App.tsx

Never perform multiple architectural changes in one large commit.

---

## Rules

Always:

- preserve existing behavior
- prefer small commits
- reduce coupling
- improve cohesion
- eliminate duplicate logic
- avoid premature abstraction
- keep naming consistent
- write readable code

Never:

- introduce architecture for its own sake
- create unnecessary interfaces
- add dependency injection without need
- move logic without reducing complexity
- create "God" components
- create "God" utility files

Every refactoring should make the project simpler than before.