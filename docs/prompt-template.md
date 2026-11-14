# Prompt template: cards from lecture slides

**English** · [Deutsch](prompt-vorlage.md)

With this template an AI chat (e.g. Claude or ChatGPT) turns your slides into a CSV file that Karteikasten imports directly. You also get an outline for the subject tree.

The template is tuned to the app's answer checking: key terms are marked, translations sit in brackets, and enumerations are split into small cards. This makes the app check your typed answers more accurately.

## How to use it

1. Open a new chat and attach the slides as a PDF. For very long slide decks, better one chapter per chat.
2. Copy the prompt below, paste it into the chat and send it.
3. Copy the CSV block from the answer. In Karteikasten click **"Paste text"**, paste, check, import. Or save it as a `.csv` file and drop it onto the app.
4. Copy the outline block. On the subject choose **"Edit"** → **"Paste as text"** and paste it.
5. Look through the cards once. You know the lecture, the AI doesn't. Under **"Cards"** on the deck you can correct everything, also later while studying with the `E` key.

The AI can get content wrong or add things that are not on the slides. The template forbids this, but that is no guarantee. Check numbers, years and author names in particular.

## The prompt

You can adjust the part in square brackets. The prompt asks for English cards; for German cards use the [German version](prompt-vorlage.md).

```text
You create study cards from the attached lecture slides for a flashcard app.
Course: [name of the lecture]. The cards should prepare for the exam.

CONTENT
- Only content from the slides. Don't make anything up. If a slide is unclear, leave it out.
- Exactly one idea per card: one definition, one model, one distinction, one relationship.
- Split enumerations with more than 4 points: one card asks for the number and the names,
  further cards ask about single points.
- No cards about organisational slides (dates, reading list, agenda slides).
- About one card per content slide, at most 40 cards.

FRONT
- A clear question that makes sense without the slide.
- If the question belongs to a model, author or concept, its name comes first with a colon,
  e.g. "Porter: Which five forces determine how attractive an industry is?"
- Always use the same name for models and concepts as in the outline below.

BACK
- Short and complete, at most 3 sentences, in your own words instead of slide text.
- In every longer answer, mark 2 to 5 key terms with **double asterisks**.
  Only mark terms that a good answer must contain.
- If a key term is in another language than the card, put the translation in brackets right after it:
  **Reichweite** (scope). Both then count as correct.
- No other brackets. Introduce examples with "e.g." and sources with "cf.".
- If the answer is just a term or a number (up to about 60 characters), no asterisks.
  Commas only if several answers are equally correct ("house, building").

FORMAT
Answer with exactly two code blocks and nothing else.

Block 1: CSV
- First line: Front;Back
- The delimiter is the semicolon.
- Every field is in double quotes. Quotes inside the text are doubled ("").
- One card per line, no line breaks inside a field.

Block 2: Outline
- First line: name of the lecture, without a dash.
- Below it the chapters as a list with "- ", sub-points indented by 2 spaces, at most 3 levels.
- Short names that also appear in the cards (e.g. "Porter's Five Forces", not "Understanding competition").

Example of a line in block 1:
"Porter: What does the Five Forces model describe?";"It explains how **attractive** an industry is through five **competitive forces**, e.g. the **bargaining power** of suppliers."
```

## Why the rules are like this

- **Name with a colon first:** the app assigns each card to the branch of the subject tree whose terms it mentions most. The part before the colon counts double.
- **Marked key terms:** if terms are marked, the app only counts those. Without marks it picks up to 7 terms itself, and those aren't always the right ones.
- **Translation in brackets:** a bracket right after a marked term counts as an equally valid answer. That's why other brackets should be left out.
- **Commas in short answers:** for short answers the app reads comma, semicolon, slash and "or" as "one of these is enough".
- **One idea per card:** long cards quickly become problem cards that you keep forgetting.
- **Quotes in the CSV:** this way a semicolon in an answer stays part of the text.
