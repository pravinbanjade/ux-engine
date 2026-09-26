---
name: design-ui
description: Use when generating new UI in a repo that has a recorded design system — turns a stated intent into a reviewed wireframe and then into code, with a hard gate at the intent and an approval before any file is written.
---

# Generating UI against the recorded design system

Four stages, each gated. The gates are the point: a pipeline that can be
rushed produces the schema-shaped form this plugin exists to prevent.

The mechanical parts — validating the intent, validating the wireframe,
rendering it for review, scanning the diff, ranking findings — belong to
scripts. Your job is the part a script cannot do: hearing whether a question
was actually answered, and deciding whether a structure serves the answer.

## Stage 1 — Intent, and the hard gate

1. **Check the profile.**
   Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/check-profile.mjs <repo-root>`:
   - **0** — current. Continue.
   - **2** — stale. Show which sources changed, offer to re-run
     `/ux-design-system`. If the user declines, continue and say so at the end.
   - **3** — missing or invalid. Stop. Tell the user to run
     `/ux-design-system`. Do not guess at a design system.
   - **4** — the profile's schema is newer than this plugin. Stop and tell the
     user to update ux-engine.

   `DESIGN.md` is not required here. Generation reads the machine profile;
   repair is what needs the human record.

2. **Derive the slug** from the user's intent argument: lowercase, every run of
   non-alphanumerics becomes a hyphen, trimmed, truncated to 60 characters. If
   nothing survives, ask the user what to call this screen.

3. **If `.ux-engine/wireframes/<slug>.json` already exists**, read it, show the
   user what is stored, and ask: overwrite and start again, use a different
   slug, or resume from stage 3 with what is stored. Resuming keeps its
   `revisions` — that record belongs to the screen, not to the run.

4. **Read `references/intent-discovery.md`, then ask the five questions**, one
   at a time, reading each answer before asking the next. The reference names
   what a non-answer looks like for each question and what to ask instead.

5. **Write the stub and run the gate.** Write
   `.ux-engine/wireframes/<slug>.json` holding `version`, `slug` and the
   `intent` block, then run:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/check-wireframe.mjs \
     --wireframe <repo-root>/.ux-engine/wireframes/<slug>.json \
     --profile <repo-root>/.ux-engine/profile.json --intent-only
   ```

   Exit 2 names the keys that are still unanswered. Re-ask only those. **Do not
   dispatch anything until this exits 0.**

## Stage 2 — Wireframe

1. **Collect prior corrections.** Read the `revisions` notes from the other
   wireframes in `.ux-engine/wireframes/`, newest first, excluding this slug.

2. **Dispatch `ux-wireframer`** with the intent block, the profile path, the
   repository root, the slug, and those notes. It returns JSON only.

3. **Write it and validate it**, keeping the stub's `slug` and any stored
   `revisions`:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/check-wireframe.mjs \
     --wireframe <repo-root>/.ux-engine/wireframes/<slug>.json \
     --profile <repo-root>/.ux-engine/profile.json --root <repo-root>
   ```

   Exit 2 → re-dispatch **once**, passing the errors verbatim. A second failure
   stops: show the user the errors and the file path. Never a third attempt.

## Stage 3 — Review

1. **Show the rendered wireframe.** Read
   `references/states.md` first and check the four states against its bar —
   a reader should be able to tell what is on the screen without a follow-up
   question. If one does not clear it, fix it before showing the user; you are
   the first reviewer, not a courier.

   Then check that the data exists. For each thing the wireframe shows,
   such as a count, a breakdown or a column, find where the UI would get
   it: the API client, the endpoint, the schema. Anything that is not there
   goes into the review as a line of its own, naming what is missing and
   what would have to change to provide it, and the user approves knowing
   it. A wireframe promising a per-page breakdown of signups, over a
   subscriber table that records no page, was approved and then stopped
   at implementation. It should have been said here.

2. **Get approval before any code is written.** This gate does not move.

3. **When the user asks for a change, decide which kind it is:**

   | Kind | Examples | What you do |
   | --- | --- | --- |
   | **Local** | rewording a state, renaming a region, correcting a component path, adding one leaf | Edit the JSON, re-render, re-validate. No re-dispatch. |
   | **Structural** | the hierarchy is wrong, a whole region is missing or does not belong, the wrong components were chosen, the layout does not fit the intent | Re-dispatch the wireframer **once** with the intent, the rejected wireframe and the user's reason verbatim. |

   The test: does the correction change what the wireframer **concluded**, or
   only how it **wrote it down**? A reworded state is its prose. An inverted
   hierarchy is its reasoning, and hand-patching that hides the mistake from
   every future run.

4. **Record the correction** either way. Append to `revisions`:
   `{"at": "<ISO 8601 now>", "kind": "edit" | "redispatch", "note": "<the
   user's reason>"}`. This is what the next run's stage 2 reads.

5. A second structural rejection stops the loop: give the user the file path
   and offer to apply their edits directly.

## Stage 4 — Implement, then enforce

1. **Write the code** against `profile.conventions` — framework, router, icon
   set, accessibility target — and `profile.tokens`. Tokens, not literals: an
   off-system value you write here is a finding the enforcer will hand back to
   you in the next step.

   Stay inside the package that holds the UI, which is the one containing
   `profile.components.dir`. If the approved design needs a change anywhere
   else, stop before writing it and ask. That covers a new API parameter, a
   schema field or a server route. Name the file, the change, and what the
   UI can and cannot do without it. The user asked for a screen, and a
   change to their API is a separate decision with its own review. If they
   decline, build the best version the current API supports, and say which
   part of the wireframe it falls short of.

2. **Build every state the wireframe describes.** A described state with no
   branch is UX-111, and it is the highest-severity thing this pipeline can
   produce, because the reviewer already agreed it was handled.

3. **Dispatch `ux-system-enforcer`** with the diff scope, the profile path and
   the wireframe path. It returns findings rows.

4. **Report.** Run:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/report-findings.mjs \
     --scanner <scan.json> --model <enforcer.json> \
     --profile <repo-root>/.ux-engine/profile.json \
     --design <repo-root>/DESIGN.md --root <repo-root> \
     --scope diff --base <ref>
   ```

   If it exits 4, the enforcer's rows were malformed — fix the rows it named
   and run it again.

5. **One repair loop.** Any finding at `high` goes back to step 1 of this
   stage, once. If a `high` survives the second pass, stop and show the user
   the report. Do not loop a third time.

## What not to do

- Do not skip the intent gate because the request sounded specific. A detailed
  feature description is not the same as knowing who uses it at what cadence.
- Do not write code before the user approves the wireframe. Not a sketch, not
  a scaffold, not "just the component shell".
- Do not hand-patch a structural correction into the JSON. That is the one
  thing that guarantees the same mistake next run.
- Do not invent a mode id. Every finding cites an id that exists in the index.
- Do not write anywhere outside `.ux-engine/wireframes/` and the source files
  the user approved.
