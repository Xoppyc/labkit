# labkit

Opinionated Node.js CLI for university lab workflows — built so both humans and AI coding agents can extract assignments, compile Markdown reports into styled `.docx` templates, bulk-patch/verify reports, and render clean Linux terminal screenshots without writing ad-hoc Python scripts.

## Requirements

- **Node.js** `>= 18` (`node -v`)
- **npm** (`npm -v`)
- *(Optional)* **ImageMagick** (`convert`) — only needed if a `.docx` assignment contains legacy `.wmf` formula images that need auto-conversion to `.png`.

---

## Quick Install (Human or AI Agent)

Clone the repository and run the setup commands below:

```bash
git clone https://github.com/Xoppyc/labkit.git ~/Dev/labkit
cd ~/Dev/labkit
npm install
chmod +x bin/labkit.js
mkdir -p ~/.local/bin
ln -sf "$(pwd)/bin/labkit.js" ~/.local/bin/labkit
```

### Add `~/.local/bin` to `PATH`

Check if `labkit` is already available:

```bash
which labkit && labkit --version
```

If you get `command not found`, add `~/.local/bin` to your shell `PATH`:

**Bash (`~/.bashrc`):**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Zsh (`~/.zshrc`):**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Fish (`~/.config/fish/config.fish`):**
```fish
fish_add_path ~/.local/bin
```

**Alternative (npm global link, works on Linux/macOS/Windows):**
```bash
cd ~/Dev/labkit
npm link
```

Verify installation:
```bash
labkit --help
```

---

## Agent Setup (Install `SKILL.md`)

To let your AI agent automatically discover and use `labkit` in every conversation, symlink `SKILL.md` into your agent's global skills folder:

**Antigravity:**
```bash
mkdir -p ~/.gemini/config/skills/labkit
ln -sf "$(pwd)/SKILL.md" ~/.gemini/config/skills/labkit/SKILL.md
```

**Claude Code / Cursor / other agents:**
Point your agent to `SKILL.md` in this repo (or copy it into `.claude/skills/labkit/SKILL.md` or `.cursor/rules/`).

### Prompt for Your Roommate's Agent

If you just want an AI agent to set everything up automatically, paste this prompt:

> Clone `https://github.com/Xoppyc/labkit` into `~/Dev/labkit`, follow the Quick Install and Agent Setup instructions in `README.md`, verify `labkit --help` works on `PATH`, and read `SKILL.md` so you know how to use it for my labs.

---

## Usage

### 1. Read `.docx` / `.pdf` Assignments

```bash
# Extract full .docx text + Markdown tables + embedded images (auto-converts .wmf -> .png)
labkit read docx assignment.docx --out assignment.md --images ./imgs

# Extract only your variant row from assignment tables (handles merged cells & formula images)
labkit read docx assignment.docx --variant 9 --images ./imgs

# Extract text from PDF
labkit read pdf reference.pdf --out reference.txt
```

### 2. Compile Markdown into a Styled `.docx` Report

Write a compact Markdown file (`report.md`) with YAML frontmatter:

```markdown
---
lab: 7
title: Дискретне перетворення Фур'є
topic: Пряме та обернене ДПФ (Варіант 9)
goal: вивчити теорію ДПФ та реалізувати перетворення.
teacher: Прізвище І. Б.
group: ФЕП-31с
student: Ім'я Прізвище
repo: https://github.com/username/repo/tree/main/lab7
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

![Рис. 7.1. Спектр ДПФ](./plots/spectrum.png)
```

Build the `.docx`:

```bash
# Uses the bundled default LNU template
labkit report build report.md -o Звіт_Лабораторна_робота_7.docx

# Or pass your own custom .docx template
labkit report build report.md -t ./my-template.docx -o out.docx
```

### 3. Bulk Patch & Verify Reports

```bash
# Replace text across all .docx files in a directory
labkit report patch ./reports/ --find "[ПІБ викладача]" --replace "Прізвище І. Б."

# Audit image counts, table counts, file sizes, and leftover placeholders
labkit report verify ./reports/
```

### 4. Render Linux Terminal Screenshots

```bash
# Run a command and render its output as a crisp Linux/GNOME terminal PNG
labkit snap --cmd "python3 -m unittest tests.py" --title "Terminal - tests" -o screenshot.png

# Or render literal text
labkit snap --text "[PASS] All 4 tests passed" --title "Terminal" -o screenshot.png
```

---

## Customization

Everything is plain ES Modules (`"type": "module"`) with no build step — edit any file and run `labkit` immediately:

- `src/lib/docxXml.js` — fonts, sizes, code-block colors/borders, table styling.
- `src/commands/reportBuild.js` — frontmatter-to-template placeholder mapping.
- `src/commands/snap.js` — terminal colors, font, window bar layout.
- `src/templates/lnu-default.docx` — default report template.
