/**
 * Pure title-format logic: configuration, preset expansion, the model prompt,
 * model-output parsing, and rendering. Nothing here touches the Harness, so it
 * is unit-testable without a Cordis context.
 */
/** Parts a title can be assembled from. `summary` is the only mandatory one. */
export declare const SEGMENTS: readonly ["type", "date", "summary"];
export type Segment = (typeof SEGMENTS)[number];
/** Built-in layouts. A preset only supplies defaults for `segments` and `separator`. */
export declare const PRESETS: {
    /** `feat/261022/add login flow` */
    readonly conventional: {
        readonly segments: readonly ["type", "date", "summary"];
        readonly separator: "/";
    };
    /** `feat/add login flow` */
    readonly "type-summary": {
        readonly segments: readonly ["type", "summary"];
        readonly separator: "/";
    };
    /** `add login flow` */
    readonly summary: {
        readonly segments: readonly ["summary"];
        readonly separator: " ";
    };
};
export type PresetName = keyof typeof PRESETS;
export declare const DEFAULT_TYPES: readonly string[];
export type DateSource = "session-created" | "now";
export type AutomaticMode = "first-prompt" | "all-prompts";
/** User-facing plugin configuration; every field is optional. */
export interface Config {
    /** Layout defaults. Default `conventional`. */
    preset?: PresetName;
    /** Explicit segment order; overrides the preset. Must contain `summary`. */
    segments?: Segment[];
    /** Text placed between segments; overrides the preset. */
    separator?: string;
    /** Allowed values of the `type` segment. Ignored when `type` is not a segment. */
    types?: string[];
    /** Tokens: YYYY YY MM DD. Default `YYMMDD`. Ignored when `date` is not a segment. */
    dateFormat?: string;
    /** Which instant `date` shows. `session-created` keeps it stable across regenerations. */
    dateSource?: DateSource;
    /** Soft cap, in characters, requested for the summary and enforced on the result. */
    summaryMaxLength?: number;
    /** Language the summary is written in, e.g. `中文` or `English`. Default: the language the user wrote in. */
    summaryLanguage?: string;
    /** When new prompts trigger regeneration. */
    automatic?: AutomaticMode;
    /** Auxiliary model route; both or neither. Default: the session's main route. */
    provider?: string;
    model?: string;
    /** Budget, in characters, of user text sent to the model. */
    maxInputChars?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
}
export interface ResolvedConfig {
    readonly segments: readonly Segment[];
    readonly separator: string;
    readonly types: readonly string[];
    readonly dateFormat: string;
    readonly dateSource: DateSource;
    readonly summaryMaxLength: number;
    readonly summaryLanguage: string | undefined;
    readonly automatic: AutomaticMode;
    readonly route: {
        readonly provider: string;
        readonly model: string;
    } | undefined;
    readonly maxInputChars: number;
    readonly maxOutputTokens: number;
    readonly timeoutMs: number;
}
/** Validate user configuration and expand the preset. Throws on any invalid field. */
export declare function resolveConfig(config?: Config): ResolvedConfig;
/** System prompt asking only for the model-written segments (`type`, `summary`). */
export declare function buildSystemPrompt(config: ResolvedConfig): string;
/** The model-written parts of a title. */
export interface ModelParts {
    readonly type: string | undefined;
    readonly summary: string;
}
/**
 * Parse the model reply. Throws when it is unusable, so the caller keeps the
 * previous title instead of writing a guess.
 */
export declare function parseModelOutput(raw: string, config: ResolvedConfig): ModelParts;
/** Format an epoch-millisecond instant in local time using YYYY, YY, MM, DD tokens. */
export declare function formatDate(epochMs: number, format: string): string;
/** Join the enabled segments in configured order. `date` is rendered by the caller's clock. */
export declare function renderTitle(parts: ModelParts, dateText: string, config: ResolvedConfig): string;
/**
 * Choose which messages to send: the first one, then the newest that fit the
 * character budget. Returned in log order.
 */
export declare function selectMessages<T extends {
    readonly text: string;
}>(messages: readonly T[], budget: number, perMessageLimit?: number): {
    message: T;
    text: string;
}[];
