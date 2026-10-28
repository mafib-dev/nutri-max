// Substitui o exercises.js do openGym. Lá o catálogo vinha embutido no app (5.632 exercícios);
// aqui ele vem da tabela public.exercises do Supabase e é registrado com registerCatalogue().
// Os nomes e o formato dos exercícios (n, bp, eq, tg, sm) seguem o que a lógica portada espera.

export const EXDB = []
export const EXIDX = {}
const BUILTIN = new Set()

// Equipamento do free-exercise-db -> vocabulário do openGym.
const EQUIPMENT = {
  barbell: 'barbell',
  'e-z curl bar': 'ez barbell',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  cable: 'cable',
  machine: 'leverage machine',
  'body only': 'body weight',
  bands: 'band',
  'medicine ball': 'medicine ball',
  'exercise ball': 'stability ball',
  'foam roll': 'roller',
}

// Região do corpo a partir do músculo principal (o openGym usa para o incremento padrão).
const BODYPART = {
  trapezius: 'neck', deltoids: 'shoulders', chest: 'chest', 'upper-back': 'back', serratus: 'chest',
  biceps: 'upper arms', triceps: 'upper arms', forearm: 'lower arms',
  abs: 'waist', obliques: 'waist', 'lower-back': 'back',
  gluteal: 'upper legs', quadriceps: 'upper legs', hamstring: 'upper legs', adductors: 'upper legs',
  'hip-flexors': 'upper legs', calves: 'lower legs', tibialis: 'lower legs',
}

/** Converte uma linha de public.exercises para o formato do openGym. */
export function fromExerciseRow(row) {
  const primary = row.primary_muscles?.[0] || ''
  return {
    id: row.id,
    n: row.name_pt || row.name,
    bp: row.category === 'cardio' ? 'cardio' : BODYPART[primary] || '',
    eq: EQUIPMENT[row.equipment] || row.equipment || '',
    tg: primary,
    sm: row.secondary_muscles || [],
    primaries: row.primary_muscles || [],
    secondaries: row.secondary_muscles || [],
    cat: row.category,
    hd: row.force === 'static' || undefined,
    custom: row.source === 'custom' || undefined,
  }
}

/** Troca o catálogo inteiro (por exemplo, depois de carregar do Supabase). */
export function registerCatalogue(rows) {
  EXDB.length = 0
  BUILTIN.clear()
  for (const key of Object.keys(EXIDX)) delete EXIDX[key]
  for (const row of rows) {
    const ex = 'n' in row ? row : fromExerciseRow(row)
    EXDB.push(ex)
    EXIDX[ex.id] = ex
    if (!ex.custom) BUILTIN.add(ex)
  }
}

// Exercícios do próprio usuário, por cima do catálogo (no app eles também vêm de public.exercises).
let customIds = new Set()
export function registerCustom(list) {
  customIds.forEach(id => {
    delete EXIDX[id]
    const builtIn = EXDB.find(ex => ex.id === id)
    if (builtIn) EXIDX[id] = builtIn
  })
  const xs = (Array.isArray(list) ? list : []).filter(e => e && e.id != null)
  customIds = new Set(xs.map(e => e.id))
  xs.forEach(e => { EXIDX[e.id] = e })
}

// Músculos secundários. No openGym há um pequeno acréscimo manual por exercício; aqui não.
export const smOf = ex => (Array.isArray(ex?.sm) ? ex.sm : ex?.sm ? [ex.sm] : [])

// Exercício do catálogo (não um personalizado nem uma cópia): o que se deriva dele pode ficar em cache.
export const isBuiltinEx = ex => BUILTIN.has(ex)

export const exerciseOf = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)

export const isCustomEx = ex => !!ex && typeof ex === 'object' && ex.custom === true

export const isCardio = idOrEx => exerciseOf(idOrEx)?.bp === 'cardio'

export const isHold = idOrEx => !!exerciseOf(idOrEx)?.hd

const ONE_LIMB = /\b(single|one)[\s-]+(arm|leg|hand)\b|\bunilateral\b/i
const NOT_ONE_LIMB = /stretch|\broll(er|ball)?\b|two to one|single leg (push|plank)|leg push up/i
export const isOneLimb = idOrEx => {
  const ex = exerciseOf(idOrEx)
  if (!ex || ex.custom || ex.bp === 'cardio') return false
  return ONE_LIMB.test(ex.n || '') && !NOT_ONE_LIMB.test(ex.n || '')
}

const BODYWEIGHT_EQ = new Set(['body weight', 'band', 'resistance band'])
export const isBodyweightEq = idOrEx => BODYWEIGHT_EQ.has(exerciseOf(idOrEx)?.eq)

const LOADED_EQ = new Set(['barbell', 'ez barbell', 'olympic barbell', 'trap bar', 'dumbbell', 'kettlebell', 'cable', 'leverage machine', 'smith machine', 'sled machine', 'weighted'])
export const isLoadedEq = idOrEx => LOADED_EQ.has(exerciseOf(idOrEx)?.eq)

// Máquinas de assistência: o número menor é a série mais difícil. Regra estreita, como no
// openGym: só máquina cujo nome diz "assisted", ou `assisted` marcado no próprio exercício.
const assistedShape = ex =>
  typeof ex?.assisted === 'boolean' ? ex.assisted : ex?.eq === 'leverage machine' && /\bassist(ed)?\b/i.test(String(ex?.n || ''))

export function isAssisted(idOrEx) {
  if (!idOrEx) return false
  if (typeof idOrEx === 'string') return assistedShape(EXIDX[idOrEx])
  if (typeof idOrEx.assisted === 'boolean') return idOrEx.assisted
  if (typeof idOrEx.target?.assisted === 'boolean') return idOrEx.target.assisted
  const known = idOrEx.id ? EXIDX[idOrEx.id] : null
  return assistedShape(known || idOrEx)
}

export const betterWeight = (idOrEx, a, b) => (isAssisted(idOrEx) ? Math.min(a, b) : Math.max(a, b))

const HEAVY_BP = ['upper legs', 'lower legs', 'back', 'hips', 'glutes']

// Incremento padrão: membros inferiores e costas sobem mais rápido.
export function defaultIncrement(exId, unit) {
  const ex = EXIDX[exId]
  const heavy = ex && HEAVY_BP.includes(ex.bp)
  if (unit === 'lb') return heavy ? 10 : 5
  return heavy ? 5 : 2.5
}
