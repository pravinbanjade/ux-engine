# Intent discovery

Five questions. Ask them one at a time and read the answer before asking the
next one — the second question is often already half-answered by the first,
and asking it anyway signals you were not listening.

The validator behind this stage checks only that each field was filled in.
Everything on this page is the part it cannot check.

## `who` — Who uses this, and what do they already know when they arrive?

A real population with a starting state of knowledge.

| Not an answer | Why | Ask instead |
| --- | --- | --- |
| "Users" | Every screen has users. | "Is this for someone inside the company or outside it?" |
| "Admins and regular users" | Two populations is two screens until proven otherwise. | "Which of the two is this screen mainly for?" |
| "Anyone who needs a report" | Describes eligibility, not the person. | "Who ran the last one of these by hand?" |

What the answer changes: how much explanation the screen carries, whether
terms can be used bare or need definition, and whether the empty state can
assume the user knows what to do next.

## `cadence` — How often: once ever, daily, or many times an hour?

| Not an answer | Why | Ask instead |
| --- | --- | --- |
| "As often as needed" | True of everything. | "Would a regular user see this more than once a day?" |
| "Depends on the user" | Two cadences is two designs; pick the dominant one. | "Which pattern is most of the traffic?" |

What the answer changes: density, whether the primary action needs a keyboard
path, whether confirmation is worth its friction, and whether onboarding
affordances should persist or fade.

## `primaryAction` — What is the single action that matters most here?

Singular. If two actions come back, ask which one the screen would be
pointless without.

| Not an answer | Why | Ask instead |
| --- | --- | --- |
| "View the data" | Looking is not an action. | "After they have looked, what do they do?" |
| "Create, edit and delete" | A list of verbs is the data model, not an intent. | "Which of those three happens most?" |

What the answer changes: rank 1 in the hierarchy, and therefore the whole
visual weighting of the screen.

## `failure` — What happens when it fails, and who notices?

| Not an answer | Why | Ask instead |
| --- | --- | --- |
| "An error is shown" | Restates that errors exist. | "If this call fails at 9am, what goes wrong for the person?" |
| "It retries" | Describes the system, not the consequence. | "Who finds out, and how long does it take them?" |

What the answer changes: whether the error state is a quiet inline note or a
blocking message, whether a retry has to preserve state, and how specific the
message must be.

## `scale` — What does the data look like at its realistic maximum?

A number, or a range with a shape.

| Not an answer | Why | Ask instead |
| --- | --- | --- |
| "It varies" | Every collection varies. | "What is the worst case you have actually seen?" |
| "A lot" | Ten thousand and forty are both a lot and need different screens. | "Roughly ten, a hundred, or a thousand?" |

What the answer changes: pagination, virtualisation, filtering, whether the
populated state is a table or a list, and whether sorting is worth building.

## When to stop asking

Stop when you can state, in one sentence and without hedging, what the screen
is for and who loses if it is wrong. If you cannot, the missing sentence names
the question still to ask.

Do not turn this into an interrogation. Five questions asked well is the
budget; a sixth is warranted only when an answer contradicted an earlier one.
