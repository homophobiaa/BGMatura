# Short-response grading rules

This document records which short responses BG Matura grades automatically and how
they are compared with the editor's accepted answers. It is the decision behind
issue #64; the grading service for it is issue #66.

The principle: **grade only when the comparison is reliable, and otherwise say so.**
There is no fuzzy matching, spelling correction, similarity score, or AI grading.

## Where the rules apply

A short-response question is graded automatically only when its server definition
(`ShortResponseDefinition`) has an `objective` assessment with at least one usable
accepted answer. Every other short-response question is never given a machine score:

| Question configuration | Result |
| --- | --- |
| `objective`, response matches an accepted answer | `scored`, full configured points |
| `objective`, response does not match | `scored`, 0 points |
| `objective`, response is empty after normalization | `scored`, 0 points |
| `objective`, response is ambiguous (see below) | `ungraded`, `not-auto-gradable` |
| `objective`, no usable accepted answers | `ungraded`, `answer-rules-unavailable` |
| `self-review` written assessment | `self-review` |
| `ungraded` written assessment | `ungraded`, `not-auto-gradable` |

Credit is all-or-nothing. There is no partial credit for short responses.

## Normalization

The same normalization is applied to the student's response **and** to every
accepted answer, in this order:

1. **Unicode form.** Decompose (NFD), apply step 2, then recompose (NFC), so that
   `й` stays one letter and visually identical inputs compare equal.
2. **Stress marks are ignored.** Combining grave and acute accents (U+0300, U+0301)
   are removed, so `ѝ` equals `и` and a stressed vowel equals the plain vowel.
   The breve in `й` is not a stress mark and is kept.
3. **Whitespace.** Any run of spaces, tabs, line breaks, or non-breaking spaces
   becomes one space, and leading and trailing whitespace is removed.
4. **Case.** Compared case-insensitively using the Bulgarian locale.
5. **Dashes.** Hyphen, non-breaking hyphen, en dash, em dash, and minus sign are
   treated as the same hyphen.
6. **Surrounding punctuation.** Punctuation and symbols at the very start or end
   are removed: a trailing full stop, quotes such as `„…“` or `«…»`, a trailing
   `!`, and so on. Punctuation **inside** the response is kept.

After normalization the response must equal an accepted answer **exactly**.

## What is deliberately not done

- **Spelling is not corrected or tolerated.** `съвършенство` and `съвършенсво`
  are different answers. Spelling is often exactly what a question tests, so a
  misspelling is incorrect, not forgiven.
- **No partial or "contains" matching.** `Иван Вазов е автор` does not match the
  accepted answer `Иван Вазов`. The editor must list that form if it is acceptable.
- **No word-order flexibility.** `Вазов Иван` does not match `Иван Вазов` unless
  both are listed.
- **Inner spacing around punctuation is not repaired.** `а - б` and `а-б` differ.

## Multiple accepted forms

The editor lists every acceptable form as its own accepted answer, for example
`Иван Вазов` and `Вазов, Иван`. A response is correct
when it equals **any** of them after normalization. Accepted answers that are
empty after normalization are ignored; if none remain, the question has no usable
rules and is reported as `answer-rules-unavailable`.

## Ambiguous responses are ungraded

Cyrillic and Latin share look-alike letters (`а`/`a`, `о`/`o`, `с`/`c`). A response
typed on the wrong keyboard layout looks right to a human but never matches.
Marking it wrong would be unfair, so:

> If the response contains Latin letters and **no** accepted answer contains Latin
> letters, the response is `ungraded` (`not-auto-gradable`) instead of incorrect.

If an accepted answer legitimately contains Latin letters (for example `Wi-Fi`),
Latin input is graded normally.

## Bulgarian examples

Accepted answer: `Иван Вазов`

| Student response | Outcome | Why |
| --- | --- | --- |
| `Иван Вазов` | correct | exact match |
| `  иван   вазов. ` | correct | whitespace, case, trailing full stop |
| `„Иван Вазов“` | correct | surrounding quotes removed |
| `Иван Вазов е` | incorrect | extra word, no "contains" matching |
| `Вазов Иван` | incorrect | word order differs |
| `Иван Вазоф` | incorrect | spelling is not forgiven |
| `Ivan Vazov` | ungraded | Latin letters, no Latin accepted answer |
| *(empty)* | incorrect, 0 points | missing response |

Accepted answers: `мѝ` and `северо-запад`

| Student response | Outcome | Why |
| --- | --- | --- |
| `ми` | correct | stress mark ignored |
| `Северо–запад` | correct | en dash equals hyphen |
| `северо запад` | incorrect | hyphen replaced by a space |

## Changing these rules

Any change to normalization or matching changes students' scores. Update this
document, the grading tests, and the grading service together.
