# UI Design Specification: MentorIA Escolar

## Three-Pillar Layout Architecture

### 1. Left Column: AI Orchestrator Chat (`id: orch-chat-pane`)
- **Width**: 25%
- **Function**: Entry point for all queries. The Orchestrator IA uses Prompt #11 to derive tasks.
- **Visuals**: Glassmorphism background, soft celeste borders.

### 2. Center Column: Learning Hub (`id: learning-hub-pane`)
- **Width**: 50%
- **Function**: Displays exercises, diagrams (Prompt #4), and student progress.
- **Visuals**: Clean white canvas, HSL `primary` (#2196F3) for call-to-actions.

### 3. Right Column: Specialist Sidebar (`id: specialist-pane`)
- **Width**: 25%
- **Function**: Direct access to:
    - **Tutor**: Academic support.
    - **Psychologist**: Mood tracking/support.
    - **Counselor**: Career/subject roadmap.
- **Visuals**: Vertical pill-shaped buttons with soft hover animations.

## Design Tokens
- **Primary Color**: `#2196F3` (Vibrant Blue)
- **Background**: `#E3F2FD` (Light Celeste)
- **Font**: Inter/Outfit (Rounded for kids)
