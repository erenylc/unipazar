export const chatIcons={
 mic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>',
 more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>',
 check:'<svg viewBox="0 0 24 16" aria-hidden="true"><path d="m2 8 4 4L16 2m-5 10 3 0L24 2"/></svg>',
 down:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
 camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3"/></svg>'
};
export function avatarMarkup(name,url,className='avatar'){
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 return `<span class="${className}">${url?`<img src="${esc(url)}" alt="${esc(name)} profil fotoğrafı" loading="eager" decoding="async">`:esc(name?.[0]?.toLocaleUpperCase('tr-TR')||'?')}</span>`;
}
