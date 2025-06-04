---
title: haptics
description: Trigger haptic feedback for enhanced user experience
---

import { Caption } from '../../../components/Caption.tsx';

# Haptics

Provides haptic feedback to enhance user interactions through physical sensations. The haptics API includes three methods for different types of feedback: impact, notification, and selection.

## Usage

```ts twoslash
import { sdk } from '@farcaster/frame-sdk'

// Trigger impact feedback
await sdk.haptics.impactOccurred('medium')

// Trigger notification feedback
await sdk.haptics.notificationOccurred('success')

// Trigger selection feedback
await sdk.haptics.selectionChanged()
```

## Methods

### impactOccurred

Triggers impact feedback, useful for simulating physical impacts.

#### Parameters

##### type

- **Type:** `'light' | 'medium' | 'heavy' | 'soft' | 'rigid'`

The intensity and style of the impact feedback.

- `light`: A light impact
- `medium`: A medium impact
- `heavy`: A heavy impact
- `soft`: A soft, dampened impact
- `rigid`: A sharp, rigid impact

#### Example

```ts twoslash
import { sdk } from '@farcaster/frame-sdk'

// Trigger when user taps a button
await sdk.haptics.impactOccurred('light')

// Trigger for more significant actions
await sdk.haptics.impactOccurred('heavy')
```

### notificationOccurred

Triggers notification feedback, ideal for indicating task outcomes.

#### Parameters

##### type

- **Type:** `'success' | 'warning' | 'error'`

The type of notification feedback.

- `success`: Indicates a successful operation
- `warning`: Indicates a warning or caution
- `error`: Indicates an error or failure

#### Example

```ts twoslash
import { sdk } from '@farcaster/frame-sdk'

// After successful action
await sdk.haptics.notificationOccurred('success')

// When showing a warning
await sdk.haptics.notificationOccurred('warning')

// On error
await sdk.haptics.notificationOccurred('error')
```

### selectionChanged

Triggers selection feedback, perfect for UI element selections.

#### Example

```ts twoslash
import { sdk } from '@farcaster/frame-sdk'

// When user selects an item from a list
await sdk.haptics.selectionChanged()

// When toggling a switch
await sdk.haptics.selectionChanged()
```

## Return Value

All haptic methods return `Promise<void>`.

## Availability

Haptic feedback availability depends on the client device and platform. You can check if haptics are supported using the `getCapabilities()` method:

```ts twoslash
import { sdk } from '@farcaster/frame-sdk'

const capabilities = await sdk.getCapabilities()

// Check if specific haptic methods are supported
if (capabilities.includes('haptics.impactOccurred')) {
  await sdk.haptics.impactOccurred('medium')
}

if (capabilities.includes('haptics.notificationOccurred')) {
  await sdk.haptics.notificationOccurred('success')
}

if (capabilities.includes('haptics.selectionChanged')) {
  await sdk.haptics.selectionChanged()
}
```

## Best Practices

1. **Use sparingly**: Overuse of haptic feedback can be distracting
2. **Match intensity to action**: Use light feedback for minor actions, heavy for significant ones
3. **Provide visual feedback too**: Not all devices support haptics
4. **Check availability**: Always verify haptic support before using
5. **Consider context**: Some users may have haptics disabled in their device settings 
