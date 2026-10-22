# dsh-session-title-layout

English | [简体中文](README.zh.md)

A session-title provider for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). It asks a model for the meaningful parts of a title and assembles them into a layout you choose, for example:

```text
feat: add dark mode to settings
feat：给设置页增加深色模式
feat/261022/add dark mode to settings
add dark mode to settings
```

A title is built from up to three segments:

| Segment | Written by | Notes |
|---|---|---|
| `type` | the model | One of an allowed list (`feat`, `fix`, ...). |
| `date` | this plugin | Formatted locally; the model never sees it. |
| `summary` | the model | Plain text, not slugified, in the language you ask for. |

Only the segments you use are requested from the model.

## Requirements

- dsh `>=0.2.1-rc.2 <0.3.0`
- Node.js 20 or newer

dsh allows a single asynchronous title provider at a time. This package's bundle disables the shipped `session-title-llm` row; do not enable another provider (for example the all-prompts bundle) alongside it.

## Install

Through the Plugins page, or by asking an agent to run `plugin_manager` `install_bundle` with:

```text
git+https://github.com/shellRaining/dsh-session-title-layout.git
```

Installing the bundle inserts a row with default configuration (`conventional` layout). To configure it, override the row in your profile's `cordis.patch.yml`:

```yaml
- id: session-title-layout
  config:
    preset: type-summary
    separator: ": "
    summaryLanguage: English
    automatic: all-prompts
```

If you load the plugin by path instead of installing the bundle, insert the row yourself and point `name` at `lib/index.js`; do not do both, or the row id collides.

Changing the installed package code needs a dsh restart. Configuration changes follow the profile's patch reload mode.

## Configuration

Every field is optional.

| Field | Default | Meaning |
|---|---|---|
| `preset` | `conventional` | `conventional` is `type/date/summary` joined by `/`, `type-summary` is `type/summary` joined by `/`, `summary` is the summary alone. |
| `segments` | from preset | Ordered list of `type`, `date`, `summary`. Must contain `summary`, no repeats. |
| `separator` | from preset | Text placed between segments, such as `": "` or `"："`. |
| `types` | `feat, fix, refactor, docs, chore, style, test, perf, build, ci, revert` | Allowed values of `type`. Matched case-insensitively. |
| `dateFormat` | `YYMMDD` | Tokens `YYYY`, `YY`, `MM`, `DD`, in local time. |
| `dateSource` | `session-created` | `session-created` keeps the date stable when titles regenerate; `now` uses the generation time. |
| `summaryMaxLength` | `40` | Maximum characters of the summary, requested from the model and enforced on the result. |
| `summaryLanguage` | the user's language | Language of the summary, for example `中文` or `English`. |
| `automatic` | `first-prompt` | `first-prompt` titles once; `all-prompts` regenerates as new prompts arrive. |
| `provider`, `model` | the session's main route | Auxiliary model for titles. Set both or neither. |
| `maxInputChars` | `8000` | Budget of user text sent to the model: the first message plus the newest ones that fit, each clipped to 2000 characters. |
| `maxOutputTokens` | `2048` | Output-token cap of the title request. |
| `timeoutMs` | `60000` | Deadline of the title request. |

Invalid configuration fails when the plugin activates, with a message naming the field.

## Behavior

- If the model reply cannot be used (no JSON, no summary, or a `type` outside the allowed list), the call fails and the session keeps its current title. Nothing is guessed.
- A layout change only affects titles generated afterwards. Existing titles are stored as plain text in the session log and are not rewritten.
- Titles still pass through dsh's own normalization and byte limit.

## Privacy

Your prompts are sent to the configured model route to produce the title. With `all-prompts`, that happens on every new prompt. Point `provider` and `model` at a route you are comfortable sending prompts to.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build   # writes lib/, which is committed so git installs work without a build
```

The pure logic (configuration, prompt, parsing, rendering) is in `src/format.ts`; `src/index.ts` only wires it to dsh.

## License

[MIT](LICENSE)
