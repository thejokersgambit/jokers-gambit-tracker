// Brand mark (a joker card) as plain SVG — used for recap images and the app icon, where emoji can't be rendered.
export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect x="12" y="4" width="40" height="56" rx="6" fill="#2a1452" stroke="#e3b84b" stroke-width="3"/>
<path d="M32 16l4.2 8.6 9.4 1.4-6.8 6.6 1.6 9.4L32 37.6 23.6 42l1.6-9.4-6.8-6.6 9.4-1.4z" fill="#e3b84b"/>
<text x="18" y="15" font-family="monospace" font-weight="700" font-size="9" fill="#e3b84b">J</text>
<text x="46" y="56" font-family="monospace" font-weight="700" font-size="9" fill="#e3b84b" transform="rotate(180 47.5 52.5)">J</text>
</svg>`;

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0a090d"/>
<rect x="14" y="6" width="36" height="52" rx="6" fill="#2a1452" stroke="#e3b84b" stroke-width="3"/>
<path d="M32 17l4.2 8.6 9.4 1.4-6.8 6.6 1.6 9.4L32 38.6 23.6 43l1.6-9.4-6.8-6.6 9.4-1.4z" fill="#e3b84b"/></svg>`;
