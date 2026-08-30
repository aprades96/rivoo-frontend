<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tests driven by React Query can pass without testing anything

A test that seeds/pushes data into the query cache and then asserts **synchronously**
passes regardless of the code under test. `notifyManager` schedules observer
notification on a **macrotask** (`systemSetTimeoutZero` in
`node_modules/@tanstack/query-core/src/notifyManager.ts`), so the component never
re-renders before the assertion. `await act(async () => {})` drains microtasks only
and provably cannot flush it — it produces the same false green.

This has already happened here: a regression test written in the ordinary shape passed
with the bug fully reintroduced. It was caught only by mutating the source and finding
the test still green.

**Rule:** in any test that simulates a refetch, first `await findBy*` on something the
component under test does **not** own, to prove the data landed. Only then assert on the
value you care about. Prefer driving the component through props or a mocked hook when
you can — those are synchronous and immune.

Also: pushing a deeply-equal payload proves nothing either. `structuralSharing` is on by
default, so an equal payload hands back the *same* object and an identity bug never fires.
Change a field.

# Every test runs as MOBILE unless it says otherwise

`src/test/setup.ts` polyfills `matchMedia` returning `matches: false` **always**. Since
this repo decides width differences by conditional mounting in JS (never `hidden lg:*`),
that default means **a test that does not call `mockMatchMedia(true)` exercises the mobile
branch only** — and the desktop branch is not covered at all.

This has already happened here: on the "Hoy" screen, four desktop-only pieces could be
deleted — including a card that exists **only** on desktop — with all 1009 tests still
green. The suite looked healthy and half the screen was untested.

**Rule:** when a component branches on width, count coverage **per branch**, not per file.
Every desktop assertion needs its own `mockMatchMedia(true)` **and** an `afterEach` that
restores it. The only trustworthy check is to mutate the branch and confirm a test falls.

# A Tailwind v4 token missing from `@theme inline` vanishes without a word

Declaring `--foo: #hex` in `:root` is **not enough**. If it is not also mapped in the
`@theme inline` block of `src/app/globals.css`, the utility (`bg-foo`) is never generated:
no build error, no warning, no console message — just an element with no background.

**Rule:** every new token goes in **both** places, and the check is to grep the generated
CSS in `.next/` for the class, not to eyeball the declaration.

# `tailwind-merge` silently deletes a `leading-*` written before a `text-[Npx]`

Measured in this repo: `twMerge("text-sm leading-tight font-semibold text-[15px]")` returns
`"font-semibold text-[15px]"` — the `leading-tight` is gone. It treats them as the same
group, and the arbitrary font size wins the whole pair.

This compounds with Tailwind's preflight, which imposes `line-height: 1.5` while the
artboards declare none (~1.25): **every `text-[Npx]` needs its own explicit `leading-*`,
written AFTER it.**

# `vitest.config.ts` pins `TZ` on purpose — do not remove it

Without the pin, tests run in the runner's zone. Any assertion about date-range conversion
then **passes in CI (UTC) with the implementation broken**, because a UTC-fixed offset and
a local-midnight conversion agree when local == UTC.

This has already happened here: mutating the conversion to a fixed `Z` offset failed on a
Madrid machine and passed clean under `TZ=UTC` — in the one file guarding the fix that a
whole block existed to deliver.
