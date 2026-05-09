// ═══════════════════════════════════════════════════════════════════
// VENDOR CATEGORIES
//
// To add a new category:
//   1. Copy any block below (from the opening { to the closing },)
//   2. Paste it before the closing ] of the CATEGORIES array
//   3. Change the id, label, description, and color
//   4. Save the file — that's it. The new category appears everywhere.
//
// Color tips: use a hex color that feels distinct from the others.
// The id must be lowercase with underscores only (no spaces).
// ═══════════════════════════════════════════════════════════════════

export const CATEGORIES = [

  // ─── Nursery ──────────────────────────────────────────────────
  {
    id: 'nursery',
    label: 'Nursery',
    description: 'General plant nurseries and retail garden suppliers',
    color: '#3d6b4a',
  },

  // ─── Rare Plants ──────────────────────────────────────────────
  {
    id: 'rare_plants',
    label: 'Rare Plants',
    description: 'Specialty vendors for rare, exotic, and collector plants',
    color: '#7c4a2a',
  },

  // ─── Testing & Analysis ───────────────────────────────────────
  {
    id: 'testing_analysis',
    label: 'Testing & Analysis',
    description: 'Lab testing, soil analysis, water quality, plant diagnostics',
    color: '#2a4a7c',
  },

  // ─── ADD NEW CATEGORIES ABOVE THIS LINE ───────────────────────
  // Example of a new category — uncomment and modify to use:
  //
  // {
  //   id: 'tools_equipment',
  //   label: 'Tools & Equipment',
  //   description: 'Farming tools, irrigation systems, greenhouse supplies',
  //   color: '#5a5a3a',
  // },

]


// ═══════════════════════════════════════════════════════════════════
// RATING DIMENSIONS
//
// To add a new rating dimension:
//   1. Copy any block below
//   2. Paste it before the closing ] of the RATING_DIMS array
//   3. Change the id and label
//   4. Save — the new dimension appears on all review forms and cards.
//
// The id must be lowercase with underscores only.
// ═══════════════════════════════════════════════════════════════════

export const RATING_DIMS = [

  // ─── Product / Service Quality ────────────────────────────────
  {
    id: 'quality',
    label: 'Product / Service Quality',
    hint: 'Did the product or service meet expectations?',
  },

  // ─── Delivery & Reliability ───────────────────────────────────
  {
    id: 'delivery',
    label: 'Delivery & Reliability',
    hint: 'On time, as promised, consistent?',
  },

  // ─── Pricing & Value ──────────────────────────────────────────
  {
    id: 'pricing',
    label: 'Pricing & Value',
    hint: 'Fair price for what was delivered?',
  },

  // ─── Communication ────────────────────────────────────────────
  {
    id: 'communication',
    label: 'Communication',
    hint: 'Responsive, clear, and honest?',
  },

  // ─── Business Ethics ──────────────────────────────────────────
  {
    id: 'ethics',
    label: 'Business Ethics',
    hint: 'Transparent, fair, no shady practices?',
  },

  // ─── ADD NEW DIMENSIONS ABOVE THIS LINE ───────────────────────

]
