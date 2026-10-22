/**
 * Pure title-format logic: configuration, preset expansion, the model prompt,
 * model-output parsing, and rendering. Nothing here touches the Harness, so it
 * is unit-testable without a Cordis context.
 */
/** Parts a title can be assembled from. `summary` is the only mandatory one. */
export const SEGMENTS = ["type", "date", "summary"];
/** Built-in layouts. A preset only supplies defaults for `segments` and `separator`. */
export const PRESETS = {
    /** `feat/261022/add login flow` */
    conventional: { segments: ["type", "date", "summary"], separator: "/" },
    /** `feat/add login flow` */
    "type-summary": { segments: ["type", "summary"], separator: "/" },
    /** `add login flow` */
    summary: { segments: ["summary"], separator: " " },
};
export const DEFAULT_TYPES = [
    "feat",
    "fix",
    "refactor",
    "docs",
    "chore",
    "style",
    "test",
    "perf",
    "build",
    "ci",
    "revert",
];
function positiveInt(value, fallback, label) {
    const resolved = value ?? fallback;
    if (!Number.isSafeInteger(resolved) || resolved < 1) {
        throw new Error(`session-title-layout: ${label} must be a positive safe integer`);
    }
    return resolved;
}
/** Validate user configuration and expand the preset. Throws on any invalid field. */
export function resolveConfig(config = {}) {
    const presetName = config.preset ?? "conventional";
    const preset = Object.hasOwn(PRESETS, presetName) ? PRESETS[presetName] : undefined;
    if (preset === undefined) {
        throw new Error(`session-title-layout: unknown preset "${String(presetName)}"`);
    }
    const segments = config.segments ?? preset.segments;
    if (segments.length === 0 || new Set(segments).size !== segments.length) {
        throw new Error("session-title-layout: segments must be non-empty and unique");
    }
    for (const segment of segments) {
        if (!SEGMENTS.includes(segment)) {
            throw new Error(`session-title-layout: unknown segment "${String(segment)}"`);
        }
    }
    if (!segments.includes("summary")) {
        throw new Error('session-title-layout: segments must include "summary"');
    }
    const types = (config.types ?? DEFAULT_TYPES).map((type) => type.trim().toLowerCase());
    if (segments.includes("type") && (types.length === 0 || types.some((type) => type === ""))) {
        throw new Error("session-title-layout: types must contain non-empty strings");
    }
    const automatic = config.automatic ?? "first-prompt";
    if (automatic !== "first-prompt" && automatic !== "all-prompts") {
        throw new Error('session-title-layout: automatic must be "first-prompt" or "all-prompts"');
    }
    const summaryLanguage = config.summaryLanguage?.trim();
    if (config.summaryLanguage !== undefined && summaryLanguage === "") {
        throw new Error("session-title-layout: summaryLanguage must not be empty");
    }
    const dateSource = config.dateSource ?? "session-created";
    if (dateSource !== "session-created" && dateSource !== "now") {
        throw new Error('session-title-layout: dateSource must be "session-created" or "now"');
    }
    if ((config.provider === undefined) !== (config.model === undefined)) {
        throw new Error("session-title-layout: provider and model must be set together");
    }
    return {
        segments,
        separator: config.separator ?? preset.separator,
        types,
        dateFormat: config.dateFormat ?? "YYMMDD",
        dateSource,
        summaryMaxLength: positiveInt(config.summaryMaxLength, 40, "summaryMaxLength"),
        summaryLanguage,
        automatic,
        route: config.provider !== undefined && config.model !== undefined
            ? { provider: config.provider, model: config.model }
            : undefined,
        maxInputChars: positiveInt(config.maxInputChars, 8000, "maxInputChars"),
        maxOutputTokens: positiveInt(config.maxOutputTokens, 2048, "maxOutputTokens"),
        timeoutMs: positiveInt(config.timeoutMs, 60_000, "timeoutMs"),
    };
}
/** System prompt asking only for the model-written segments (`type`, `summary`). */
export function buildSystemPrompt(config) {
    const wantsType = config.segments.includes("type");
    const shape = wantsType ? '{"type": "...", "summary": "..."}' : '{"summary": "..."}';
    const lines = [
        "Generate a title for an AI coding-assistant session from the user's messages.",
        `Reply with ONLY one JSON object of exactly this shape, with no code fence and no commentary: ${shape}`,
    ];
    if (wantsType) {
        lines.push(`- "type" is exactly one of: ${config.types.join(", ")}.`);
    }
    lines.push(`- "summary" is a short plain phrase, at most ${config.summaryMaxLength} characters, that lets a reader tell what the session is about.`, config.summaryLanguage === undefined
        ? '- Write "summary" in the language the user wrote in. No Markdown, no surrounding quotes, no trailing punctuation.'
        : `- Write "summary" in ${config.summaryLanguage}, whatever language the user wrote in. No Markdown, no surrounding quotes, no trailing punctuation.`, "Do not reason or explain. Output the JSON object immediately.");
    return lines.join("\n");
}
function truncateChars(input, max) {
    const chars = Array.from(input);
    return chars.length <= max ? input : chars.slice(0, max).join("").trimEnd();
}
function cleanSummary(input, max) {
    const collapsed = input.replace(/\s+/gu, " ").trim();
    const unquoted = collapsed.replace(/^["'`“”‘’]+|["'`“”‘’]+$/gu, "").trim();
    return truncateChars(unquoted, max);
}
/**
 * Parse the model reply. Throws when it is unusable, so the caller keeps the
 * previous title instead of writing a guess.
 */
export function parseModelOutput(raw, config) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) {
        throw new Error("session-title-layout: model reply contains no JSON object");
    }
    let value;
    try {
        value = JSON.parse(raw.slice(start, end + 1));
    }
    catch {
        throw new Error("session-title-layout: model reply is not valid JSON");
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("session-title-layout: model reply is not a JSON object");
    }
    const record = value;
    const summary = typeof record["summary"] === "string"
        ? cleanSummary(record["summary"], config.summaryMaxLength)
        : "";
    if (summary === "") {
        throw new Error("session-title-layout: model reply has no summary");
    }
    let type;
    if (config.segments.includes("type")) {
        const candidate = typeof record["type"] === "string" ? record["type"].trim().toLowerCase() : "";
        if (!config.types.includes(candidate)) {
            throw new Error(`session-title-layout: model reply type "${candidate}" is not allowed`);
        }
        type = candidate;
    }
    return { type, summary };
}
/** Format an epoch-millisecond instant in local time using YYYY, YY, MM, DD tokens. */
export function formatDate(epochMs, format) {
    const date = new Date(epochMs);
    const year = String(date.getFullYear());
    const values = {
        YYYY: year,
        YY: year.slice(-2),
        MM: String(date.getMonth() + 1).padStart(2, "0"),
        DD: String(date.getDate()).padStart(2, "0"),
    };
    return format.replace(/YYYY|YY|MM|DD/gu, (token) => values[token] ?? token);
}
/** Join the enabled segments in configured order. `date` is rendered by the caller's clock. */
export function renderTitle(parts, dateText, config) {
    const pieces = config.segments.map((segment) => {
        switch (segment) {
            case "type":
                return parts.type ?? "";
            case "date":
                return dateText;
            case "summary":
                return parts.summary;
        }
    });
    return pieces.join(config.separator);
}
/**
 * Choose which messages to send: the first one, then the newest that fit the
 * character budget. Returned in log order.
 */
export function selectMessages(messages, budget, perMessageLimit = 2000) {
    const clip = (message) => ({ message, text: message.text.slice(0, perMessageLimit) });
    const first = messages[0];
    if (first === undefined)
        return [];
    const chosen = [clip(first)];
    let used = chosen[0]?.text.length ?? 0;
    const tail = [];
    for (let index = messages.length - 1; index > 0; index -= 1) {
        const message = messages[index];
        if (message === undefined)
            continue;
        const entry = clip(message);
        if (used + entry.text.length > budget)
            break;
        used += entry.text.length;
        tail.unshift(entry);
    }
    return [...chosen, ...tail];
}
