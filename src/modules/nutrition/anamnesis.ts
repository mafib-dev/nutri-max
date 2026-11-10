// Anamnese nutricional: o que um nutricionista pergunta na primeira consulta (rotina, treino,
// o que a pessoa come hoje, saúde, remédios e suplementos) e o que ele tira disso: avaliação
// (IMC, gasto, metas por kg), alertas que pedem acompanhamento presencial, orientações
// específicas e o protocolo de suplementos.
import { ACTIVITY, ageOn, bmr, type Goal, type NutritionProfile, type Targets } from './targets'

export type Condition =
  | 'diabetes'
  | 'hypertension'
  | 'cholesterol'
  | 'reflux'
  | 'hypothyroid'
  | 'ibs'
  | 'anemia'
  | 'kidney'
  | 'pregnant'
  | 'eating_disorder'

export const CONDITIONS: [Condition, string][] = [
  ['diabetes', 'Diabetes ou pré-diabetes'],
  ['hypertension', 'Pressão alta'],
  ['cholesterol', 'Colesterol ou triglicérides altos'],
  ['reflux', 'Gastrite ou refluxo'],
  ['hypothyroid', 'Hipotireoidismo'],
  ['ibs', 'Intestino irritável'],
  ['anemia', 'Anemia'],
  ['kidney', 'Doença nos rins'],
  ['pregnant', 'Gestante ou amamentando'],
  ['eating_disorder', 'Já tive transtorno alimentar'],
]

export type Work = 'office' | 'remote' | 'physical' | 'shift' | 'student' | 'none'
export type TrainingType = 'strength' | 'endurance' | 'mixed' | 'sport'
export type HabitMeal = 'breakfast' | 'lunch' | 'snacks' | 'dinner' | 'night'

export interface Anamnesis {
  work: Work
  training: { type: TrainingType; minutes: number; fasted: boolean }
  /** Recordatório habitual: o que a pessoa costuma comer hoje, em texto livre. */
  habits: Record<HabitMeal, string>
  hungerPeak: 'morning' | 'afternoon' | 'night' | 'none'
  /** Litros de água por dia hoje; null = não sabe. */
  waterL: number | null
  alcohol: 'never' | 'rare' | 'weekend' | 'often'
  sweets: 'rare' | 'some' | 'daily'
  allergies: string
  conditions: Condition[]
  medications: string
  bowel: 'regular' | 'constipated' | 'loose'
  sleepQuality: 'good' | 'ok' | 'bad'
  supplements: { caffeine: boolean; preworkout: boolean; multivitamin: boolean; omega3: boolean; other: string }
}

export const DEFAULT_ANAMNESIS: Anamnesis = {
  work: 'office',
  training: { type: 'strength', minutes: 60, fasted: false },
  habits: { breakfast: '', lunch: '', snacks: '', dinner: '', night: '' },
  hungerPeak: 'none',
  waterL: null,
  alcohol: 'rare',
  sweets: 'some',
  allergies: '',
  conditions: [],
  medications: '',
  bowel: 'regular',
  sleepQuality: 'ok',
  supplements: { caffeine: false, preworkout: false, multivitamin: false, omega3: false, other: '' },
}

/** Anamnese salva antes de existirem perguntas novas ganha os valores padrão. */
export function withAnamnesisDefaults(a: Partial<Anamnesis> | undefined): Anamnesis {
  const d = DEFAULT_ANAMNESIS
  return {
    ...d,
    ...a,
    training: { ...d.training, ...a?.training },
    habits: { ...d.habits, ...a?.habits },
    supplements: { ...d.supplements, ...a?.supplements },
    conditions: [...(a?.conditions ?? [])],
  }
}

export interface Alert {
  title: string
  text: string
}

/**
 * Situações em que um plano genérico pode fazer mal. O nutricionista não deixaria de atender,
 * mas encaminharia e mudaria a conduta: o app avisa com clareza antes do cardápio.
 */
export function redFlags(a: Anamnesis): Alert[] {
  const out: Alert[] = []
  const has = (c: Condition) => a.conditions.includes(c)
  if (has('kidney'))
    out.push({
      title: 'Doença nos rins',
      text: 'A quantidade de proteína deste plano é a de quem treina e pode ser alta demais para os seus rins. Use o cardápio só como referência de horários e siga a conduta do seu nefrologista e nutricionista.',
    })
  if (has('pregnant'))
    out.push({
      title: 'Gestação ou amamentação',
      text: 'Nessa fase as necessidades de calorias, ferro, ácido fólico e outros nutrientes mudam, e déficit calórico não é indicado. Faça o pré-natal nutricional com um profissional; aqui, mantenha o objetivo em "manter o peso".',
    })
  if (has('eating_disorder'))
    out.push({
      title: 'Histórico de transtorno alimentar',
      text: 'Contar calorias e pesar comida pode reativar o transtorno. Se você sentir culpa, compulsão ou medo de comer, pare de seguir números e procure seu psicólogo e nutricionista.',
    })
  if (has('diabetes') && /insulin|glibencl|glicl|glimepir|sulfonil/i.test(a.medications))
    out.push({
      title: 'Remédio que pode baixar demais a glicose',
      text: 'Com insulina ou sulfonilureia, treino e corte de carboidrato podem causar hipoglicemia. Meça a glicemia antes de treinar, leve um carboidrato rápido (fruta, suco, sachê de mel) e combine qualquer mudança na dieta com seu médico.',
    })
  return out
}

export interface Guidance {
  title: string
  text: string
}

/** Orientações que saem da anamnese: saúde, hábitos, sono, intestino, álcool e treino. */
export function clinicalGuidance(a: Anamnesis, opts: { train: string | null; sleep: string; waterMl: number }): Guidance[] {
  const g: Guidance[] = []
  const has = (c: Condition) => a.conditions.includes(c)
  const t = a.training

  if (t.fasted)
    g.push({
      title: 'Treino em jejum',
      text: 'Treinar em jejum é seguro se você se sente bem, mas costuma render menos em treinos longos ou pesados. Se sentir tontura ou queda de força, coma uma banana ou um café com pão 30 a 40 minutos antes. O café da manhã vira o seu pós-treino.',
    })
  if (t.minutes >= 90 || t.type === 'endurance' || t.type === 'sport')
    g.push({
      title: 'Treinos longos',
      text: 'Em treinos acima de 75 a 90 minutos, ou de corrida, bike e esporte, tome 30 a 60 g de carboidrato por hora durante o treino (isotônico, banana, gel ou água de coco) e beba 400 a 800 ml de água por hora. O pré-treino deste plano já vem com mais carboidrato.',
    })
  if (t.type === 'mixed')
    g.push({
      title: 'Musculação e aeróbico',
      text: 'No mesmo dia, faça a musculação primeiro se o objetivo é ganhar força e massa. Separe os dois por pelo menos 6 horas quando der, e não corte o carboidrato do pré-treino.',
    })

  if (has('hypertension'))
    g.push({
      title: 'Pressão alta',
      text: 'Fique abaixo de 2 g de sódio por dia (cerca de 5 g de sal, uma colher de chá rasa no dia todo). Tire do plano embutidos, temperos prontos, caldos em cubo, salgadinhos e enlatados com sal. Frutas, verduras, feijão e iogurte ajudam a baixar a pressão.',
    })
  if (has('diabetes'))
    g.push({
      title: 'Glicemia',
      text: 'Coma o carboidrato sempre junto de proteína, salada ou feijão, e prefira as versões integrais. Evite açúcar, suco (mesmo natural) e refrigerante. Comece o almoço e o jantar pela salada. O cardápio já põe os integrais na frente.',
    })
  if (has('cholesterol'))
    g.push({
      title: 'Colesterol e triglicérides',
      text: 'Prefira azeite, castanhas, abacate e peixes, e limite frituras, embutidos, queijos amarelos e carne gorda. Aveia todo dia (3 colheres de sopa) e feijão ajudam a baixar o LDL. Triglicérides alto piora muito com açúcar e álcool.',
    })
  if (has('reflux'))
    g.push({
      title: 'Gastrite e refluxo',
      text: 'Refeições menores e mais vezes, sem deitar nas 2 a 3 horas depois de comer. Café, álcool, frituras, pimenta, chocolate, hortelã e frutas ácidas costumam piorar: observe quais pioram para você. O jantar do plano já fica 3 horas antes de dormir.',
    })
  if (has('hypothyroid'))
    g.push({
      title: 'Remédio da tireoide',
      text: 'Tome a levotiroxina em jejum, com água, 30 a 60 minutos antes do café da manhã. Café, leite, soja e suplementos de cálcio ou ferro atrapalham a absorção: deixe cálcio e ferro pelo menos 4 horas longe do remédio.',
    })
  if (has('ibs'))
    g.push({
      title: 'Intestino irritável',
      text: 'Feijão, cebola, alho, leite e algumas frutas podem causar gases e dor. Anote o que piora por 2 semanas. Se os sintomas forem fortes, a dieta com pouco FODMAP funciona bem, mas precisa ser feita com acompanhamento para não ficar restrita demais.',
    })
  if (has('anemia'))
    g.push({
      title: 'Ferro',
      text: 'Coma carne vermelha magra 3 a 4 vezes por semana e feijão todo dia, com uma fruta rica em vitamina C junto (laranja, mexerica, goiaba). Deixe café e chá pelo menos 1 hora longe do almoço e do jantar.',
    })

  if (a.bowel === 'constipated')
    g.push({
      title: 'Intestino preso',
      text: 'Fibra precisa de água para funcionar: aumente as duas juntas. Mamão, ameixa, aveia, linhaça e feijão ajudam. Tente ir ao banheiro no mesmo horário, de preferência depois do café da manhã.',
    })
  else if (a.bowel === 'loose')
    g.push({
      title: 'Intestino solto',
      text: 'Excesso de gordura, álcool, café e adoçantes como sorbitol e xilitol costumam soltar o intestino. Se durar mais de 2 semanas, tiver sangue ou perda de peso sem motivo, procure um médico.',
    })

  const water = a.waterL != null && a.waterL * 1000 < opts.waterMl - 500
  if (water)
    g.push({
      title: 'Água',
      text: `Hoje você bebe cerca de ${a.waterL!.toLocaleString('pt-BR')} L e a meta é ${(opts.waterMl / 1000).toLocaleString('pt-BR')} L. Suba aos poucos: uma garrafa à vista na mesa e um copo a cada refeição já resolvem a maior parte.`,
    })

  const caffeine = a.supplements.caffeine || a.supplements.preworkout
  if (a.sleepQuality === 'bad')
    g.push({
      title: 'Sono',
      text: `Sono ruim aumenta a fome e atrapalha a recuperação.${caffeine ? ' Pare a cafeína pelo menos 6 horas antes de dormir.' : ' Evite café depois das 16h.'} Jantar leve, telas longe na última hora e o mesmo horário todos os dias ajudam.`,
    })

  if (a.alcohol === 'weekend' || a.alcohol === 'often')
    g.push({
      title: 'Álcool',
      text: 'Cada lata de cerveja tem cerca de 150 kcal e o álcool atrapalha a recuperação muscular e o sono. Nos dias em que beber, coma antes, alterne com água e prefira destilados com água com gás ou bebida zero.',
    })
  if (a.sweets === 'daily')
    g.push({
      title: 'Vontade de doce',
      text: 'Não precisa cortar tudo: deixe o doce logo depois do almoço, em porção pequena (um quadrado de chocolate 70%, uma fruta com canela), em vez de beliscar à tarde. Proteína e fibra nas refeições diminuem a vontade.',
    })
  if (a.hungerPeak === 'night')
    g.push({
      title: 'Fome à noite',
      text: 'Se a fome aperta à noite, não economize no café e no almoço: comer pouco de dia é a causa mais comum. Deixe a ceia com proteína (iogurte, ovos) em vez de pular e atacar a geladeira depois.',
    })
  if (a.work === 'shift')
    g.push({
      title: 'Trabalho em turnos',
      text: 'Nos plantões, faça a refeição maior antes de começar e lanches leves com proteína durante. Evite comida pesada entre meia-noite e 6h. Ajuste os horários do plano na consulta para os seus dias de plantão.',
    })
  if (a.allergies.trim())
    g.push({
      title: 'Alergias e intolerâncias',
      text: `Você informou: ${a.allergies.trim()}. Confira se os alimentos do cardápio respeitam isso e marque como "não como" o que precisar sair. Leia sempre o rótulo, que avisa sobre alergênicos.`,
    })
  return g
}

export interface SupplementRow {
  name: string
  dose: string
  when: string
}

/** Protocolo dos suplementos que a pessoa já usa (ou que entram no plano). */
export function supplementProtocol(a: Anamnesis, opts: { weightKg: number | null; whey: { scoops: number; scoopG: number; when: string }; creatine: boolean; train: string | null; sleep: string }): SupplementRow[] {
  const rows: SupplementRow[] = []
  const pregnant = a.conditions.includes('pregnant')
  const kidney = a.conditions.includes('kidney')
  if (opts.whey.scoops)
    rows.push({
      name: 'Whey protein',
      dose: `${opts.whey.scoops} ${opts.whey.scoops === 1 ? 'scoop' : 'scoops'} de ${opts.whey.scoopG} g`,
      when: opts.whey.when === 'post' ? 'Depois do treino (já está no cardápio)' : opts.whey.when === 'breakfast' ? 'No café da manhã (já está no cardápio)' : 'Num lanche (já está no cardápio)',
    })
  if (opts.creatine)
    rows.push({
      name: 'Creatina',
      dose: kidney ? 'Só com liberação do nefrologista' : '3 a 5 g por dia',
      when: 'Todo dia, inclusive sem treino, com qualquer refeição. Sem saturação.',
    })
  if (a.supplements.caffeine || a.supplements.preworkout) {
    const max = pregnant ? 200 : 400
    const dose = opts.weightKg ? `${Math.min(Math.round((opts.weightKg * 3) / 10) * 10, max)} mg (3 mg por kg)` : '3 mg por kg'
    const late = opts.train && toMin(opts.sleep) - toMin(opts.train) < 6 * 60 && toMin(opts.sleep) > toMin(opts.train)
    rows.push({
      name: a.supplements.preworkout ? 'Pré-treino (cafeína)' : 'Cafeína',
      dose: `${dose}, no máximo ${max} mg somando café e pré-treino no dia`,
      when: `30 a 60 minutos antes do treino.${late ? ' Seu treino fica a menos de 6 horas do sono: use metade da dose ou tire nos dias de treino à noite.' : ''}${a.conditions.includes('hypertension') ? ' Com pressão alta, só com liberação do médico.' : ''}`,
    })
  }
  if (a.supplements.multivitamin) rows.push({ name: 'Multivitamínico', dose: '1 dose do rótulo', when: 'Junto com o almoço. Não substitui frutas e verduras.' })
  if (a.supplements.omega3) rows.push({ name: 'Ômega-3', dose: '1 a 2 g de EPA + DHA (veja no rótulo)', when: 'Junto com uma refeição que tenha gordura, para absorver melhor.' })
  if (a.supplements.other.trim()) rows.push({ name: a.supplements.other.trim().slice(0, 60), dose: 'Conforme o rótulo ou a prescrição', when: 'Mostre o rótulo no retorno para revisarmos.' })
  return rows
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

const r1 = (n: number) => Math.round(n * 10) / 10

export interface Assessment {
  bmi: number
  bmiClass: string
  bmr: number
  tdee: number
  /** Meta − gasto: negativo é déficit, positivo é superávit. */
  balance: number
  perKg: { protein: number; carbs: number; fat: number }
  percent: { protein: number; carbs: number; fat: number }
}

const BMI_CLASSES: [number, string][] = [
  [18.5, 'abaixo do peso'],
  [25, 'peso adequado'],
  [30, 'sobrepeso'],
  [35, 'obesidade grau I'],
  [40, 'obesidade grau II'],
  [Infinity, 'obesidade grau III'],
]

/** A avaliação que o nutricionista mostra antes do cardápio: de onde saem os números. */
export function assessment(p: NutritionProfile, weightKg: number | null, targets: Targets, on = new Date()): Assessment | null {
  if (!p.sex || !p.birth_date || !p.height_cm || !weightKg || !p.activity_level) return null
  const h = p.height_cm / 100
  const bmi = weightKg / (h * h)
  const base = bmr(p.sex, weightKg, p.height_cm, ageOn(p.birth_date, on))
  const tdee = base * ACTIVITY[p.activity_level].factor
  const kcal = targets.kcal || 1
  return {
    bmi: r1(bmi),
    bmiClass: BMI_CLASSES.find(([max]) => bmi < max)![1],
    bmr: Math.round(base),
    tdee: Math.round(tdee),
    balance: Math.round(targets.kcal - tdee),
    perKg: { protein: r1(targets.protein_g / weightKg), carbs: r1(targets.carbs_g / weightKg), fat: r1(targets.fat_g / weightKg) },
    percent: {
      protein: Math.round(((targets.protein_g * 4) / kcal) * 100),
      carbs: Math.round(((targets.carbs_g * 4) / kcal) * 100),
      fat: Math.round(((targets.fat_g * 9) / kcal) * 100),
    },
  }
}

/** Retorno: 15 dias para quem está mudando o peso, 30 para quem quer manter. */
export function nextReturn(consultedAt: string | undefined, goal: Goal | null): Date | null {
  if (!consultedAt) return null
  const d = new Date(consultedAt)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (goal === 'maintain' ? 30 : 15))
  return d
}
