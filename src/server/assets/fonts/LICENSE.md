# Embedded fonts

These faces are embedded into the print master, which is why they are checked in
rather than loaded from `next/font` — the browser cache holds `.woff2`, and a PDF
needs the `.ttf` outlines. A printer's RIP substitutes any font it cannot find, so
an un-embedded face means the book comes back set in something else.

| File | Family | Weight | Used for |
| --- | --- | --- | --- |
| `PlayfairDisplay-Bold.ttf` | Playfair Display | 700 | titles, "The End" |
| `Nunito-SemiBold.ttf` | Nunito | 600 | headings, the dedication |
| `Nunito-Regular.ttf` | Nunito | 400 | story text, imprint page |

Both families are licensed under the **SIL Open Font License 1.1**, which permits
embedding in documents commercially. Sources:

- Playfair Display — <https://fonts.google.com/specimen/Playfair+Display>
- Nunito — <https://fonts.google.com/specimen/Nunito>

Full licence text: <https://openfontlicense.org/>

Keep these in step with the web faces declared in `src/app/layout.tsx`: the
printed book and the site should not be set in different type.
