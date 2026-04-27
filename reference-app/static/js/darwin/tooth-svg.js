// tooth-svg.js — Surfaces, rich tooltip, root SVG builders, tooth anatomy library
// Extracted from darwin_lab.html lines 9580–10681
// ═══════════════════════════════════════════════════════════════


// Surface data storage (keyed: fileId -> fdi -> "vmodl" string of active surfaces)
let arenaGTSurfaces = {};

// ── Справочник поверхностей (русская конвенция) ──
const SURFACE_NAMES = {
    m: {short: 'М', full: 'мезиальная'},
    o: {short: 'О', full: 'окклюзионная'},
    d: {short: 'Д', full: 'дистальная'},
    v: {short: 'В', full: 'вестибулярная'},
    l: {short: 'Л', full: 'лингвальная'},
};
const SURFACE_ORDER = ['m','o','d','v','l'];

// Тултипы для всех статусов — используется в richTooltip и пикере
const STATUS_TOOLTIPS = {
    'present':    'Интактный зуб без патологии и лечения [1]',
    'missing':    'Зуб отсутствует (удалён / не прорезался) [0]',
    'impacted':   'Ретинированный зуб (не прорезавшийся, виден в кости) [8]',
    'caries':     'Кариес — выберите поражённые поверхности (M/O/D/B/L) [2]',
    'attrition':  'Стираемость (TWI 0-4) — клик циклирует степень [6]',
    'root':       'Только корень без коронковой части [5]',
    'restored':   'Пломба — выберите восстановленные поверхности [3]',
    'endo':       'Эндодонтическое лечение — затем настройте каналы внизу [4]',
    'impl_fixture':   'Имплантат-фикстура (только тело в кости) [q]',
    'impl_cover':     'Имплантат + заглушка (cover screw) [w]',
    'impl_healing':   'Имплантат + формирователь десны [e]',
    'impl_abutment':  'Имплантат + абатмент (без коронки) [t]',
    'impl_temp_abut': 'Имплантат + временный абатмент',
    'impl_provisional':'Имплантат + провизорная коронка',
    'impl_restored':  'Имплантат с постоянной коронкой [y]',
    'post':       'Штифт / культевая вкладка в корневом канале [r]',
    'crowned':    'Искусственная коронка (керамика/металл) [6]',
    'bridge':     'Понтик — тело мостовидного протеза (нет корня) [7]',
    '_smart_bridge':'🌉 Мост: выделите зубы drag-select, нажмите [b]. Крайние → опоры, средние пустые → понтики, пустые на краю → консоли',
    '_smart_bar': '═ Балка: выделите зубы drag-select, нажмите [g]. Имплантаты → опоры, промежутки → балка, края → консоли',
    'bar':        'Сегмент балки (между имплантатами, без собственной опоры)',
    'cantilever': 'Консоль — часть протеза, нависающая за последнюю опору [u]',
    'uncertain':  'Не ясно — не удаётся определить статус на снимке [9]',
    '':           'Сброс — очистить статус зуба [Backspace]',
};

// Rich tooltip — shows all layers, surfaces, notes, bridges
function richTooltip(fdi, rawStatus, fileId) {
    const layers = parseToothLayers(rawStatus);
    let lines = [`Зуб ${fdi}`];

    if (layers.length === 0 || (layers.length === 1 && !layers[0].status)) {
        lines.push('Статус: не задан');
    } else if (layers.length === 1) {
        const l = layers[0];
        const name = STATUS_TOOLTIPS[l.status] || l.status;
        lines.push(`Статус: ${name}`);
        if (l.surfaces) {
            const surfNames = SURFACE_ORDER.filter(s => l.surfaces.includes(s))
                .map(s => SURFACE_NAMES[s].full);
            lines.push(`Поверхности: ${surfNames.join(', ')}`);
        }
    } else {
        lines.push('Слои:');
        layers.forEach((l, i) => {
            const name = STATUS_TOOLTIPS[l.status] || l.status;
            let surfStr = '';
            if (l.surfaces) {
                const surfNames = SURFACE_ORDER.filter(s => l.surfaces.includes(s))
                    .map(s => SURFACE_NAMES[s].short);
                surfStr = ` (${surfNames.join('')})`;
            }
            lines.push(`  ${i+1}. ${name}${surfStr}`);
        });
    }

    // Bridge links
    if (fileId) {
        const links = arenaBridgeLinks[fileId] || {};
        const linkedTo = [];
        for (const key of Object.keys(links)) {
            const [a, b] = key.split('-');
            if (a === fdi) linkedTo.push(b);
            if (b === fdi) linkedTo.push(a);
        }
        if (linkedTo.length > 0) lines.push(`Мост: связан с ${linkedTo.join(', ')}`);
    }

    // Notes
    if (fileId) {
        const note = (arenaToothNotes[fileId] || {})[fdi];
        if (note) lines.push(`Заметки: ${note}`);
    }

    // Root data
    if (fileId) {
        const rd = (arenaRootData[fileId] || {})[fdi];
        if (rd) {
            const type = FDI_TO_TYPE[fdi];
            const tooth = TOOTH_LIBRARY[type];
            const variant = tooth?.variants.find(v => v.id === rd.variant);
            if (variant) {
                let rootInfo = `Корни: ${variant.name.ru}`;
                Object.entries(rd.vertucci || {}).forEach(([ri, vt]) => {
                    rootInfo += ` | R${parseInt(ri)+1}: Vertucci ${vt}`;
                });
                lines.push(rootInfo);
            }
            // Periapical info
            const periap = rd?.periapical;
            if (periap) {
                Object.entries(periap).forEach(([ri, pa]) => {
                    const pState = PERIAPICAL_STATES.find(s => s.key === _periapKey(pa.type));
                    if (pState && pState.key !== 'none') {
                        lines.push(`Периапик R${parseInt(ri)+1}: ${pState.nameRU} (PAI ${pState.pai})`);
                    }
                });
            }
            // Wear info
            const wear = rd?.wear;
            if (wear && wear.twi > 0) {
                const tw = TWI_STATES[wear.twi];
                lines.push(`Стираемость: TWI ${wear.twi} — ${tw.nameRU}`);
            }
            // Furcation info
            const furcD = rd?.furcation;
            if (furcD) {
                Object.entries(furcD).forEach(([fi, f]) => {
                    if (f.grade > 0) {
                        const fs = FURCATION_STATES[f.grade];
                        lines.push(`Фуркация ${parseInt(fi)+1}: ${fs.nameRU}`);
                    }
                });
            }
            // Lateral defects
            const latD = rd?.lateral;
            if (latD) {
                Object.entries(latD).forEach(([key, ld]) => {
                    if (ld.type !== 'none') {
                        const ls = LATERAL_STATES.find(s => s.key === ld.type);
                        const [ri, side] = key.split('_');
                        lines.push(`Лат. R${parseInt(ri)+1} ${side==='m'?'мез.':'дист.'}: ${ls?.nameRU || ld.type}`);
                    }
                });
            }
            // Endo-perio
            const epD = rd?.endoPerio;
            if (epD) {
                Object.entries(epD).forEach(([ri, ep]) => {
                    if (ep.type !== 'none') {
                        const eps = ENDOPERIO_STATES.find(s => s.key === ep.type);
                        lines.push(`Эндо-перио R${parseInt(ri)+1}: ${eps?.nameRU || ep.type}`);
                    }
                });
            }
            // Hemisection
            const remD = rd?.removedRoots;
            if (remD) {
                Object.keys(remD).forEach(ri => {
                    lines.push(`✂ R${parseInt(ri)+1} удалён (гемисекция)`);
                });
            }
            // Fractures
            const fracD = rd?.fracture;
            if (fracD) {
                Object.entries(fracD).forEach(([ri, fr]) => {
                    if (fr.type && fr.type !== 'none') {
                        const fs = FRACTURE_STATES.find(s => s.key === fr.type);
                        lines.push(`⚡ Перелом R${parseInt(ri)+1}: ${fs?.nameRU || fr.type}`);
                    }
                });
            }
            const cfD = rd?.crownFracture;
            if (cfD && cfD.type && cfD.type !== 'none') {
                const cfs = CROWN_FRACTURE_STATES.find(s => s.key === cfD.type);
                lines.push(`⚡ Коронка: ${cfs?.nameRU || cfD.type}`);
            }
        }
    }

    return lines.join('\n');
}

/* ═══════ КОРНЕВОЙ SVG — Vertucci-aware библиотека морфологии зубов ═══════ */

const FDI_TO_TYPE = {
  '1.1':'UP_CI','2.1':'UP_CI','1.2':'UP_LI','2.2':'UP_LI',
  '1.3':'UP_C','2.3':'UP_C','1.4':'UP_PM1','2.4':'UP_PM1',
  '1.5':'UP_PM2','2.5':'UP_PM2','1.6':'UP_M1','2.6':'UP_M1',
  '1.7':'UP_M2','2.7':'UP_M2','1.8':'UP_M3','2.8':'UP_M3',
  '3.1':'LO_I','4.1':'LO_I','3.2':'LO_I','4.2':'LO_I',
  '3.3':'LO_C','4.3':'LO_C','3.4':'LO_PM','4.4':'LO_PM',
  '3.5':'LO_PM','4.5':'LO_PM','3.6':'LO_M1','4.6':'LO_M1',
  '3.7':'LO_M2','4.7':'LO_M2','3.8':'LO_M3','4.8':'LO_M3'
};

const TOOTH_LIBRARY = {
  /* ---- UPPER ANTERIOR ---- */
  UP_CI: {
    name:{ru:'Верхний центральный резец',en:'Upper Central Incisor'},
    upper:true,
    svg:{vb:'0 0 40 100',W:40,H:100,ny:25,nw:20,cx:20},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:100,isDefault:true,
       roots:[{l:60,bw:14,tw:4,cv:0,ox:0,shape:'tapered'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III']}}
    ]
  },
  UP_LI: {
    name:{ru:'Верхний латеральный резец',en:'Upper Lateral Incisor'},
    upper:true,
    svg:{vb:'0 0 40 100',W:40,H:100,ny:25,nw:18,cx:20},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:97,isDefault:true,
       roots:[{l:58,bw:12,tw:3.5,cv:2,ox:0,shape:'tapered'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III']}},
      {id:'1r_dilac',name:{ru:'С дилацерацией',en:'Dilacerated'},freq:3,isDefault:false,
       roots:[{l:58,bw:12,tw:3.5,cv:8,ox:0,shape:'tapered'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III']}}
    ]
  },
  UP_C: {
    name:{ru:'Верхний клык',en:'Upper Canine'},
    upper:true,
    svg:{vb:'0 0 44 120',W:44,H:120,ny:28,nw:22,cx:22},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:100,isDefault:true,
       roots:[{l:72,bw:16,tw:4,cv:1,ox:0,shape:'ovoid'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV']}}
    ]
  },
  /* ---- UPPER POSTERIOR ---- */
  UP_PM1: {
    name:{ru:'Верхний 1-й премоляр',en:'Upper 1st Premolar'},
    upper:true,
    svg:{vb:'0 0 56 110',W:56,H:110,ny:28,nw:24,cx:28},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:22,isDefault:false,
       roots:[{l:56,bw:16,tw:5,cv:0,ox:0,shape:'elliptical'}],
       defaultVertucci:{0:'IV'},possibleVertucci:{0:['I','II','III','IV','V']}},
      {id:'2r_coronal',name:{ru:'2 корня, корональная бифуркация',en:'2 roots, coronal split'},freq:40,isDefault:true,
       roots:[{l:52,bw:10,tw:3.5,cv:-2,ox:-8,shape:'tapered'},{l:50,bw:10,tw:3.5,cv:2,ox:8,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II','IV'],1:['I','II','IV']}},
      {id:'2r_mid',name:{ru:'2 корня, средняя бифуркация',en:'2 roots, mid split'},freq:23,isDefault:false,
       roots:[{l:54,bw:11,tw:3.5,cv:-1,ox:-7,shape:'tapered'},{l:52,bw:11,tw:3.5,cv:1,ox:7,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II'],1:['I','II']}},
      {id:'2r_apical',name:{ru:'2 корня, апикальная бифуркация',en:'2 roots, apical split'},freq:10,isDefault:false,
       roots:[{l:50,bw:12,tw:4,cv:-1,ox:-6,shape:'tapered'},{l:48,bw:12,tw:4,cv:1,ox:6,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','IV'],1:['I','IV']}},
      {id:'3r',name:{ru:'3 корня',en:'3 roots'},freq:5,isDefault:false,
       roots:[{l:48,bw:8,tw:3,cv:-2,ox:-14,shape:'tapered'},{l:50,bw:9,tw:3,cv:0,ox:0,shape:'tapered'},{l:48,bw:8,tw:3,cv:2,ox:14,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I'},possibleVertucci:{0:['I'],1:['I'],2:['I']}}
    ]
  },
  UP_PM2: {
    name:{ru:'Верхний 2-й премоляр',en:'Upper 2nd Premolar'},
    upper:true,
    svg:{vb:'0 0 50 110',W:50,H:110,ny:28,nw:22,cx:25},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:75,isDefault:true,
       roots:[{l:58,bw:14,tw:4,cv:0,ox:0,shape:'elliptical'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V']}},
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:24,isDefault:false,
       roots:[{l:52,bw:10,tw:3.5,cv:-1,ox:-7,shape:'tapered'},{l:50,bw:10,tw:3.5,cv:1,ox:7,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II'],1:['I','II']}},
      {id:'3r',name:{ru:'3 корня',en:'3 roots'},freq:1,isDefault:false,
       roots:[{l:46,bw:8,tw:3,cv:-1,ox:-10,shape:'tapered'},{l:48,bw:8,tw:3,cv:0,ox:0,shape:'tapered'},{l:46,bw:8,tw:3,cv:1,ox:10,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I'},possibleVertucci:{0:['I'],1:['I'],2:['I']}}
    ]
  },
  UP_M1: {
    name:{ru:'Верхний 1-й моляр',en:'Upper 1st Molar'},
    upper:true,
    svg:{vb:'0 0 70 115',W:70,H:115,ny:30,nw:32,cx:35},
    variants:[
      {id:'3r',name:{ru:'3 корня (MB2 вероятен)',en:'3 roots (MB2 likely)'},freq:78,isDefault:true,
       roots:[{l:52,bw:10,tw:3,cv:-3,ox:-16,shape:'ribbon'},{l:56,bw:12,tw:4,cv:1,ox:4,shape:'tapered'},{l:50,bw:9,tw:3,cv:3,ox:18,shape:'tapered'}],
       defaultVertucci:{0:'IV',1:'I',2:'I'},possibleVertucci:{0:['I','II','III','IV','V','VI'],1:['I','II','III'],2:['I','II','III']}},
      {id:'3r_mb1only',name:{ru:'3 корня (MB1 только)',en:'3 roots (MB1 only)'},freq:19,isDefault:false,
       roots:[{l:52,bw:10,tw:3.5,cv:-3,ox:-16,shape:'ribbon'},{l:56,bw:12,tw:4,cv:1,ox:4,shape:'tapered'},{l:50,bw:9,tw:3,cv:3,ox:18,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I'},possibleVertucci:{0:['I','II'],1:['I'],2:['I']}},
      {id:'4r',name:{ru:'4 корня (MP отд.)',en:'4 roots (MP separate)'},freq:3,isDefault:false,
       roots:[{l:48,bw:8,tw:3,cv:-2,ox:-18,shape:'tapered'},{l:50,bw:9,tw:3,cv:-1,ox:-4,shape:'tapered'},{l:54,bw:10,tw:4,cv:1,ox:8,shape:'tapered'},{l:48,bw:8,tw:3,cv:2,ox:20,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I',3:'I'},possibleVertucci:{0:['I'],1:['I'],2:['I'],3:['I']}}
    ]
  },
  UP_M2: {
    name:{ru:'Верхний 2-й моляр',en:'Upper 2nd Molar'},
    upper:true,
    svg:{vb:'0 0 66 110',W:66,H:110,ny:28,nw:30,cx:33},
    variants:[
      {id:'3r_sep',name:{ru:'3 корня раздельных',en:'3 roots separate'},freq:45,isDefault:true,
       roots:[{l:48,bw:9,tw:3,cv:-2,ox:-14,shape:'tapered'},{l:52,bw:11,tw:4,cv:1,ox:4,shape:'tapered'},{l:46,bw:9,tw:3,cv:2,ox:17,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I'},possibleVertucci:{0:['I','II','IV'],1:['I','II'],2:['I']}},
      {id:'3r_fused',name:{ru:'3 корня, сросшиеся',en:'3 roots fused'},freq:30,isDefault:false,
       roots:[{l:50,bw:12,tw:5,cv:-1,ox:-10,shape:'fused_2'},{l:50,bw:11,tw:4,cv:1,ox:10,shape:'tapered'}],
       defaultVertucci:{0:'IV',1:'I'},possibleVertucci:{0:['I','II','IV','VI'],1:['I','II']}},
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:18,isDefault:false,
       roots:[{l:50,bw:12,tw:4,cv:-1,ox:-9,shape:'tapered'},{l:48,bw:11,tw:4,cv:1,ox:9,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II','IV'],1:['I','II']}},
      {id:'1r_conical',name:{ru:'1 корень конический',en:'1 root conical'},freq:7,isDefault:false,
       roots:[{l:46,bw:18,tw:7,cv:0,ox:0,shape:'conical'}],
       defaultVertucci:{0:'III'},possibleVertucci:{0:['I','II','III','IV','V']}}
    ]
  },
  UP_M3: {
    name:{ru:'Верхний 3-й моляр',en:'Upper 3rd Molar'},
    upper:true,
    svg:{vb:'0 0 60 100',W:60,H:100,ny:26,nw:28,cx:30},
    variants:[
      {id:'3r',name:{ru:'3 корня',en:'3 roots'},freq:45,isDefault:true,
       roots:[{l:40,bw:8,tw:3,cv:-3,ox:-12,shape:'tapered'},{l:44,bw:10,tw:4,cv:0,ox:2,shape:'tapered'},{l:38,bw:8,tw:3,cv:3,ox:14,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I'},possibleVertucci:{0:['I','II'],1:['I'],2:['I']}},
      {id:'1r_fused',name:{ru:'1 корень сросшийся',en:'1 root fused'},freq:35,isDefault:false,
       roots:[{l:42,bw:20,tw:8,cv:1,ox:0,shape:'conical'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V']}},
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:20,isDefault:false,
       roots:[{l:42,bw:10,tw:4,cv:-1,ox:-8,shape:'tapered'},{l:40,bw:10,tw:4,cv:1,ox:8,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II'],1:['I','II']}}
    ]
  },
  /* ---- LOWER ANTERIOR ---- */
  LO_I: {
    name:{ru:'Нижний резец',en:'Lower Incisor'},
    upper:false,
    svg:{vb:'0 0 36 95',W:36,H:95,ny:22,nw:14,cx:18},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:100,isDefault:true,
       roots:[{l:55,bw:10,tw:3,cv:0,ox:0,shape:'elliptical'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V']}}
    ]
  },
  LO_C: {
    name:{ru:'Нижний клык',en:'Lower Canine'},
    upper:false,
    svg:{vb:'0 0 40 110',W:40,H:110,ny:26,nw:18,cx:20},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:94,isDefault:true,
       roots:[{l:66,bw:14,tw:4,cv:1,ox:0,shape:'ovoid'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V']}},
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:6,isDefault:false,
       roots:[{l:60,bw:10,tw:3.5,cv:-1,ox:-6,shape:'tapered'},{l:58,bw:10,tw:3.5,cv:1,ox:6,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I'],1:['I']}}
    ]
  },
  /* ---- LOWER POSTERIOR ---- */
  LO_PM: {
    name:{ru:'Нижний премоляр',en:'Lower Premolar'},
    upper:false,
    svg:{vb:'0 0 44 105',W:44,H:105,ny:25,nw:18,cx:22},
    variants:[
      {id:'1r',name:{ru:'1 корень',en:'1 root'},freq:88,isDefault:true,
       roots:[{l:56,bw:13,tw:4,cv:0,ox:0,shape:'tapered'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V']}},
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:12,isDefault:false,
       roots:[{l:50,bw:9,tw:3.5,cv:-1,ox:-6,shape:'tapered'},{l:48,bw:9,tw:3.5,cv:1,ox:6,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II'],1:['I','II']}}
    ]
  },
  LO_M1: {
    name:{ru:'Нижний 1-й моляр',en:'Lower 1st Molar'},
    upper:false,
    svg:{vb:'0 0 64 110',W:64,H:110,ny:28,nw:30,cx:32},
    variants:[
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:87,isDefault:true,
       roots:[{l:54,bw:13,tw:4,cv:-2,ox:-10,shape:'ribbon'},{l:50,bw:11,tw:4,cv:2,ox:12,shape:'tapered'}],
       defaultVertucci:{0:'IV',1:'I'},possibleVertucci:{0:['I','II','III','IV','V'],1:['I','II','III','IV']}},
      {id:'3r_radix',name:{ru:'3 корня (radix entomolaris)',en:'3 roots (radix entomolaris)'},freq:10,isDefault:false,
       roots:[{l:50,bw:11,tw:3.5,cv:-2,ox:-14,shape:'ribbon'},{l:48,bw:10,tw:3.5,cv:1,ox:2,shape:'tapered'},{l:46,bw:8,tw:3,cv:3,ox:16,shape:'tapered'}],
       defaultVertucci:{0:'IV',1:'I',2:'I'},possibleVertucci:{0:['I','II','IV'],1:['I','II'],2:['I']}},
      {id:'2r_3canals',name:{ru:'2 корня, 3+ каналов',en:'2 roots, 3+ canals'},freq:3,isDefault:false,
       roots:[{l:54,bw:13,tw:4,cv:-2,ox:-10,shape:'ribbon'},{l:50,bw:11,tw:4,cv:2,ox:12,shape:'tapered'}],
       defaultVertucci:{0:'V',1:'IV'},possibleVertucci:{0:['IV','V','VI'],1:['II','IV','V']}}
    ]
  },
  LO_M2: {
    name:{ru:'Нижний 2-й моляр',en:'Lower 2nd Molar'},
    upper:false,
    svg:{vb:'0 0 60 108',W:60,H:108,ny:27,nw:28,cx:30},
    variants:[
      {id:'2r_normal',name:{ru:'2 корня',en:'2 roots'},freq:70,isDefault:true,
       roots:[{l:50,bw:12,tw:4,cv:-1,ox:-9,shape:'tapered'},{l:48,bw:11,tw:4,cv:1,ox:10,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II','III','IV'],1:['I','II','III']}},
      {id:'c_shaped',name:{ru:'C-образный',en:'C-shaped'},freq:15,isDefault:false,
       roots:[{l:50,bw:22,tw:8,cv:0,ox:0,shape:'c_shaped'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V','VI']}},
      {id:'2r_fused',name:{ru:'2 корня сросшиеся',en:'2 roots fused'},freq:12,isDefault:false,
       roots:[{l:48,bw:18,tw:6,cv:0,ox:0,shape:'fused_2'}],
       defaultVertucci:{0:'IV'},possibleVertucci:{0:['I','II','III','IV','V','VI']}},
      {id:'1r_conical',name:{ru:'1 конический',en:'1 conical'},freq:3,isDefault:false,
       roots:[{l:44,bw:16,tw:6,cv:0,ox:0,shape:'conical'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III']}}
    ]
  },
  LO_M3: {
    name:{ru:'Нижний 3-й моляр',en:'Lower 3rd Molar'},
    upper:false,
    svg:{vb:'0 0 58 100',W:58,H:100,ny:26,nw:26,cx:29},
    variants:[
      {id:'2r',name:{ru:'2 корня',en:'2 roots'},freq:50,isDefault:true,
       roots:[{l:40,bw:11,tw:4,cv:-2,ox:-8,shape:'tapered'},{l:38,bw:10,tw:4,cv:2,ox:9,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I'},possibleVertucci:{0:['I','II','IV'],1:['I','II']}},
      {id:'1r_fused',name:{ru:'1 сросшийся',en:'1 fused'},freq:35,isDefault:false,
       roots:[{l:38,bw:18,tw:7,cv:1,ox:0,shape:'conical'}],
       defaultVertucci:{0:'I'},possibleVertucci:{0:['I','II','III','IV','V']}},
      {id:'3r',name:{ru:'3 корня',en:'3 roots'},freq:15,isDefault:false,
       roots:[{l:38,bw:8,tw:3,cv:-2,ox:-12,shape:'tapered'},{l:40,bw:9,tw:3,cv:0,ox:0,shape:'tapered'},{l:36,bw:8,tw:3,cv:2,ox:12,shape:'tapered'}],
       defaultVertucci:{0:'I',1:'I',2:'I'},possibleVertucci:{0:['I'],1:['I'],2:['I']}}
    ]
  }
};

const CANAL_NAMES = {
  UP_CI: [{single:'\u0426',singleEN:'C',multi:['\u0429','\u042F'],multiEN:['B','L']}],
  UP_LI: [{single:'\u0426',singleEN:'C',multi:['\u0429','\u042F'],multiEN:['B','L']}],
  UP_C:  [{single:'\u0426',singleEN:'C',multi:['\u0429','\u042F'],multiEN:['B','L']}],
  UP_PM1:[
    {single:'\u0429',singleEN:'B',multi:['\u04291','\u04292'],multiEN:['B1','B2']},
    {single:'\u041D',singleEN:'P',multi:['\u041D1','\u041D2'],multiEN:['P1','P2']}
  ],
  UP_PM2:[{single:'\u0426',singleEN:'C',multi:['\u0429','\u041D'],multiEN:['B','P']}],
  UP_M1: [
    {single:'\u041C\u0429',singleEN:'MB',multi:['\u041C\u0429','\u041C\u04292'],multiEN:['MB','MB2']},
    {single:'\u041D',singleEN:'P',multi:['\u041D1','\u041D2'],multiEN:['P1','P2']},
    {single:'\u0414\u0429',singleEN:'DB',multi:['\u0414\u04291','\u0414\u04292'],multiEN:['DB1','DB2']}
  ],
  UP_M2: [
    {single:'\u041C\u0429',singleEN:'MB',multi:['\u041C\u04291','\u041C\u04292'],multiEN:['MB1','MB2']},
    {single:'\u041D',singleEN:'P',multi:['\u041D1','\u041D2'],multiEN:['P1','P2']},
    {single:'\u0414\u0429',singleEN:'DB',multi:['\u0414\u04291','\u0414\u04292'],multiEN:['DB1','DB2']}
  ],
  UP_M3: [
    {single:'\u041C\u0429',singleEN:'MB',multi:['\u041C\u04291','\u041C\u04292'],multiEN:['MB1','MB2']},
    {single:'\u041D',singleEN:'P',multi:['\u041D1','\u041D2'],multiEN:['P1','P2']},
    {single:'\u0414\u0429',singleEN:'DB',multi:['\u0414\u04291','\u0414\u04292'],multiEN:['DB1','DB2']}
  ],
  LO_I:  [{single:'\u0426',singleEN:'C',multi:['\u0429','\u042F'],multiEN:['B','L']}],
  LO_C:  [{single:'\u0426',singleEN:'C',multi:['\u0429','\u042F'],multiEN:['B','L']}],
  LO_PM: [{single:'\u0426',singleEN:'C',multi:['\u0429','\u042F'],multiEN:['B','L']}],
  LO_M1: [
    {single:'\u041C',singleEN:'M',multi:['\u041C\u0429','\u041C\u042F'],multiEN:['MB','ML']},
    {single:'\u0414',singleEN:'D',multi:['\u0414\u0429','\u0414\u042F'],multiEN:['DB','DL']}
  ],
  LO_M2: [
    {single:'\u041C',singleEN:'M',multi:['\u041C\u0429','\u041C\u042F'],multiEN:['MB','ML']},
    {single:'\u0414',singleEN:'D',multi:['\u0414\u0429','\u0414\u042F'],multiEN:['DB','DL']}
  ],
  LO_M3: [
    {single:'\u041C',singleEN:'M',multi:['\u041C\u0429','\u041C\u042F'],multiEN:['MB','ML']},
    {single:'\u0414',singleEN:'D',multi:['\u0414\u0429','\u0414\u042F'],multiEN:['DB','DL']}
  ]
};

const VERTUCCI_SCHEMAS = {
  'I':   {orifices:1,foramina:1,dx:[0],
          formula:'1-1',
          descRU:'Один канал от устья до апекса',
          detail:'A single canal extends from the pulp chamber to the apex.',
          prevalence:'Upper central incisors (70%), palatal roots of upper molars (>95%), lower premolars (70%)'},
  'II':  {orifices:2,foramina:1,dx:[-3,3],
          formula:'2-1',
          descRU:'Два канала из камеры, сливаются перед апексом в один',
          detail:'Two separate canals leave the pulp chamber and merge short of the apex.',
          prevalence:'Lower incisors (15-30%), MB root of upper molars (5-10%)'},
  'III': {orifices:1,foramina:1,dx:[0],
          formula:'1-2-1',
          descRU:'Один канал делится на два в средней трети и снова сливается у апекса',
          detail:'One canal leaves the chamber, divides into two within the root, then re-joins as one.',
          prevalence:'Lower premolars (1-5%), MB root of upper molars (2-4%)'},
  'IV':  {orifices:2,foramina:2,dx:[-3,3],
          formula:'2-2',
          descRU:'Два отдельных канала от камеры до двух апикальных форамен',
          detail:'Two distinct canals extend from the pulp chamber to two separate apical foramina.',
          prevalence:'Upper 1st premolars (62%), mesial root lower molars (28%), MB root upper molars (18%)'},
  'V':   {orifices:1,foramina:2,dx:[0],
          formula:'1-2',
          descRU:'Один канал делится на два у апекса, два отдельных форамена',
          detail:'A single canal divides short of the apex into two separate canals with two foramina.',
          prevalence:'Lower premolars (4-8%), upper 2nd premolars (3-5%), lower incisors (2%)'},
  'VI':  {orifices:2,foramina:2,dx:[-3,3],
          formula:'2-1-2',
          descRU:'Два канала сливаются в средней трети, затем снова разделяются',
          detail:'Two canals merge in the body of the root, then re-divide to exit as two.',
          prevalence:'Rare. Lower molars mesial root (1-3%), lower premolars (1-2%)'},
  'VII': {orifices:1,foramina:2,dx:[0],
          formula:'1-2-1-2',
          descRU:'Один канал делится, сливается, затем снова делится',
          detail:'One canal divides then re-joins, and finally re-divides into two near the apex.',
          prevalence:'Very rare. Documented in lower molars and premolars (<1%)'},
  'VIII':{orifices:3,foramina:3,dx:[-5,0,5],
          formula:'3-3',
          descRU:'Три отдельных канала от камеры до трёх апикальных форамен',
          detail:'Three independent canals extend from the pulp chamber to three separate apical foramina.',
          prevalence:'Very rare. Upper 1st premolars (1-2%), mesial root of lower molars (<1%)'}
};

const FILL_STATES = [
  {key:'unknown',  label:'?',   color:'var(--gry, #555)',dasharray:'4,3', lengthFrac:1.0, overfill:false},
  {key:'third',    label:'\u2153', color:'var(--red, #ef4444)',dasharray:'none',lengthFrac:0.35,overfill:false},
  {key:'twothird', label:'\u2154', color:'var(--yel, #f59e0b)',dasharray:'none',lengthFrac:0.67,overfill:false},
  {key:'full',     label:'OK',  color:'var(--grn, #22c55e)',dasharray:'none',lengthFrac:1.0, overfill:false},
  {key:'over',     label:'OVR', color:'var(--red, #ef4444)',dasharray:'none',lengthFrac:1.15,overfill:true}
];

// Radiographic periapical findings (what you SEE on OPG, not pathological diagnosis)
// Based on PAI (Periapical Index, Ørstavik 1986)
const PERIAPICAL_STATES = [
  {key:'none',        label:'—',    color:'none',               r:0, blur:0, pai:1,
   nameRU:'Норма',    nameEN:'Normal',
   desc:'Нормальные периапикальные структуры. Интактная lamina dura.',
   ref:'Ørstavik D. J Endod. 1986;12(4):167-71. PMID:3457698'},
  {key:'widened_pdl', label:'PDL↑',  color:'var(--yel)',          r:0, blur:0, pai:2,
   nameRU:'Расш. периодонт. щель', nameEN:'Widened PDL space',
   desc:'Расширение периодонтальной щели вдоль корня. Ранний признак воспаления или перегрузки.',
   ref:'Ørstavik D. J Endod. 1986;12(4):167-71. PMID:3457698'},
  {key:'lesion_small',label:'ПП<5',  color:'rgba(249,115,22,0.5)',r:4, blur:0, pai:3,
   nameRU:'Периапик. поражение <5мм', nameEN:'Periapical lesion <5mm',
   desc:'Ограниченный очаг разрежения у верхушки корня, диаметр <5мм. Чёткие или нечёткие границы. Рентгенологически невозможно отличить гранулёму от кисты.',
   ref:'Bender IB, Seltzer S. Oral Surg. 1961;14(12):1485-97. PMID:13915628'},
  {key:'lesion_large',label:'ПП≥5',  color:'rgba(239,68,68,0.45)',r:7, blur:0, pai:4,
   nameRU:'Периапик. поражение ≥5мм', nameEN:'Periapical lesion ≥5mm',
   desc:'Выраженный очаг разрежения у верхушки, диаметр ≥5мм. Возможна рентген. киста (склеротический ободок) или гранулёма. Дифференциация только гистологически.',
   ref:'Natkin E et al. Oral Surg. 1984;57(1):82-94. PMID:6364008'},
  {key:'lesion_severe',label:'ПП>10', color:'rgba(220,38,38,0.5)', r:10,blur:1, pai:5,
   nameRU:'Обширное поражение >10мм', nameEN:'Severe lesion >10mm',
   desc:'Крупный очаг разрежения >10мм, возможно с обострением. Может быть рентген. киста, кератокиста или одонтогенная опухоль. Показана КЛКТ.',
   ref:'Ørstavik D. J Endod. 1986;12(4):167-71. PMID:3457698'}
];
// Migration map for old periapical keys → new keys
const _PERIAP_MIGRATE = {granuloma:'lesion_small', cyst:'lesion_large', abscess:'lesion_severe'};
function _periapKey(type) { return _PERIAP_MIGRATE[type] || type; }

const TWI_STATES = [
  {key:0, label:'0', color:'none',      nameRU:'Нет потери',   nameEN:'No loss'},
  {key:1, label:'1', color:'var(--yel)', nameRU:'Потеря эмали', nameEN:'Enamel loss'},
  {key:2, label:'2', color:'var(--gold)',nameRU:'Эмаль+дентин', nameEN:'Enamel+dentin'},
  {key:3, label:'3', color:'var(--red)', nameRU:'⅓-⅔ коронки', nameEN:'1/3-2/3 crown'},
  {key:4, label:'4', color:'var(--red)', nameRU:'>⅔ / пульпа', nameEN:'>2/3 / pulp'}
];

const FURCATION_STATES = [
  {key:0, label:'—',  color:'none',                nameRU:'Норма',                    nameEN:'Normal'},
  {key:1, label:'Ф1', color:'var(--yel)',           nameRU:'Glickman I (начальная)',   nameEN:'Glickman I (incipient)'},
  {key:2, label:'Ф2', color:'var(--gold)',          nameRU:'Glickman II (неполная)',   nameEN:'Glickman II (partial)'},
  {key:3, label:'Ф3', color:'var(--red)',           nameRU:'Glickman III (сквозная)',  nameEN:'Glickman III (through)'},
  {key:4, label:'Ф4', color:'rgba(220,38,38,0.8)', nameRU:'Glickman IV (обнажённая)', nameEN:'Glickman IV (exposed)'}
];

const LATERAL_STATES = [
  {key:'none',       label:'—',  color:'none',                    nameRU:'Нет дефекта',          nameEN:'None'},
  {key:'vertical',   label:'V↓', color:'rgba(168,85,247,0.6)',    nameRU:'Вертикальный дефект',  nameEN:'Vertical defect'},
  {key:'horizontal', label:'H—', color:'rgba(59,130,246,0.6)',    nameRU:'Горизонтальная потеря', nameEN:'Horizontal loss'},
  {key:'crater',     label:'U',  color:'rgba(234,179,8,0.6)',     nameRU:'Кратер',               nameEN:'Crater'}
];

const ENDOPERIO_STATES = [
  {key:'none',      label:'—', color:'none',                    nameRU:'Нет',                     nameEN:'None'},
  {key:'j_shaped',  label:'J', color:'rgba(239,68,68,0.6)',     nameRU:'J-образное (эндо→перио)', nameEN:'J-shaped (endo→perio)'},
  {key:'halo',      label:'◯', color:'rgba(249,115,22,0.5)',    nameRU:'Halo (кольцеобразное)',   nameEN:'Halo (ring-shaped)'},
  {key:'combined',  label:'⊕', color:'rgba(220,38,38,0.6)',     nameRU:'Комбинированное',         nameEN:'Combined endo-perio'}
];

// ═══ Fracture classification (AAE + Andreasen) ═══
const FRACTURE_STATES = [
  {key:'none',          label:'—',    color:'none',                   nameRU:'Нет перелома',                  nameEN:'No fracture'},
  {key:'vrf',           label:'VRF',  color:'rgba(220,38,38,0.7)',    nameRU:'Верт. перелом корня (VRF)',     nameEN:'Vertical root fracture',
   desc:'Линия перелома ∥ оси корня. Признаки: halo, J-резорбция, расш. PDL. Прогноз — экстракция.',
   ref:'Tamse A. J Endod 2006;32(4):287-92'},
  {key:'hrz_cervical',  label:'H⅓↑',  color:'rgba(239,68,68,0.65)',   nameRU:'Горизонт. (шеечн. ⅓)',         nameEN:'Horizontal fracture (cervical)',
   desc:'Шеечная ⅓ корня. Неблагоприятный прогноз (55-73% неудач), смещение фрагмента.',
   ref:'Andreasen JO. Dent Traumatol 2004;20(6):298-305'},
  {key:'hrz_middle',    label:'H⅓M',  color:'rgba(249,115,22,0.6)',   nameRU:'Горизонт. (средн. ⅓)',         nameEN:'Horizontal fracture (middle)',
   desc:'Средняя ⅓ корня. Умеренный прогноз. Шинирование 4 нед.',
   ref:'Andreasen JO. Dent Traumatol 2004;20(6):298-305'},
  {key:'hrz_apical',    label:'H⅓A',  color:'rgba(234,179,8,0.6)',    nameRU:'Горизонт. (апикальн. ⅓)',      nameEN:'Horizontal fracture (apical)',
   desc:'Апикальная ⅓. Благоприятный прогноз (заживление каллюсом ~77%).',
   ref:'Andreasen JO. Dent Traumatol 2004;20(6):298-305'},
];

const CROWN_FRACTURE_STATES = [
  {key:'none',    label:'—',  color:'none',                   nameRU:'Нет',       nameEN:'None'},
  {key:'split',   label:'SP', color:'rgba(220,38,38,0.7)',    nameRU:'Раскол (split tooth)', nameEN:'Split tooth',
   desc:'Полный раскол зуба через пульповую камеру. Рентгенологически: щель между фрагментами.'},
  {key:'cracked', label:'CK', color:'rgba(249,115,22,0.5)',   nameRU:'Трещина (подозрение)', nameEN:'Cracked tooth (suspected)',
   desc:'Подозрение на неполную трещину. OPG: расш. PDL, одностор. нарушение lamina dura.'},
];

/* ═══ Root shape builders (from Vertucci prototype) ═══ */
function buildTaperedRoot(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2, htw = tw/2;
  const nl = rx - hbw, nr = rx + hbw;
  const al = rx + cv - htw, ar = rx + cv + htw;
  const ml = rx + cv*0.4 - (hbw*0.65 + htw*0.35);
  const mr = rx + cv*0.4 + (hbw*0.65 + htw*0.35);
  const d = `M ${nl} ${ny} C ${nl} ${my-5}, ${ml} ${my}, ${al} ${ay-tw}
    A ${htw+0.5} ${tw} 0 0 1 ${ar} ${ay-tw}
    C ${mr} ${my}, ${nr} ${my-5}, ${nr} ${ny} Z`;
  return {d, apexX:rx+cv, apexY:ay, midX:rx+cv*0.4, midY:my};
}
function buildEllipticalRoot(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2, htw = tw/2;
  const wm = bw * 0.55;
  const nl = rx - hbw, nr = rx + hbw;
  const al = rx + cv - htw, ar = rx + cv + htw;
  const d = `M ${nl} ${ny} C ${nl-1} ${my-10}, ${rx+cv*0.3-wm} ${my}, ${al} ${ay-tw}
    A ${htw+0.5} ${tw} 0 0 1 ${ar} ${ay-tw}
    C ${rx+cv*0.3+wm} ${my}, ${nr+1} ${my-10}, ${nr} ${ny} Z`;
  return {d, apexX:rx+cv, apexY:ay, midX:rx+cv*0.3, midY:my};
}
function buildOvoidRoot(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2, htw = tw/2;
  const wm = bw * 0.6;
  const nl = rx - hbw, nr = rx + hbw;
  const al = rx + cv - htw, ar = rx + cv + htw;
  const d = `M ${nl} ${ny} C ${nl-2} ${my-12}, ${rx+cv*0.3-wm} ${my+5}, ${al} ${ay-tw}
    A ${htw+1} ${tw+1} 0 0 1 ${ar} ${ay-tw}
    C ${rx+cv*0.3+wm} ${my+5}, ${nr+2} ${my-12}, ${nr} ${ny} Z`;
  return {d, apexX:rx+cv, apexY:ay, midX:rx+cv*0.3, midY:my};
}
function buildRibbonRoot(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2, htw = tw/2;
  const nl = rx - hbw, nr = rx + hbw;
  const al = rx + cv - htw, ar = rx + cv + htw;
  const fw = bw * 0.45;
  const d = `M ${nl} ${ny}
    C ${nl} ${my-8}, ${rx+cv*0.4-fw} ${my-2}, ${rx+cv*0.5-fw*0.6} ${my+8}
    C ${rx+cv*0.6-fw*0.3} ${my+15}, ${al-1} ${ay-tw*2}, ${al} ${ay-tw}
    A ${htw+0.5} ${tw} 0 0 1 ${ar} ${ay-tw}
    C ${ar+1} ${ay-tw*2}, ${rx+cv*0.6+fw*0.3} ${my+15}, ${rx+cv*0.5+fw*0.6} ${my+8}
    C ${rx+cv*0.4+fw} ${my-2}, ${nr} ${my-8}, ${nr} ${ny} Z`;
  return {d, apexX:rx+cv, apexY:ay, midX:rx+cv*0.4, midY:my};
}
function buildCShapedRoot(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2;
  const nl = rx - hbw, nr = rx + hbw;
  const iw = bw * 0.35;
  const d = `M ${nl} ${ny}
    C ${nl-1} ${my}, ${nl+2} ${ay}, ${rx-2} ${ay}
    A 3 3 0 0 1 ${rx+2} ${ay}
    C ${nr-2} ${ay}, ${nr+1} ${my}, ${nr} ${ny}
    L ${rx+iw} ${ny}
    C ${rx+iw} ${my+5}, ${rx+3} ${ay-8}, ${rx} ${ay-5}
    C ${rx-3} ${ay-8}, ${rx-iw} ${my+5}, ${rx-iw} ${ny} Z`;
  return {d, apexX:rx, apexY:ay, midX:rx, midY:my};
}
function buildFused2Root(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2, htw = tw/2;
  const g = bw * 0.08;
  const nl = rx - hbw, nr = rx + hbw;
  const al = rx + cv - htw, ar = rx + cv + htw;
  const d = `M ${nl} ${ny}
    C ${nl} ${my-5}, ${rx+cv*0.3-hbw*0.6} ${my+5}, ${al} ${ay-tw}
    A ${htw+0.5} ${tw} 0 0 1 ${rx+cv-g} ${ay-tw+1}
    L ${rx+cv} ${ay-tw-g*3}
    L ${rx+cv+g} ${ay-tw+1}
    A ${htw+0.5} ${tw} 0 0 1 ${ar} ${ay-tw}
    C ${rx+cv*0.3+hbw*0.6} ${my+5}, ${nr} ${my-5}, ${nr} ${ny} Z`;
  return {d, apexX:rx+cv, apexY:ay, midX:rx+cv*0.3, midY:my};
}
function buildConicalRoot(rx, ny, ay, my, bw, tw, cv) {
  const hbw = bw/2, htw = tw/2 + 1;
  const nl = rx - hbw, nr = rx + hbw;
  const al = rx + cv - htw, ar = rx + cv + htw;
  const d = `M ${nl} ${ny}
    C ${nl+1} ${my-3}, ${al-2} ${my+8}, ${al} ${ay-tw}
    A ${htw+1} ${tw+2} 0 0 1 ${ar} ${ay-tw}
    C ${ar+2} ${my+8}, ${nr-1} ${my-3}, ${nr} ${ny} Z`;
  return {d, apexX:rx+cv, apexY:ay, midX:rx+cv*0.3, midY:my};
}

function buildRootContour(root, neckY, cx) {
  const {l, bw, tw, cv, ox, shape} = root;
  const rx = cx + ox;
  const apexY = neckY + l;
  const midY = neckY + l * 0.5;
  const builders = {
    tapered: buildTaperedRoot, elliptical: buildEllipticalRoot,
    ovoid: buildOvoidRoot, ribbon: buildRibbonRoot,
    c_shaped: buildCShapedRoot, fused_2: buildFused2Root, conical: buildConicalRoot
  };
  return (builders[shape] || buildTaperedRoot)(rx, neckY, apexY, midY, bw, tw, cv);
}

function buildFurcation(roots, neckY, cx) {
  if (roots.length < 2) return '';
  let paths = '';
  for (let i = 0; i < roots.length - 1; i++) {
    const r1 = roots[i], r2 = roots[i+1];
    const x1 = cx + r1.ox + r1.bw/2;
    const x2 = cx + r2.ox - r2.bw/2;
    const furcY = neckY + Math.min(r1.l, r2.l) * 0.22;
    const cpY = furcY + Math.min(r1.l, r2.l) * 0.14;
    const midX = (x1 + x2) / 2;
    paths += `M ${x1} ${neckY} Q ${midX} ${cpY}, ${x2} ${neckY} `;
  }
  return paths;
}

function buildSingleCanalPath(root, neckY, cx, dx) {
  const rx = cx + root.ox;
  const apexY = neckY + root.l;
  const oX = rx + dx * 0.5;
  const oY = neckY + 3;
  const mX = rx + root.cv * 0.4 + dx * 0.6;
  const mY = neckY + root.l * 0.5;
  const fX = rx + root.cv + dx * 0.8;
  const fY = apexY - root.tw * 0.5;
  return {
    d: `M ${oX} ${oY} C ${oX} ${mY-10}, ${mX} ${mY}, ${fX} ${fY}`,
    foramenX:fX, foramenY:fY, orificeX:oX, orificeY:oY
  };
}

function getCanalPaths(root, neckY, cx, vertucciType) {
  const rx = cx + root.ox;
  const apexY = neckY + root.l;
  const fYbase = apexY - root.tw * 0.5;
  const paths = [];

  if (vertucciType === 'I') {
    paths.push(buildSingleCanalPath(root, neckY, cx, 0));
  } else if (vertucciType === 'II') {
    const o1X = rx - 3, o2X = rx + 3;
    const mrgY = neckY + root.l * 0.65;
    const fX = rx + root.cv, fY = fYbase;
    paths.push({d:`M ${o1X} ${neckY+3} C ${o1X} ${mrgY-10}, ${fX-1} ${mrgY}, ${fX} ${fY}`, foramenX:fX,foramenY:fY,orificeX:o1X,orificeY:neckY+3});
    paths.push({d:`M ${o2X} ${neckY+3} C ${o2X} ${mrgY-10}, ${fX+1} ${mrgY}, ${fX} ${fY}`, foramenX:fX,foramenY:fY,orificeX:o2X,orificeY:neckY+3});
  } else if (vertucciType === 'III') {
    const sY = neckY + root.l * 0.3, mY = neckY + root.l * 0.7;
    const fX = rx + root.cv, fY = fYbase;
    paths.push({d:`M ${rx} ${neckY+3} C ${rx} ${sY}, ${rx-4} ${(sY+mY)/2}, ${rx-3} ${mY} C ${rx-2} ${mY+5}, ${fX} ${mY+8}, ${fX} ${fY}`, foramenX:fX,foramenY:fY,orificeX:rx,orificeY:neckY+3});
    paths.push({d:`M ${rx} ${neckY+3} C ${rx} ${sY}, ${rx+4} ${(sY+mY)/2}, ${rx+3} ${mY} C ${rx+2} ${mY+5}, ${fX} ${mY+8}, ${fX} ${fY}`, foramenX:fX,foramenY:fY,orificeX:rx,orificeY:neckY+3,ghost:true});
  } else if (vertucciType === 'IV') {
    paths.push(buildSingleCanalPath(root, neckY, cx, -3));
    paths.push(buildSingleCanalPath(root, neckY, cx, 3));
  } else if (vertucciType === 'V') {
    const sY = neckY + root.l * 0.6;
    const f1X = rx + root.cv - 3, f2X = rx + root.cv + 3;
    paths.push({d:`M ${rx} ${neckY+3} C ${rx} ${sY-10}, ${f1X} ${sY}, ${f1X} ${fYbase}`, foramenX:f1X,foramenY:fYbase,orificeX:rx,orificeY:neckY+3});
    paths.push({d:`M ${rx} ${neckY+3} C ${rx} ${sY-10}, ${f2X} ${sY}, ${f2X} ${fYbase}`, foramenX:f2X,foramenY:fYbase,orificeX:rx,orificeY:neckY+3});
  } else if (vertucciType === 'VI') {
    const o1X = rx - 3, o2X = rx + 3;
    const mrgY = neckY + root.l * 0.38, sY = neckY + root.l * 0.62;
    const f1X = rx + root.cv - 3, f2X = rx + root.cv + 3;
    paths.push({d:`M ${o1X} ${neckY+3} C ${o1X} ${mrgY-5}, ${rx} ${mrgY+2}, ${rx} ${(mrgY+sY)/2} C ${rx} ${sY}, ${f1X} ${sY+5}, ${f1X} ${fYbase}`, foramenX:f1X,foramenY:fYbase,orificeX:o1X,orificeY:neckY+3});
    paths.push({d:`M ${o2X} ${neckY+3} C ${o2X} ${mrgY-5}, ${rx} ${mrgY+2}, ${rx} ${(mrgY+sY)/2} C ${rx} ${sY}, ${f2X} ${sY+5}, ${f2X} ${fYbase}`, foramenX:f2X,foramenY:fYbase,orificeX:o2X,orificeY:neckY+3});
  } else if (vertucciType === 'VII') {
    const s1Y = neckY + root.l * 0.22, mY = neckY + root.l * 0.45, s2Y = neckY + root.l * 0.68;
    const f1X = rx + root.cv - 3, f2X = rx + root.cv + 3;
    paths.push({d:`M ${rx} ${neckY+3} C ${rx-3} ${s1Y}, ${rx-2} ${mY}, ${rx} ${(mY+s2Y)/2} C ${rx-2} ${s2Y}, ${f1X} ${s2Y+5}, ${f1X} ${fYbase}`, foramenX:f1X,foramenY:fYbase,orificeX:rx,orificeY:neckY+3});
    paths.push({d:`M ${rx} ${neckY+3} C ${rx+3} ${s1Y}, ${rx+2} ${mY}, ${rx} ${(mY+s2Y)/2} C ${rx+2} ${s2Y}, ${f2X} ${s2Y+5}, ${f2X} ${fYbase}`, foramenX:f2X,foramenY:fYbase,orificeX:rx,orificeY:neckY+3,ghost:true});
  } else if (vertucciType === 'VIII') {
    [-5,0,5].forEach(dx => paths.push(buildSingleCanalPath(root, neckY, cx, dx)));
  }
  return paths;
}

/* ═══ Miniature rootSvg for formula cells (Vertucci-aware) ═══ */
function rootSvg(fdi, status, canalData, fileId, rawStatus) {
    const typeId = FDI_TO_TYPE[fdi];
    if (!typeId) return '';
    const tooth = TOOTH_LIBRARY[typeId];
    if (!tooth) return '';

    // Missing/absent — no tooth, no root (spacer to keep row height)
    if (['missing','absent'].includes(status)) {
        const spH = Math.round((tooth.svg?.H || 50) * 0.65);
        const spW = Math.round((tooth.svg?.W || 20) * 0.65);
        return `<svg class="root-svg" viewBox="0 0 ${spW} ${spH}" width="${spW}" height="${spH}" style="opacity:0"></svg>`;
    }
    // Bridge/pontic/bar/cantilever — no root, show dashed ghost outline to indicate absence
    if (status === 'bridge' || status === 'bar' || status === 'cantilever') {
        const {W, H} = tooth.svg || {W:20, H:50};
        const spH = Math.round(H * 0.65), spW = Math.round(W * 0.65);
        const cx = spW / 2;
        return `<svg class="root-svg" viewBox="0 0 ${spW} ${spH}" width="${spW}" height="${spH}"${tooth.upper ? ' style="transform:scaleY(-1)"' : ''}>` +
            `<line x1="${cx}" y1="2" x2="${cx}" y2="${spH-2}" stroke="rgba(120,120,140,0.15)" stroke-width="0.5" stroke-dasharray="2,3"/>` +
            `</svg>`;
    }

    // Implant — draw implant SVG instead of root
    const isImplant = ['implant','impl_fixture','impl_cover','impl_healing','impl_abutment','impl_temp_abut','impl_provisional','impl_restored'].includes(status);
    if (isImplant) {
        const up = tooth.upper;
        const implH = 50, implW = 20;
        let s = `<svg class="root-svg" viewBox="0 0 ${implW} ${implH}" width="${Math.round(implW*0.8)}" height="${Math.round(implH*0.8)}"`;
        if (up) s += ` style="transform:scaleY(-1)"`;
        s += '>';
        const cx = implW/2;
        s += `<path d="M ${cx-5},2 L ${cx+5},2 L ${cx+3},${implH-8} L ${cx-3},${implH-8} Z" fill="rgba(160,170,190,0.25)" stroke="rgba(160,170,190,0.5)" stroke-width="0.8"/>`;
        for (let y = 8; y < implH - 12; y += 5) {
            const w = 5 - (y / implH) * 2;
            s += `<line x1="${cx-w}" y1="${y}" x2="${cx+w}" y2="${y}" stroke="rgba(160,170,190,0.35)" stroke-width="0.6"/>`;
        }
        if (['impl_abutment','impl_temp_abut','impl_provisional','impl_restored','impl_cover'].includes(status)) {
            s += `<rect x="${cx-3}" y="0" width="6" height="4" rx="1" fill="rgba(160,170,190,0.3)" stroke="rgba(160,170,190,0.4)" stroke-width="0.5"/>`;
        }
        s += `<circle cx="${cx}" cy="${implH-6}" r="2" fill="rgba(160,170,190,0.2)" stroke="rgba(160,170,190,0.35)" stroke-width="0.5"/>`;
        s += '</svg>';
        return s;
    }

    // Determine variant from arenaRootData or default
    const rd = fileId ? ((arenaRootData[fileId] || {})[fdi] || {}) : {};
    const variant = (rd.variant ? tooth.variants.find(v => v.id === rd.variant) : null) ||
                    tooth.variants.find(v => v.isDefault) || tooth.variants[0];
    const vertucciOverrides = rd.vertucci || variant.defaultVertucci;
    const fillStates = rd.fillStates || {};

    const {vb, W, H, ny, cx} = tooth.svg;
    const isUpper = tooth.upper;
    // Check for endo/post in layered teeth (e.g. "endo+post+crowned" has primary status "crowned")
    const rawParts = rawStatus ? rawStatus.split('+').map(p => p.split(':')[0]) : [];
    const hasEndoLayer = rawParts.includes('endo');
    const hasPostLayer = rawParts.includes('post') || status === 'post';
    const isEndo = status === 'endo' || hasEndoLayer || (canalData && canalData.length > 0);
    const scale = 0.65;
    const svgW = Math.round(W * scale);
    const svgH = Math.round(H * scale);

    let inner = '';

    // Furcation
    if (variant.roots.length > 1) {
        const fp = buildFurcation(variant.roots, ny, cx);
        if (fp) inner += `<path d="${fp}" fill="none" stroke="rgba(170,140,90,0.35)" stroke-width="0.6"/>`;
    }

    // Each root (apply cvOverrides for dilaceration)
    const cvOvr = rd.cvOverrides || {};
    const removedRoots = rd.removedRoots || {};
    variant.roots.forEach((root, ri) => {
        const effRoot = cvOvr[ri] !== undefined ? {...root, cv: cvOvr[ri]} : root;
        const contour = buildRootContour(effRoot, ny, cx);
        // Hemisection: removed root → ghost dashed outline, skip canals/pathology
        if (removedRoots[ri]) {
            inner += `<path d="${contour.d}" fill="none" stroke="rgba(239,68,68,0.2)" stroke-width="0.6" stroke-dasharray="3,3" opacity="0.5"/>`;
            // ✂ marker at root center
            const rcx = cx + (effRoot.ox||0);
            const rcy = ny + effRoot.l * 0.5;
            inner += `<text x="${rcx}" y="${rcy}" style="font-size:8px;fill:rgba(239,68,68,0.5);text-anchor:middle;dominant-baseline:middle;pointer-events:none">✂</text>`;
            return; // skip all canal/pathology rendering for this root
        }
        inner += `<path d="${contour.d}" fill="rgba(210,195,165,0.10)" stroke="rgba(170,140,90,0.45)" stroke-width="0.8"/>`;

        // Canal paths
        const vType = (vertucciOverrides[ri] !== undefined) ? vertucciOverrides[ri] : (variant.defaultVertucci[ri] || 'I');
        const cPaths = getCanalPaths(effRoot, ny, cx, vType);

        cPaths.forEach((cp, ci) => {
            const stKey = `${ri}_${ci}`;
            const stIdx = fillStates[stKey] || 0;
            const st = FILL_STATES[stIdx];

            if (!isEndo) {
                // Intact display — dashed topology
                if (cp.ghost) return;
                inner += `<path d="${cp.d}" fill="none" stroke="rgba(170,140,90,0.25)" stroke-width="0.7"
                    stroke-dasharray="3,2" opacity="0.45"/>`;
            } else if (cp.ghost) {
                inner += `<path d="${cp.d}" fill="none" stroke="${st.color}" stroke-width="0.5"
                    stroke-dasharray="2,2" opacity="0.3"/>`;
            } else {
                const endoUnk = isEndo && st.key === 'unknown';
                const cCol = endoUnk ? '#22c55e' : st.color;
                const sw = (st.key === 'unknown' && !endoUnk) ? 0.8 : 1.5;
                if (st.lengthFrac < 1.0 && st.key !== 'unknown') {
                    inner += `<path d="${cp.d}" fill="none" stroke="rgba(85,85,85,0.25)" stroke-width="0.5"
                        stroke-dasharray="3,2"/>`;
                    inner += `<path d="${cp.d}" fill="none" stroke="${cCol}" stroke-width="${sw}"
                        pathLength="100" stroke-dasharray="${st.lengthFrac*100} ${100}"/>`;
                } else if (st.overfill) {
                    inner += `<path d="${cp.d}" fill="none" stroke="${cCol}" stroke-width="${sw}"/>`;
                    inner += `<line x1="${cp.foramenX}" y1="${cp.foramenY}" x2="${cp.foramenX}" y2="${cp.foramenY+6}"
                        stroke="${cCol}" stroke-width="${sw}"/>`;
                    inner += `<circle cx="${cp.foramenX}" cy="${cp.foramenY+6}" r="2.2"
                        fill="${cCol}" opacity="0.5"/>`;
                } else {
                    const dash = endoUnk ? 'stroke-dasharray="4,3"' : (st.dasharray === 'none' ? '' : `stroke-dasharray="${st.dasharray}"`);
                    inner += `<path d="${cp.d}" fill="none" stroke="${cCol}" stroke-width="${sw}" ${dash}/>`;
                }
                if (!st.overfill) {
                    inner += `<circle cx="${cp.foramenX}" cy="${cp.foramenY}" r="0.9" fill="${st.color}" opacity="0.6"/>`;
                }
            }
        });
    });

    // Post (штифт) — dark thick line in the main canal
    if (hasPostLayer && variant.roots.length > 0) {
        const mainRoot = variant.roots[0]; // post goes in the main (first) root
        const effMainRoot = (rd.cvOverrides || {})[0] !== undefined ? {...mainRoot, cv: rd.cvOverrides[0]} : mainRoot;
        const postTop = ny + 2;
        const postBot = ny + effMainRoot.l * 0.55; // post goes ~55% into root
        const postCx = cx + (effMainRoot.ox || 0);
        const cv = effMainRoot.cv || 0;
        const midShift = cv * 0.8;
        inner += `<line x1="${postCx + midShift*0.2}" y1="${postTop}" x2="${postCx + midShift*0.5}" y2="${postBot}" stroke="rgba(80,70,50,0.9)" stroke-width="3" stroke-linecap="round"/>`;
        inner += `<line x1="${postCx + midShift*0.2}" y1="${postTop}" x2="${postCx + midShift*0.5}" y2="${postBot}" stroke="rgba(160,140,100,0.4)" stroke-width="1.5" stroke-linecap="round"/>`;
    }

    // Periapical findings visualization
    const periapData = rd.periapical || {};
    variant.roots.forEach((root, ri) => {
        const pa = periapData[ri];
        if (!pa || pa.type === 'none') return;
        const pState = PERIAPICAL_STATES.find(s => s.key === _periapKey(pa.type));
        if (!pState) return;
        const effRoot2 = (rd.cvOverrides || {})[ri] !== undefined ? {...root, cv: rd.cvOverrides[ri]} : root;
        const contour = buildRootContour(effRoot2, ny, cx);
        if (pState.key === 'widened_pdl') {
            // PDL widening — dashed line ALONG the root contour
            inner += `<path d="${contour.d}" fill="none" stroke="${pState.color}" stroke-width="2.5" stroke-dasharray="2,1.5" opacity="0.8"/>`;
        } else if (pState.r > 0) {
            // Periapical lesion — circle at apex, size by PAI
            const r = pState.r * 0.6;
            if (pState.blur > 0) inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="${r*1.3}" fill="${pState.color}" opacity="0.3" filter="url(#blur1)"/>`;
            inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="${r}" fill="${pState.color}" stroke="rgba(239,68,68,0.6)" stroke-width="0.6"/>`;
        }
    });

    // Furcation involvement — colored arc between roots
    if (variant.roots.length > 1) {
        const furcData = rd.furcation || {};
        for (let fi = 0; fi < variant.roots.length - 1; fi++) {
            const fg = furcData[fi]?.grade || 0;
            if (fg === 0) continue;
            const fState = FURCATION_STATES[fg];
            const r1 = variant.roots[fi], r2 = variant.roots[fi+1];
            const fx = cx + ((r1.ox||0) + (r2.ox||0)) / 2;
            const fy = ny + Math.min(r1.l, r2.l) * 0.15;
            const fr = fg >= 3 ? 5 : 3;
            inner += `<circle cx="${fx}" cy="${fy}" r="${fr * 0.5}" fill="${fState.color}" opacity="0.7"/>`;
        }
    }

    // Lateral bone defects — colored marks along root sides
    const latData = rd.lateral || {};
    variant.roots.forEach((root, ri) => {
        const effR = (rd.cvOverrides || {})[ri] !== undefined ? {...root, cv: rd.cvOverrides[ri]} : root;
        const rcx = cx + (effR.ox || 0);
        for (const side of ['m', 'd']) {
            const ld = latData[`${ri}_${side}`];
            if (!ld || ld.type === 'none') continue;
            const ls = LATERAL_STATES.find(s => s.key === ld.type);
            if (!ls) continue;
            const sx = side === 'm' ? rcx - (effR.bw||10)*0.4 : rcx + (effR.bw||10)*0.4;
            const sy1 = ny + 4, sy2 = ny + effR.l * 0.7;
            if (ld.type === 'vertical') {
                inner += `<line x1="${sx}" y1="${sy1}" x2="${sx - (side==='m'?2:-2)}" y2="${sy2}" stroke="${ls.color}" stroke-width="1.5" opacity="0.7"/>`;
            } else if (ld.type === 'horizontal') {
                inner += `<line x1="${sx}" y1="${sy1}" x2="${sx}" y2="${sy1 + effR.l*0.3}" stroke="${ls.color}" stroke-width="2" opacity="0.6"/>`;
            } else {
                inner += `<line x1="${sx}" y1="${sy1}" x2="${sx}" y2="${sy2}" stroke="${ls.color}" stroke-width="1.2" stroke-dasharray="2,1.5" opacity="0.6"/>`;
            }
        }
    });

    // Endo-perio J-shaped / halo lesions
    const epData = rd.endoPerio || {};
    variant.roots.forEach((root, ri) => {
        const ep = epData[ri];
        if (!ep || ep.type === 'none') return;
        const eps = ENDOPERIO_STATES.find(s => s.key === ep.type);
        if (!eps) return;
        const effR = (rd.cvOverrides || {})[ri] !== undefined ? {...root, cv: rd.cvOverrides[ri]} : root;
        const contour = buildRootContour(effR, ny, cx);
        if (ep.type === 'j_shaped') {
            // J-shape: line from apex curving up along mesial side to neck
            const ax = contour.apexX, ay = contour.apexY;
            const rcx2 = cx + (effR.ox||0);
            inner += `<path d="M ${ax},${ay} Q ${rcx2 - (effR.bw||10)*0.5},${ny + effR.l*0.5} ${rcx2 - (effR.bw||10)*0.3},${ny+4}" fill="none" stroke="${eps.color}" stroke-width="1.8" stroke-dasharray="3,2" opacity="0.7"/>`;
        } else if (ep.type === 'halo') {
            inner += `<path d="${contour.d}" fill="none" stroke="${eps.color}" stroke-width="2" opacity="0.4"/>`;
        } else {
            // combined: circle at apex + line to neck
            inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="3" fill="${eps.color}" opacity="0.5"/>`;
            const rcx2 = cx + (effR.ox||0);
            inner += `<line x1="${contour.apexX}" y1="${contour.apexY}" x2="${rcx2}" y2="${ny+4}" stroke="${eps.color}" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>`;
        }
    });

    // Tooth wear (TWI) — line at crown level showing wear severity
    const wearData2 = rd.wear || {};
    if (wearData2.twi >= 2) {
        const wLine = ny - 2;
        const wLen = tooth.svg.nw * 0.7;
        const wColor = wearData2.twi >= 3 ? 'var(--red)' : 'var(--gold)';
        const wSw = wearData2.twi >= 3 ? 2 : 1.2;
        inner += `<line x1="${cx - wLen/2}" y1="${wLine}" x2="${cx + wLen/2}" y2="${wLine}" stroke="${wColor}" stroke-width="${wSw}" stroke-linecap="round" opacity="0.7"/>`;
    }

    // Secondary caries indicator — orange dashed line at neck level
    const hasCariesLayer = rawStatus ? rawStatus.split('+').some(p => p.split(':')[0] === 'caries') : status === 'caries';
    if (hasCariesLayer) {
        const cLine = ny + 1;
        const cLen = tooth.svg.nw * 0.6;
        inner += `<line x1="${cx - cLen/2}" y1="${cLine}" x2="${cx + cLen/2}" y2="${cLine}" stroke="rgba(251,146,60,0.7)" stroke-width="1.5" stroke-dasharray="2,1.5" stroke-linecap="round"/>`;
    }

    // ── Fracture visualization (AAE + Andreasen) ──
    const fracData = rd.fracture || {};
    variant.roots.forEach((root, ri) => {
        const fr = fracData[ri];
        if (!fr || fr.type === 'none') return;
        const fState = FRACTURE_STATES.find(s => s.key === fr.type);
        if (!fState) return;
        const effR = (rd.cvOverrides || {})[ri] !== undefined ? {...root, cv: rd.cvOverrides[ri]} : root;
        const rcx = cx + (effR.ox || 0);
        if (fr.type === 'vrf') {
            // VRF: zigzag line along root axis
            const startY = ny + effR.l * 0.15;
            const endY = ny + effR.l * 0.85;
            const steps = 6;
            const stepH = (endY - startY) / steps;
            const zw = (effR.bw || 10) * 0.12;
            let d = `M ${rcx},${startY}`;
            for (let i = 1; i <= steps; i++) {
                const zx = rcx + (i % 2 === 0 ? -zw : zw);
                d += ` L ${zx},${startY + stepH * i}`;
            }
            inner += `<path d="${d}" fill="none" stroke="${fState.color}" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>`;
        } else {
            // Horizontal fracture: line across root at cervical/middle/apical third
            let fracY;
            if (fr.type === 'hrz_cervical') fracY = ny + effR.l * 0.2;
            else if (fr.type === 'hrz_middle') fracY = ny + effR.l * 0.5;
            else fracY = ny + effR.l * 0.8;
            const halfW = (effR.bw || 10) * 0.45;
            inner += `<line x1="${rcx - halfW}" y1="${fracY}" x2="${rcx + halfW}" y2="${fracY}" stroke="${fState.color}" stroke-width="1.8" stroke-dasharray="3,1.5" opacity="0.8"/>`;
        }
    });
    // Crown fracture (tooth-level)
    const cfData = rd.crownFracture;
    if (cfData && cfData.type && cfData.type !== 'none') {
        const cfs = CROWN_FRACTURE_STATES.find(s => s.key === cfData.type);
        if (cfs) {
            const crownTop = ny - 8;
            if (cfData.type === 'split') {
                inner += `<line x1="${cx}" y1="${crownTop}" x2="${cx}" y2="${ny}" stroke="${cfs.color}" stroke-width="1.8" opacity="0.8"/>`;
            } else {
                inner += `<line x1="${cx - 2}" y1="${crownTop}" x2="${cx + 1}" y2="${ny}" stroke="${cfs.color}" stroke-width="1.2" stroke-dasharray="2,2" opacity="0.6"/>`;
            }
        }
    }

    const defs = '<defs><filter id="blur1"><feGaussianBlur stdDeviation="1.5"/></filter></defs>';
    // Mesial/distal orientation: Q1/Q4 need horizontal mirror (mesial=right toward midline)
    const needMirrorX = fdi && _isMesialRight(fdi);
    let flipAttr;
    if (needMirrorX && isUpper) {
        flipAttr = `transform="translate(${W},${H}) scale(-1,-1)"`;
    } else if (needMirrorX) {
        flipAttr = `transform="translate(${W},0) scale(-1,1)"`;
    } else if (isUpper) {
        flipAttr = `transform="translate(0,${H}) scale(1,-1)"`;
    } else {
        flipAttr = '';
    }
    return `<svg class="root-svg" width="${svgW}" height="${svgH}" viewBox="${vb}"><g ${flipAttr}>${defs}${inner}</g></svg>`;
}

// SVG: квадрат с 4 трапециями + центральный квадратик
// Mesial = toward midline. In formula display:
// Q1/Q4 (right side): center is to the RIGHT → M on RIGHT, D on LEFT
// Q2/Q3 (left side):  center is to the LEFT  → M on LEFT,  D on RIGHT (= SVG default)
function toothSvg(size, sc, fdi) {
    const s = sc || {};
    const rightSide = fdi && (fdi.startsWith('1.') || fdi.startsWith('4.'));
    // Right side: M goes right, D goes left (swap from SVG default)
    const mPts = rightSide ? '24,0 24,24 17,17 17,7' : '0,24 0,0 7,7 7,17';
    const dPts = rightSide ? '0,24 0,0 7,7 7,17' : '24,0 24,24 17,17 17,7';
    return `<svg class="tooth-svg" viewBox="0 0 24 24" width="${size}" height="${size}">` +
        `<polygon class="sf-v${s.v||''}" points="0,0 24,0 17,7 7,7"/>` +
        `<polygon class="sf-d${s.d||''}" points="${dPts}"/>` +
        `<polygon class="sf-l${s.l||''}" points="24,24 0,24 7,17 17,17"/>` +
        `<polygon class="sf-m${s.m||''}" points="${mPts}"/>` +
        `<polygon class="sf-o${s.o||''}" points="7,7 17,7 17,17 7,17"/>` +
        `<line x1="0" y1="0" x2="7" y2="7"/>` +
        `<line x1="24" y1="0" x2="17" y2="7"/>` +
        `<line x1="24" y1="24" x2="17" y2="17"/>` +
        `<line x1="0" y1="24" x2="7" y2="17"/>` +
    `</svg>`;
}

// Аббревиатура: для кариеса/пломбы — из стенок (МО, МОД), иначе — статусная
function surfaceAbbr(status, surfaces) {
    if (['caries','restored'].includes(status) && surfaces) {
        const abbr = SURFACE_ORDER.filter(s => surfaces.includes(s))
            .map(s => SURFACE_NAMES[s].short).join('');
        return abbr || arenaStatusIcon(status);
    }
    return arenaStatusIcon(status);
}

// Tooltip: полное описание при наведении
function surfaceTooltip(fdi, status, surfaces) {
    if (['caries','restored'].includes(status) && surfaces && surfaces.length > 0) {
        const parts = SURFACE_ORDER.filter(s => surfaces.includes(s))
            .map(s => SURFACE_NAMES[s].full);
        const type = status === 'caries' ? 'кариозный дефект' : 'реставрация';
        if (parts.length === 5) return `${fdi}: тотальный ${type}`;
        return `${fdi}: ${parts.join('-')} ${type}`;
    }
    return `${fdi}: ${STATUS_TOOLTIPS[status] || status || 'не задано'}`;
}
