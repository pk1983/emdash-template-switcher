/** Format a date for display; returns null for missing dates. */
export function formatDate(
	date: Date | null | undefined,
	opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string | null {
	if (!date) return null;
	return date.toLocaleDateString("en-US", opts);
}
