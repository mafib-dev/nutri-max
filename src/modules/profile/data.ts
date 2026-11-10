// Leitura e escrita do cadastro no Supabase. A aparência do boneco fica nos dados da conta
// (user_metadata), sem precisar de coluna nova no banco.
import { supabase } from '../../lib/supabase'
import { listBodyWeights, saveBodyWeight } from '../training/data'
import { loadNutritionProfile, saveNutritionProfile, todayIso } from '../nutrition/data'
import { toNutritionProfile, type ProfileSetup } from './setup'
import type { AvatarLook } from './look'

export async function loadSetup(): Promise<ProfileSetup> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Faça login de novo.')
  const [{ data, error }, profile, weights] = await Promise.all([
    supabase.from('profiles').select('display_name, level').eq('id', auth.user.id).single(),
    loadNutritionProfile(),
    listBodyWeights(1),
  ])
  if (error) throw new Error(`Falha ao carregar o perfil: ${error.message}`)
  return {
    display_name: data.display_name,
    level: data.level,
    sex: profile.sex,
    birth_date: profile.birth_date,
    height_cm: profile.height_cm,
    weight_kg: weights.at(-1)?.weight_kg ?? null,
    goal: profile.goal,
    target_weight_kg: profile.target_weight_kg,
    activity_level: profile.activity_level,
  }
}

/** Salva o perfil inteiro. O peso só vira pesagem nova quando mudou. */
export async function saveSetup(p: ProfileSetup, look: AvatarLook, previousWeight: number | null) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Faça login de novo.')
  const current = await loadNutritionProfile()
  await saveNutritionProfile(toNutritionProfile(p, current))
  const { error } = await supabase.from('profiles').update({ display_name: p.display_name?.trim(), level: p.level }).eq('id', auth.user.id)
  if (error) throw new Error(`Falha ao salvar o nome: ${error.message}`)
  if (p.weight_kg && p.weight_kg !== previousWeight) await saveBodyWeight(todayIso(), p.weight_kg)
  const meta = await supabase.auth.updateUser({ data: { avatar: look } })
  if (meta.error) throw new Error(`Falha ao salvar o boneco: ${meta.error.message}`)
}

// Do que depende para o que é dependido: as séries antes dos treinos, as rotinas antes dos
// exercícios criados, os registros antes dos alimentos.
const RESET_TABLES: [table: string, column: string][] = [
  ['food_logs', 'user_id'],
  ['saved_meals', 'user_id'],
  ['water_logs', 'user_id'],
  ['coach_messages', 'user_id'],
  ['ai_insights', 'user_id'],
  ['personal_records', 'user_id'],
  ['workout_sets', 'user_id'],
  ['workouts', 'user_id'],
  ['routine_exercises', 'user_id'],
  ['routines', 'user_id'],
  ['body_metrics', 'user_id'],
  ['exercises', 'owner_id'],
  ['foods', 'owner_id'],
]

/** O perfil volta a ficar em branco: o app mostra o cadastro do primeiro login de novo. */
export const BLANK_PROFILE = {
  display_name: null,
  goal: null,
  level: null,
  display_unit: 'kg',
  sex: null,
  birth_date: null,
  height_cm: null,
  activity_level: null,
  kcal_target: null,
  protein_target_g: null,
  carbs_target_g: null,
  fat_target_g: null,
  target_weight_kg: null,
  weekly_rate_kg: null,
  add_workout_kcal: false,
  meal_plan: null,
}

/**
 * Apaga tudo o que é da pessoa (diário, treinos, rotinas, pesagens, plano, conversa, alimentos e
 * exercícios criados) e deixa o perfil em branco. O login continua, e o catálogo de todos não muda.
 * O perfil é o último: se algo falhar no meio, nada some sem a pessoa ver o erro, e dá para repetir.
 */
export async function resetAllData() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Faça login de novo.')
  const id = auth.user.id
  for (const [table, column] of RESET_TABLES) {
    const { error } = await supabase.from(table).delete().eq(column, id)
    if (error) throw new Error(`Falha ao apagar (${table}): ${error.message}`)
  }
  const { error } = await supabase.from('profiles').update(BLANK_PROFILE).eq('id', id)
  if (error) throw new Error(`Falha ao limpar o perfil: ${error.message}`)
  await supabase.auth.updateUser({ data: { avatar: null } })
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('nutrimax.')) localStorage.removeItem(k)
  } catch {
    // Sem armazenamento local: nada para limpar.
  }
}
