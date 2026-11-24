// Preact + hooks + htm in one file. No build step needed.
// (Step 6 will vendor this file locally so the PWA works offline.)
export {
  html, render, useState, useEffect, useMemo, useRef, useCallback,
} from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
