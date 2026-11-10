// Aparência do boneco: tom de pele e cor de cabelo, escolhidos no cadastro.
export const SKIN_TONES = ['#f6d5b8', '#e8b98f', '#c98e62', '#9a6440', '#6b4128']
export const HAIR_COLORS = ['#2b1d16', '#5a3825', '#a5682a', '#d9b26a', '#8f8f8f']

export interface AvatarLook {
  skin: number
  hair: number
}

export const DEFAULT_LOOK: AvatarLook = { skin: 1, hair: 0 }
