# Channel artwork

Seymour channel artwork is a collection of coordinated 4:3 product
illustrations. Each theme must remain visually consistent across every channel
and must be understandable at the selector's small rendered size.

## Reusable generation prompt

Use the following prompt once for each channel and theme. Replace the bracketed
values, but keep the composition requirements unchanged.

> Create one channel-selection tile for a modern ambient information appliance.
> The channel is **[CHANNEL]** and the theme is **[THEME]**. Represent the
> channel with one immediately recognizable physical object or simple scene,
> centered as a premium studio product render. Use a 4:3 landscape composition
> at 640 x 480 pixels. Leave generous quiet space around the subject so it
> remains readable when reduced to a small thumbnail. Use a straight-on or
> slightly elevated three-quarter view, soft controlled shadows, restrained
> materials, and a single consistent camera and lighting setup across the whole
> theme. Do not include words, letters, numbers, captions, logos, trademarks,
> brand-specific interfaces, decorative borders, people, hands, watermarks, or
> a mock channel-selector UI. Do not crop the subject. Produce only the artwork,
> with no surrounding presentation mockup.
>
> Theme direction — **Ivory appliance**: warm off-white background; softly
> rounded ivory or light-beige object; subtle gray details; one restrained amber
> accent; bright diffuse studio lighting; friendly, calm, tactile industrial
> design.
>
> Theme direction — **Dark appliance**: near-black background; matte charcoal
> or black object; dark bronze details; one restrained warm amber edge light;
> cinematic but legible low-key studio lighting; premium, quiet, tactile
> industrial design.
>
> Theme direction — **Retro appliance**: pale blue-gray background; softly
> rounded translucent aqua, ice-blue, and warm-gray materials inspired by
> optimistic early-2000s internet appliances; restrained orange accent;
> simplified friendly geometry; clean diffuse studio lighting; nostalgic but
> not copied from any specific commercial product.
>
> For this image use only the **[SELECT ONE THEME DIRECTION]** direction. The
> resulting tile must look like part of the same family as every other channel
> generated with that direction.

Suggested channel concepts:

| Channel | Visual concept |
| --- | --- |
| Clock | Analog tabletop clock |
| Calendar | Desktop datebook or bound calendar |
| Weather | Compact weather instrument with sun and cloud forms |
| News | Folded generic newspaper without readable text |
| Photos | Small stack of generic instant photographs |
| Music | Tabletop speaker or record player |
| Messages | Sealed envelope with a subtle notification light |
| Camera | Compact security camera or doorbell camera |
| Timer | Mechanical kitchen timer |
| Home | Small house with a simple status light |

## Delivery requirements

- Export each final image as an RGB PNG at exactly 640 x 480 pixels.
- Use lowercase filenames such as `clock.png`, `calendar.png`, and
  `weather.png`.
- Keep filenames identical across theme directories.
- Inspect the complete set together for consistent scale, camera angle,
  lighting, background, shadows, and accent color.
- Reject images containing accidental text, recognizable trademarks, or UI
  labels.
- Include a matching `placeholder.png` for channels that do not yet have custom
  artwork.
