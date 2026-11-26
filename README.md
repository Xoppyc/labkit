# labkit

Opinionated Node.js CLI for university lab workflows:
- Extract text, Markdown tables, and embedded images (+ auto `.wmf -> .png`) from `.docx` and `.pdf` lab instructions.
- Compile structured Markdown (with YAML frontmatter) directly into styled `.docx` reports using any custom `.docx` template (or the bundled LNU template).
- Bulk find-and-replace and audit `.docx` reports.
- Render crisp vector Linux/GNOME terminal screenshots (`SVG -> PNG`).

## Install

```bash
npm install
chmod +x bin/labkit.js
ln -sf "$(pwd)/bin/labkit.js" ~/.local/bin/labkit
```

## Commands

```bash
# 1. Read assignments
labkit read docx assignment.docx --out assignment.md --images ./imgs
labkit read docx assignment.docx --variant 9 --images ./imgs
labkit read pdf reference.pdf --max-chars 4000

# 2. Build a .docx report from Markdown
labkit report build report.md -o out.docx
labkit report build report.md -t custom_template.docx -o out.docx

# 3. Bulk patch & verify reports
labkit report patch ./reports/ --find "[ПІБ викладача]" --replace "Половинко І. І."
labkit report verify ./reports/

# 4. Render Linux terminal screenshot
labkit snap --cmd "python3 tests.py" --title "Terminal - tests" -o screenshot.png
```
