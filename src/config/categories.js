// ═══════════════════════════════════════════════════════════════════
// VENDOR CATEGORIES
//
// To add a new category:
//   1. Copy any block below (from the opening { to the closing },)
//   2. Paste it before the closing ] of the CATEGORIES array
//   3. Change the id, label, description, and color
//   4. Save — it appears everywhere automatically.
//
// The id must be lowercase with underscores only (no spaces).
// ═══════════════════════════════════════════════════════════════════

export const CATEGORIES = [

  // ─── Nursery ──────────────────────────────────────────────────
  {
    id: 'nursery',
    label: 'Nursery',
    description: 'General plant nurseries and retail garden suppliers',
    color: '#2d5a3d',
  },

  // ─── Rare Plants ──────────────────────────────────────────────
  {
    id: 'rare_plants',
    label: 'Rare Plants',
    description: 'Specialty vendors for rare, exotic, and collector plants',
    color: '#5a3d1e',
  },

  // ─── Testing & Analysis ───────────────────────────────────────
  {
    id: 'testing_analysis',
    label: 'Testing & Analysis',
    description: 'Lab testing, soil analysis, water quality, plant diagnostics',
    color: '#1e3d5a',
  },

  // ─── ADD NEW CATEGORIES ABOVE THIS LINE ───────────────────────
  // Example — uncomment and modify to use:
  //
  // {
  //   id: 'tools_equipment',
  //   label: 'Tools & Equipment',
  //   description: 'Farming tools, irrigation systems, greenhouse supplies',
  //   color: '#4a4a2a',
  // },

]


// ═══════════════════════════════════════════════════════════════════
// RATING DIMENSIONS
//
// To add a new rating dimension:
//   1. Copy any block below
//   2. Paste it before the closing ] of the RATING_DIMS array
//   3. Change the id, label, and hint
//   4. Save — appears on all field report forms automatically.
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
