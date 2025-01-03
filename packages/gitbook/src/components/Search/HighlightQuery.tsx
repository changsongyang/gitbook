import { ClassValue, tcls } from '@/lib/tailwind';

/**
 * Match a string against a query and render the matching text in bold.
 */
export function HighlightQuery(props: {
    /** Query to match in the `text` */
    query: string;
    /** Text input */
    text: string;
    /** Style to apply on matching parts (default to primary) */
    highlight?: ClassValue;
}): React.ReactElement {
    const {
        query,
        text,
        highlight = [
            'text-bold',
            'bg-primary-100',
            'text-contrast-primary-100',
            'dark:bg-primary-700',
            'dark:text-contrast-primary-700',
            'px-0.5',
            '-mx-0.5',
            'py-0.5',
            'rounded',
            'straight-corners:rounded-sm',
        ],
    } = props;
    const matches = matchString(text, query);

    return (
        <div className={tcls('whitespace-break-spaces')}>
            {matches.map((entry, index) => (
                <span key={index} className={tcls(entry.match ? highlight : null)}>
                    {entry.text}
                </span>
            ))}
        </div>
    );
}

interface TextMatch {
    text: string;
    match?: string;
}

function matchString(text: string, query: string): TextMatch[] {
    const words = splitQuery(query);
    const initialParts = [{ text }];

    return words.reduce((parts, word) => matchWordInParts(parts, word), initialParts);
}

function matchWordInParts(parts: TextMatch[], word: string): TextMatch[] {
    return parts.reduce((result, part) => {
        if (part.match) {
            result.push(part);
            return result;
        }

        const { text } = part;
        const index = text.toLowerCase().indexOf(word);
        if (index >= 0) {
            const before = text.slice(0, index);
            const inner = text.slice(index, index + word.length);
            const after = text.slice(index + word.length);

            if (before.length > 0) result.push({ text: before });
            if (inner.length > 0) result.push({ text: inner, match: word });
            if (after.length > 0) result.push({ text: after });

            return result;
        }

        result.push({ text });
        return result;
    }, [] as TextMatch[]);
}

function splitQuery(text: string): string[] {
    return text.toLowerCase().split(' ');
}
