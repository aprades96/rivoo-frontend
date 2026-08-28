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
