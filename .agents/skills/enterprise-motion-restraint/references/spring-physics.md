# Spring Physics Reference & Emulation

This guide documents the physics configurations and emulation procedures for motion in ProctorNet.

## Enterprise Spring Configurations

```javascript
export const springs = {
  // Snappy micro-interactions (buttons, pills, icon clicks)
  micro: { type: 'spring', stiffness: 500, damping: 30, mass: 0.5 },
  
  // Standard UI (dropdowns, tooltips, cards)
  snappy: { type: 'spring', stiffness: 400, damping: 28 },
  
  // Gentle surfaces (dialogs, bottom sheets)
  gentle: { type: 'spring', stiffness: 320, damping: 32 },
  
  // Fluid page level (route transitions)
  fluid: { type: 'spring', stiffness: 260, damping: 30 }
}
```

## Emulating Reduced Motion in Automated Tests

```typescript
// In Playwright E2E tests:
test('respects reduced-motion preference in exam runner', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/student/exams/1/live')
  
  // Verify animations are disabled
  const transition = await page.locator('.page-transition').evaluate((el) => {
    return window.getComputedStyle(el).animationDuration
  })
  expect(transition === '0.001s' || transition === '0s').toBeTruthy()
})
```
