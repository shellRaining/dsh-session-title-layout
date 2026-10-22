/**
 * Session-title provider that asks the model for the meaningful parts of a
 * title (an optional `type` and a plain-language `summary`) and assembles them
 * with the segments, separator and date format the user configured.
 *
 * When the model reply is unusable the call throws, and the session service
 * keeps whatever title it already has.
 */
import type { Context } from "@deepseek-ai/cordis";
import { type Config } from "./format.ts";
export type { Config } from "./format.ts";
export declare const name = "session-title-layout";
export declare const inject: string[];
export declare function apply(ctx: Context, rawConfig?: Config): void;
