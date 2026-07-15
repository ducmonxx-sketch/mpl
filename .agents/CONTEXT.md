# Antigravity Workspace Context

## 🛠️ Tech Stack & Architecture
- **Framework & Tooling:** React, Vite (Single-page landing page & dashboard apps)
- **Architecture:** Monorepo structure managed via active workspaces
- **Styling & UI Components:** Tailwind CSS, Shadcn UI

## 🎨 Active Agentic Skillmaps & Reference Files
This workspace uses a prioritized chain of skills. The agent must pass all generated code through these specific playbooks mapped from your `.agents/skills/` directory tree:

1. **System & Layout Structure:** `./.agents/skills/frontend-design/SKILL.md` -> `./.agents/skills/frontend-dev-guidelines/SKILL.md` -> `./.agents/skills/senior-frontend/SKILL.md`
2. **Visual, UI Elements & Motion:** `./.agents/skills/ui-ux-pro-max/SKILL.md` -> `./.agents/skills/ui-ux-designer/SKILL.md` -> `./.agents/skills/antigravity-design-expert/SKILL.md` -> `./.agents/skills/animejs-animation/SKILL.md`
3. **Design Token Rules:** Refer strictly to the design palette defined in `./.agents/color.md`
4. **Validation, QA & Compliance:** `./.agents/skills/ui-visual-validator/SKILL.md` -> `./.agents/skills/seo-audit/SKILL.md`

---

## 💎 Project Redesign & Branding Rules

### 1. Brand Identity & Color Token Strict Compliance
When redesigning layout components or editing the dashboard interface, the agent must strictly apply the core palettes declared in `./.agents/color.md`:
- **Landing Page (Tailwind):** Follow the precise balance of **Primary Navy (`#1b3b5f`)** and **Background Dark (`#13191f`)**, using the high-impact **Secondary Gold (`#f2b824`)** strictly for call-to-actions, highlights, and critical buttons.
- **Dashboard View (CSS Variables):** Custom interactive dashboard items must explicitly map to the dark navy and bright gold tokens (`--dash-primary` and `--dash-secondary`).

### 2. Styling, Components & Animation Standards
- **Component Design:** Modular, highly atomic React components utilizing clean Radix primitives via `shadcn`. Ensure 100% fluid, responsive, mobile-first design system integration.
- **Motion & Interactivity:** Use `antigravity-design-expert` and `animejs-animation` for high-end micro-interactions, scroll-linked transitions, and smooth entrance states. Keep animations sophisticated, fast, and premium—never distracting.
- **Utility Constraints:** Never write loose arbitrary Tailwind values or random inline hex values. Always cross-reference class layouts with the tokens explicitly established in your configuration.

### 3. Verification & SEO Gates
- **Visual Validation:** Use the rules in `ui-visual-validator` to guarantee pixel-perfect translation from UI layouts, ensuring layout alignment and element padding match production design standards.
- **SEO Hierarchy:** Enforce strict semantic HTML layout rules using the `seo-audit` playbook (exactly one `<h1>` per view, clean sequential header trees, descriptive image alt tokens).