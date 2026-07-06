export const colors = {
  // Backgrounds
  ink950: '#050606', // page background
  ink900: '#090b0b',
  graphite800: '#151817', // card background
  graphite700: '#202523', // secondary card
  line600: '#303936', // dividers

  // Text
  mist100: '#f3f4f0', // primary text
  mist300: '#c8cdc7', // secondary text
  mist500: '#858d87', // labels/meta

  // Brand
  red500: '#f43a2f', // primary action
  red700: '#9d1f19', // dark red / gradients

  // Neutral
  silver100: '#f2f1f0',
  silver300: '#d8d5d3',
  silver500: '#b3afaf',

  // Accents
  amber400: '#ffb33d', // zone 3 / charts / caution, off-pace
  green400: '#76e082', // zone 1 / positive / better-than-average
  purple500: '#8b5cf6', // personal best
  purple300: '#c4b5fd', // personal best on dark bg

  // Semantic accents — F1 sector-split convention: purple = fastest,
  // green = better than average (not outright best), amber = flagged/caution.
  pbBest: '#8b5cf6',
  pbBestOnDark: '#c4b5fd',
  improving: '#76e082',
  caution: '#ffb33d',

  // Legacy aliases — kept until screens are migrated to the new token set
  silver: '#f2f1f0',
  silverMid: '#d8d5d3',
  silverDark: '#858d87',
  charcoal: '#151817',
  red: '#f43a2f',
  white: '#f3f4f0',
  black: '#050606',
  green: '#76e082',
};

export const fonts = {
  title: 'TitilliumWeb_700Bold', // headings, labels, nav, buttons — condensed, F1-broadcast-adjacent
  number: 'ShareTechMono', // all numeric readouts
  body: 'Arial', // body text, forms

  // Legacy aliases — kept until components are migrated to the new token set
  display: 'TitilliumWeb_700Bold',
  mono: 'ShareTechMono',
};

// Letter-spacing scale — replaces the scattered 1.0–2.2 one-off values that
// used to appear across screens. `wide` covers small-caps labels/buttons/tags;
// `hero` covers large page titles; `tightNum` covers big mono numeric readouts.
export const tracking = {
  tightNum: -0.5,
  wide: 1.5,
  hero: 1.75,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 14, // drill cards, session cards
  xl: 18, // large cards
  pill: 999,
};

export const shadows = {
  panel: '0 22px 80px rgba(0,0,0,0.38)',
  card: '0 18px 52px rgba(0,0,0,0.22)',
  tight: '0 4px 16px rgba(0,0,0,0.30)', // stat tiles / instrument readouts — flush, not floaty
};

export const spacing = {
  pageX: 18,
  pageBottom: 34,
};
