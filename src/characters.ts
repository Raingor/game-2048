import './characters.css';

/** Local copy of the requested portrait identities; no sibling runtime imports or unlock rules. */
export const CHARACTERS = [
  { id: 'classic', name: 'Joke Bear', short: '自嘲熊' },
  { id: 'chiikawa', name: '吉伊', short: '吉伊' },
  { id: 'hachiware', name: '小八', short: '小八' },
  { id: 'usagi', name: '乌萨奇', short: '乌萨奇' },
  { id: 'mole-croquette', name: '鼹鼠饼', short: '鼹鼠饼' },
  { id: 'old-dog', name: '老头狗', short: '老头狗' },
  { id: 'bear-raincoat', name: '小黄鸭雨衣熊', short: '雨衣熊' },
  { id: 'bear-pajama', name: '睡衣派对熊', short: '睡衣熊' },
  { id: 'bear-ninja', name: '夜行忍者熊', short: '忍者熊' },
  { id: 'kurimanju', name: '栗子馒头', short: '栗子馒头' },
  { id: 'momonga', name: '飞鼠', short: '飞鼠' },
  { id: 'rakko', name: '海獭', short: '海獭' },
  { id: 'shisa', name: '狮萨', short: '狮萨' },
  { id: 'furuhonya', name: '古本屋', short: '古本屋' },
  { id: 'bear-strawberry', name: '草莓熊', short: '草莓熊' },
  { id: 'bear-frog', name: '青蛙熊', short: '青蛙熊' },
  { id: 'bear-astronaut', name: '太空熊', short: '太空熊' },
  { id: 'bear-chef', name: '厨师熊', short: '厨师熊' },
  { id: 'bear-pirate', name: '海盗熊', short: '海盗熊' },
] as const;
export type Character = typeof CHARACTERS[number];
export const CHARACTER_STORAGE_KEY = 'puzzle-2048-character-v1';
interface CharacterStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function characterById(id: unknown): Character {
  return CHARACTERS.find(character => character.id === id) ?? CHARACTERS[0];
}

export function loadCharacter(storage?: CharacterStorage): Character {
  try {
    const raw = (storage ?? window.localStorage).getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return CHARACTERS[0];
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1 || !('id' in value)) return CHARACTERS[0];
    return characterById(value.id);
  } catch { return CHARACTERS[0]; }
}

export function saveCharacter(id: unknown, storage?: CharacterStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(CHARACTER_STORAGE_KEY, JSON.stringify({ version: 1, id: characterById(id).id }));
    return true;
  } catch { return false; }
}

/** Document-relative URLs work at both the local root and the trailing-slash Pages subpath. */
export function portraitUrl(id: unknown): string {
  return `./characters-2d/${characterById(id).id}.webp`;
}

export function mountCharacters(host: HTMLElement) {
  let selected = loadCharacter();
  host.innerHTML = `
    <details class="companion" id="character-picker">
      <summary class="companion-summary" aria-label="选择陪伴角色" aria-controls="character-grid">
        <img class="companion-portrait" width="72" height="72" alt="" />
        <span class="companion-copy"><span class="companion-eyebrow">今日陪伴 / LITTLE COMPANY</span><strong class="companion-name"></strong><span class="companion-whisper">陪你慢慢来，每一步都算数。</span></span>
        <span class="companion-switch" aria-hidden="true">换一位 <span>＋</span></span>
      </summary>
      <div class="companion-collection">
        <p class="companion-heading">找一位，一起积木成诗。<span>19 位伙伴 · 全部可选</span></p>
        <div class="companion-grid" id="character-grid" role="group" aria-label="全部19位陪伴角色">
          ${CHARACTERS.map(character => `<button type="button" class="companion-option" data-character="${character.id}" aria-label="选择${character.name}" aria-pressed="false"><img src="${portraitUrl(character.id)}" width="52" height="52" alt="${character.name}头像" decoding="async" /><span>${character.short}</span><i aria-hidden="true">✓</i></button>`).join('')}
        </div>
      </div>
    </details>
    <p class="companion-feedback" role="status" aria-live="polite"></p>`;
  const details = host.querySelector<HTMLDetailsElement>('details')!;
  const summary = host.querySelector<HTMLElement>('summary')!;
  const portrait = host.querySelector<HTMLImageElement>('.companion-portrait')!;
  const feedback = host.querySelector<HTMLElement>('.companion-feedback')!;

  const render = () => {
    portrait.src = portraitUrl(selected.id);
    portrait.alt = `${selected.name}头像`;
    host.querySelector<HTMLElement>('.companion-name')!.textContent = selected.name;
    host.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.character === selected.id));
    });
  };
  const collapse = () => { details.open = false; summary.focus({ preventScroll: true }); };
  host.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-character]');
    if (!button || !host.contains(button)) return;
    selected = characterById(button.dataset.character);
    const persisted = saveCharacter(selected.id);
    render(); collapse();
    feedback.textContent = persisted ? `${selected.name}来陪你了。` : `${selected.name}来陪你了。浏览器暂时无法保存，下次可重新选择。`;
  });
  details.addEventListener('keydown', event => {
    if (event.key === 'Escape' && details.open) { event.preventDefault(); collapse(); }
  });
  render();
}
