# MoonBell — Art Direction Bible

**Objective:** the site must feel like *a contemporary illustrated children's book × a premium gift shop × an editorial publisher* — never a SaaS/AI template. Texture, paper, ink, and the real personalised book carry the identity. Reusable tech components (button/input/accordion) stay conventional; the *visible arrangement* is bespoke.

## The world
The homepage is a **book you leaf through**: Paper Cream stock, soft ink linework, a **ribbon bookmark** that tracks progress, a **story trail** of small ink objects connecting sections, and each section is a distinct *spread* with its own editorial composition — not the same centred-heading-plus-three-cards.

## Three signature devices (reused, proprietary)

### 1. Story Window
An **arched page-opening frame** (rounded top, soft square base) with a hand-inked double-rule border, a small gold star in a corner, and a **ribbon bookmark** hanging from the top. Used for hero imagery, book previews, emotional moments. **Never a plain rounded rectangle.** Built in CSS/SVG (arch via border-radius + inked border + ribbon), so it doesn't depend on external art.

### 2. Story Trail
A restrained **meandering dashed ink path** running down the page, dotted at section transitions with tiny story objects (crescent, star, paper boat, leaf, pencil, footprints, page fragment). Draws in once as each section enters view (`stroke-dashoffset`); static under reduced-motion. Makes the page one continuous journey.

### 3. Personal Inscription
A **handwriting typeface (Caveat)** used ONLY for short decorative annotations — "Made especially for Aarav", "Chapter one begins here", "Approved by Mum", "One brave little hero". Ink/berry colour, slight rotation, optional doodle underline. **Never** for body text, forms, or accessibility-critical text (those stay Nunito).

## Type system
- **Playfair Display** — display headings (editorial serif).
- **Nunito** — all UI, body, forms, labels (legible).
- **Caveat** (`--hand`) — inscriptions only.

## Layout principles
Alternate compositions; every major section has a distinct purpose and shape:
- Full-width illustrated moment · open-book spread · asymmetric text+illustration · layered paper · narrow reading column · edge-to-edge scene · intimate book close-up. **Do not solve every section with cards.**

## Required bespoke sections
1. **Interactive Hero** — live nickname → inked cover title inside a Story Window; book opens once to a spread. Understand the product from headline + one line + CTA.
2. **Personalisation Transformation** — a visual assembly: nickname→character name, appearance→illustrated hero, interests→setting/objects, gentle lesson→emotional arc. A connected sequence, *not* three explainer cards.
3. **Inside the Story** — real, readable spreads at size; accessible page-turn; shows illustration + writing quality, character consistency, personalisation, page count/format.
4. **Parent Reaction** — editorial **margin notes / photo captions / handwritten annotations / scrapbook**. Never a SaaS testimonial carousel. (Real reactions only — no fabrication; until we have them, an honest founder inscription.)
5. **Parent Safety Bookplate** — privacy as a clean **inside-cover bookplate** checklist; reassuring, not legalistic.
6. **Purchase** — a premium **product-detail/order page** (one product): finished book, ₹299, what's included, format, delivery time, revision policy, primary CTA. Not SaaS pricing tiers.

## Motion language (book-derived only)
Book opening · page turning · pencil/ink drawing · sketch→colour · name inking onto the cover · ribbon bookmark progressing · small objects moving into the story · subtle paper-layer depth · one restrained bell/star nudge on interaction.
**Never:** animate every element on scroll, continuous floats, pulsing CTAs, dramatic 3D spins, motion that delays reading, autoplay sound. Respect `prefers-reduced-motion` and mobile perf.

## Illustration art-direction (for generated/curated assets)
One coherent style across every image:
- **Medium:** soft painterly gouache/watercolour with visible paper grain + gentle ink outline. Not 3D, not glossy, not photoreal, not vector-flat.
- **Character proportions:** cosy ~1:3.5 head-to-body; soft rounded features; warm expressive eyes but **not** Disney-styled.
- **Line:** soft, slightly hand-drawn ink; not crisp vector.
- **Texture:** subtle paper + gouache grain; **no** plastic/AI-plastic skin.
- **Lighting:** warm single soft source (moon/lamp glow); cosy shadows, painted (not hard).
- **Saturation:** medium; MoonBell palette — Moon Indigo #5653C6 nights, Bell Gold #F5C85B highlights, Story Coral #FF7C70 accents, Paper Cream #FFF9F0.
- **Backgrounds:** simple, few objects (night sky, cosy room, garden).
- **Cast:** diverse Indian + global children/families, consistent style.
- **Reject:** distorted hands, unclear/inconsistent faces, random background objects, plastic skin, generic AI fantasy, mixed styles.

## Asset list + generation prompts (you generate, review, send back)
Prefix every prompt with: *"soft painterly gouache children's-book illustration, visible paper grain, gentle ink linework, warm single soft light, MoonBell palette (Moon Indigo nights, Bell Gold moon/stars, Story Coral accents, Paper Cream), cosy, NOT 3D/glossy/photoreal, diverse Indian children, consistent character. No text in image."*

1. **Hero spread (opens behind the cover)** — 3:2. The same child gazing up at a large golden crescent + a small glowing bell among stars, paper-cut clouds, calm indigo dreamscape. Leave calm negative space.
2. **Transformation hero** — 4:5, plain Paper-Cream ground. The child standing, full figure, neutral cosy pose — used as the "assembled hero" the details flow into.
3. **Inside-story spread A** — 3:2. Same child reaching to a friendly star in a moonlit jasmine garden with paper lanterns.
4. **Inside-story spread B** — 3:2. Same child tucked in bed hugging a plush elephant; crescent through the window, a tiny bell glowing on the sill.
5. **Character turnaround** — 3:1, Paper-Cream ground. Same child in three poses (stand, wave, read); identical face/hair/outfit — proves consistency.
6. **Small story objects** (each on transparent/plain, tiny) — a paper boat, a pencil, a leaf, a footprint pair, a page fragment, a bell — for the Story Trail.
7. **Gift/keepsake close-up** — 4:5. An open indigo gift box with the printed book and a gold-foil moon, ribbon detail — for the purchase/keepsake moment.
8. **Two more hero children** (for the cast diversity) — 4:5 covers, different children (a girl with curls; a younger toddler), same style — for reactions/gallery.

The book *titles* are typeset live by the app over the cover art, so the name changes per child.

## Originality guardrail
≥60% of the visible homepage must be bespoke composition/product presentation. If a section starts looking like a startup template (centred heading + three rounded cards), discard and recompose as a spread/scene/margin layout.
