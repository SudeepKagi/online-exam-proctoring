# Testing Guide

ProctorNet maintains an automated test suite covering backend logic, API contracts, security invariants, and browser user journeys.

## Test Architecture

The testing strategy consists of three primary levels:

1. **Backend Unit & Integration Tests**: Node.js built-in test runner tests database controllers, authentication guards, scoring math, and proctoring event pipelines.
2. **End-to-End Browser Journeys**: Playwright runs automated tests in real Chromium browsers, verifying candidate exams, invigilator consoles, and admin workflows.
3. **Static Analysis & Type Checks**: TypeScript compiler runs in non-emitting mode across workspaces alongside ESLint.

## Running Backend Tests

Run all backend unit and integration test suites:

```bash
npm test
```

To run a single backend test file:

```bash
node --env-file=.env.test --test backend/tests/exam-creation-validation.test.js
```

Backend test suites use mock storage and biometric drivers by default. They do not require live AWS credentials to run.

## Running End-to-End Tests

ProctorNet uses Playwright to test critical user journeys in headless or headed browsers.

Run the full end-to-end test suite:

```bash
npm run test:e2e
```

Run smoke tests for rapid pre-commit verification:

```bash
npm run test:smoke
```

## Running Static Checks and Linters

Run TypeScript type validation across frontend and backend workspaces:

```bash
npm run typecheck
```

Run ESLint to check code quality standards:

```bash
npm run lint
```

## Running Documentation Checks

Verify documentation links, formatting, and content rules:

```bash
npm run docs:check
```
