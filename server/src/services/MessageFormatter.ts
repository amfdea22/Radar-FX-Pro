export function escapeHtml(text: unknown): string {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function splitMessage(text: string, maxLen = 4096): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
        let chunk = remaining.slice(0, maxLen);
        const lastBreak = chunk.lastIndexOf('\n');
        if (lastBreak > maxLen * 0.4) {
            chunk = chunk.slice(0, lastBreak);
        }
        chunks.push(chunk);
        remaining = remaining.slice(chunk.length);
    }
    return chunks;
}

export async function replyWithSplit(
    replyFn: (text: string) => Promise<boolean>,
    text: string
): Promise<void> {
    const parts = splitMessage(text);
    for (const part of parts) {
        await replyFn(part);
    }
}

export function formatSparkline(results: (string | undefined)[], maxLen = 10): string {
    return results
        .filter(Boolean)
        .slice(-maxLen)
        .map(r => (r === 'WIN' ? '🟢' : r === 'LOSS' ? '🔴' : '⚪'))
        .join('');
}
