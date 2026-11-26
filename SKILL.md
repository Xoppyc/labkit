---
name: labkit
description: Opinionated Node.js CLI (`labkit`) for university lab workflows — extracting .docx/.pdf assignments, compiling Markdown reports into styled .docx templates, bulk-patching/verifying reports, and rendering Linux terminal screenshots. Use instead of writing ad-hoc python-docx/pypdf/PIL scripts.
---

# labkit — University Lab Automation CLI

Use `labkit` (installed on `PATH` at `~/.local/bin/labkit`) instead of writing inline `python3 -c` scripts for `.docx`, `.pdf`, or terminal screenshot tasks.

> Note: If running inside a Flatpak sandbox where `node` is only on the host, invoke via `flatpak-spawn --host labkit ...`.

## 1. Reading Assignments (`labkit read`)

- Extract full `.docx` text + Markdown tables + embedded images (auto-converts `.wmf` equations to `.png`):
  ```bash
  labkit read docx "/path/to/lab.docx" --out /tmp/lab.md --images /tmp/lab_imgs
  ```
- Extract only a specific variant row from tables:
  ```bash
  labkit read docx "/path/to/lab.docx" --variant 9 --images /tmp/lab_imgs
  ```
- Extract text from a `.pdf`:
  ```bash
  labkit read pdf "/path/to/lab.pdf" --out /tmp/lab.txt
  ```

## 2. Building `.docx` Reports from Markdown (`labkit report build`)

Write a compact Markdown file with YAML frontmatter, then compile it in one call:

```markdown
---
lab: 7
title: Дискретне перетворення Фур'є
topic: Пряме та обернене ДПФ (Варіант 9)
goal: вивчити теорію ДПФ та реалізувати перетворення.
teacher: Половинко І. І.
group: ФЕП-31с
student: Кириченко Артем
repo: https://github.com/Xoppyc/dip-labs/tree/main/lab7
---

## 1. Постановка задачі
Звичайний абзац з **жирним** та `inline code`.

```python Лістинг 7.1. Пряме ДПФ
def dft(x):
    ...
```

| Параметр | Значення |
| --- | --- |
| Період T | 20.01 |

![Рис. 7.1. Спектр ДПФ](/abs/or/relative/path/to/plot.png)
```

Compile to `.docx` (uses bundled LNU template by default, or pass `-t custom.docx`):

```bash
labkit report build /tmp/lab7.md -o /path/to/Звіт_Лабораторна_робота_7.docx
```

## 3. Patching & Auditing Reports

- Bulk replace text across all `.docx` files in a folder:
  ```bash
  labkit report patch /path/to/reports/ --find "[ПІБ викладача]" --replace "Половинко І. І."
  ```
- Audit images, tables, file sizes, and leftover placeholders (`Фамілія`, `[ПІБ...]`, `№0`):
  ```bash
  labkit report verify /path/to/reports/
  ```

## 4. Terminal Screenshots (`labkit snap`)

Render a crisp vector Linux/GNOME terminal PNG (no macOS traffic lights, symmetric close button):

```bash
labkit snap --cmd "python3 -m unittest tests.py" --title "Terminal - lab7" -o /path/to/test_out.png
```
