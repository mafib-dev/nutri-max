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
