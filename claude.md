
# Project Engineering Rules

## Stack
- Backend: Java 21, Spring Boot
- Frontend: React, TypeScript
- Database: PostgreSQL
- Infrastructure: GCP

## Development
- Follow existing architecture and conventions.
- Reuse existing components and utilities.
- Never rewrite unrelated code.
- Prefer minimal, targeted changes.
- Do not introduce dependencies unnecessarily.

## Token Efficiency
- Inspect only files relevant to the task.
- Do not scan the entire repository by default.
- Avoid verbose explanations.
- Do not print entire files or long command outputs.
- Report only changed files, test results, and blockers.

## Validation
- Run targeted tests first.
- Fix only errors caused by the changes.
- Do not repeatedly run the entire test suite.

