/** Estimate reading time (minutes) from a Portable Text body. */
export function readingTime(content: unknown, wpm = 200): number {
	let words = 0;
	if (Array.isArray(content)) {
		for (const block of content as any[]) {
			if (block?._type === "block" && Array.isArray(block.children)) {
				for (const child of block.children) {
					if (typeof child?.text === "string")
						words += child.text.trim().split(/\s+/).filter(Boolean).length;
				}
			}
		}
	}
	return Math.max(1, Math.round(words / wpm));
}
