export const statuses = {
  inbox: 'Caixa de entrada',
  pending: 'Pendente',
  progress: 'Em andamento',
  review: 'Em revisão',
  done: 'Concluída'
};

export const priorities = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente'
};

export const mainUses = {
  studies: 'Estudos',
  work: 'Trabalho',
  personal: 'Organização pessoal',
  projects: 'Projetos',
  other: 'Outros'
};

export const occupations = ['Estudante', 'Profissional', 'Freelancer', 'Outros'];

export const featureOptions = {
  kanban: 'Kanban',
  categories: 'Categorias',
  deadlines: 'Próximos prazos'
};

export const teamTypes = {
  development: 'Desenvolvimento',
  design: 'Design',
  marketing: 'Marketing',
  education: 'Educação',
  company: 'Empresa',
  other: 'Outros'
};

export const teamSizes = {
  '1-5': '1 a 5 pessoas',
  '6-15': '6 a 15 pessoas',
  '16-50': '16 a 50 pessoas',
  '50+': 'Mais de 50 pessoas'
};

export const teamPurposes = {
  tasks: 'Organizar tarefas da equipe',
  projects: 'Gerenciar projetos',
  deadlines: 'Acompanhar prazos e entregas',
  other: 'Outros'
};

export function validStatus(value) {
  return statuses[value] ? value : 'inbox';
}

export function validPriority(value) {
  return priorities[value] ? value : 'normal';
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR');
}

export function formatDateLong(value = new Date()) {
  return new Date(value).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

export function dueClass(date, status) {
  if (!date || status === 'done') return '';
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(date).toISOString().slice(0, 10);
  if (d < today) return 'overdue';
  if (d === today) return 'today';
  return '';
}

export function truncate(value = '', size = 80) {
  return String(value || '').length > size ? `${String(value).slice(0, size - 1)}...` : String(value || '');
}

export function monthShort(value) {
  return new Date(value).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
}

export function relativeTime(value) {
  if (!value) return '';
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diff < 60) return `há ${diff} min`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function icon(name, extra = '') {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    kanban: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    home: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    list: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><polyline points="3.5 6 4.5 7 6 5"/><polyline points="3.5 12 4.5 13 6 11"/><polyline points="3.5 18 4.5 19 6 17"/>',
    tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/>',
    menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    chevrons: '<polyline points="7 15 12 20 17 15"/><polyline points="7 9 12 4 17 9"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    rotate: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
  };
  return `<svg class="icon${extra ? ` ${esc(extra)}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.inbox}</svg>`;
}

export function initials(name = '') {
  const parts = String(name || 'U').trim().split(/\s+/);
  return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase();
}

// Foto de perfil ou logo; sem imagem, usa as iniciais.
export function avatar(entity, extra = '') {
  const src = entity?.avatar_path || entity?.logo_path || '';
  const cls = `avatar${extra ? ` ${esc(extra)}` : ''}`;
  return src
    ? `<div class="${cls}"><img src="${esc(src)}" alt=""></div>`
    : `<div class="${cls}" aria-hidden="true">${esc(initials(entity?.name))}</div>`;
}

export function themeToggle() {
  return `<button class="theme-toggle" type="button" role="switch" aria-checked="false" data-theme-toggle aria-label="Modo escuro" title="Alternar modo claro / escuro"><span class="tt-opt tt-light">${icon('sun')}</span><span class="tt-opt tt-dark">${icon('moon')}</span><span class="tt-knob"></span></button>`;
}

export function brandMark() {
  return `<span class="dot">${icon('check')}</span>`;
}

export function statusIcon(status) {
  return ({ inbox: 'inbox', pending: 'clock', progress: 'activity', review: 'search', done: 'check-circle' })[status] || 'inbox';
}

export function priorityIcon(priority) {
  return ({ low: 'arrow-down', normal: 'minus', high: 'arrow-up', urgent: 'zap' })[priority] || 'minus';
}

export function statusPill(status) {
  return `<span class="pill st ${esc(status)}">${icon(statusIcon(status), 'xs')}${esc(statuses[status] || status)}</span>`;
}

export function priorityPill(priority) {
  return `<span class="pill pri ${esc(priority)}">${icon(priority === 'urgent' ? 'zap' : 'flag', 'xs')}${esc(priorities[priority] || priority)}</span>`;
}

export function catColor(name = '') {
  const palette = ['var(--yellow)', 'var(--sky)', 'var(--lilac)', 'var(--mint)', 'var(--red)', '#ff8fc7', '#ff9f1c'];
  let hash = 0;
  for (const char of String(name || 'Sem categoria')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function dueLabel(date, status) {
  if (!date) return '—';
  return dueClass(date, status) === 'today' ? 'Hoje' : formatDate(date);
}

export function dueCss(date, status) {
  return ({ overdue: 'due-late', today: 'due-today' })[dueClass(date, status)] || '';
}

export function templateLocals(req) {
  return {
    user: req.session.user || null,
    flash: req.session.flash || {},
    statuses,
    priorities,
    formatDate,
    formatDateTime,
    formatDateLong,
    dueClass,
    dueCss,
    dueLabel,
    truncate,
    monthShort,
    relativeTime,
    icon,
    themeToggle,
    brandMark,
    statusIcon,
    priorityIcon,
    statusPill,
    priorityPill,
    catColor,
    initials,
    avatar,
    mainUses,
    occupations,
    featureOptions,
    teamTypes,
    teamSizes,
    teamPurposes,
    query: req.query
  };
}

export function flash(req, type, message) {
  req.session.flash = { [type]: message };
}

export function clearFlash(req) {
  req.session.flash = {};
}
