// Boneco da tela Hoje: uma pessoa desenhada em SVG, masculina ou feminina, com tom de pele e cor
// de cabelo escolhidos no cadastro. Respira, pisca e muda de pose conforme o dia (acena, treina,
// comemora, dorme). As animações usam a biblioteca Motion.
import { motion, useReducedMotion, type Transition } from 'motion/react'
import type { Sex } from '../modules/nutrition/targets'
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type AvatarLook } from '../modules/profile/look'


export type Pose = 'idle' | 'wave' | 'train' | 'celebrate' | 'sleep'

const SHIRT = { male: '#c8f031', female: '#c8f031' }
const SHORTS = { male: '#2a3140', female: '#2a3140' }
const SHOE = '#eef2ea'
const LOOP: Transition = { repeat: Infinity, ease: 'easeInOut' }

/** Rotação de cada braço (graus) por pose. Positivo gira no sentido horário. */
function armMotion(pose: Pose, side: 'left' | 'right') {
  const out = side === 'left' ? 1 : -1 // para fora do corpo
  switch (pose) {
    case 'wave':
      return side === 'right' ? { rotate: [-150, -125, -150], transition: { ...LOOP, duration: 0.9 } } : { rotate: 6, transition: { duration: 0.4 } }
    case 'train':
      // Elevação lateral com halteres, os dois braços juntos.
      return { rotate: [out * 8, out * 80, out * 8], transition: { ...LOOP, duration: 2.2 } }
    case 'celebrate':
      return { rotate: [out * 150, out * 165, out * 150], transition: { ...LOOP, duration: 0.8 } }
    case 'sleep':
      return { rotate: out * 4, transition: { duration: 0.6 } }
    default:
      return { rotate: [out * 6, out * 9, out * 6], transition: { ...LOOP, duration: 4 } }
  }
}

export function Avatar({ sex, look = DEFAULT_LOOK, pose = 'idle', size = 180, onClick }: { sex: Sex | null; look?: AvatarLook; pose?: Pose; size?: number; onClick?: () => void }) {
  const reduce = useReducedMotion()
  const female = sex === 'female'
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[1]
  const hair = HAIR_COLORS[look.hair] ?? HAIR_COLORS[0]
  const shade = 'rgb(0 0 0 / 0.12)'
  const kind = female ? 'female' : 'male'
  const still = !!reduce
  const asleep = pose === 'sleep'
  const holding = pose === 'train'

  // Ombros, cintura e quadril mudam um pouco entre os dois corpos.
  const sh = female ? { l: 66, r: 134 } : { l: 58, r: 142 }
  const torso = female
    ? 'M66 112 Q100 102 134 112 L132 150 Q126 168 130 192 L70 192 Q74 168 68 150 Z'
    : 'M58 114 Q100 100 142 114 L136 160 Q132 178 132 192 L68 192 Q68 178 64 160 Z'

  const arm = (side: 'left' | 'right') => {
    const x = side === 'left' ? sh.l + 2 : sh.r - 2
    const m = armMotion(pose, side)
    return (
      <motion.g style={{ originX: 0.5, originY: 0.04 }} initial={false} animate={still ? undefined : { rotate: m.rotate }} transition={m.transition}>
        {/* Braço inteiro (pele) com a manga da camiseta por cima. */}
        <rect x={x - 9} y={110} width={18} height={80} rx={9} fill={skin} />
        <path d={`M${x - 10} 112 h20 v26 q-10 4 -20 0 z`} fill={SHIRT[kind]} />
        <circle cx={x} cy={192} r={9.5} fill={skin} />
        {holding && (
          <g>
            <rect x={x - 16} y={188} width={32} height={8} rx={2} fill="#4b5563" />
            <rect x={x - 20} y={183} width={8} height={18} rx={2} fill="#1f2937" />
            <rect x={x + 12} y={183} width={8} height={18} rx={2} fill="#1f2937" />
          </g>
        )}
      </motion.g>
    )
  }

  return (
    <svg viewBox="0 0 200 330" width={size} height={(size * 330) / 200} role="img" aria-label={female ? 'Sua personagem' : 'Seu personagem'} onClick={onClick} style={{ overflow: 'visible', cursor: onClick ? 'pointer' : undefined }}>
      {/* Sombra no chão */}
      <motion.ellipse cx={100} cy={318} rx={52} ry={7} fill="rgb(0 0 0 / 0.35)" style={{ originX: 0.5 }} animate={still ? undefined : { scaleX: [1, 0.93, 1] }} transition={{ ...LOOP, duration: 4 }} />

      <motion.g style={{ originX: 0.5, originY: 1 }} animate={still ? undefined : pose === 'celebrate' ? { y: [0, -10, 0] } : { rotate: [-0.8, 0.8, -0.8] }} transition={pose === 'celebrate' ? { ...LOOP, duration: 0.8 } : { ...LOOP, duration: 6 }}>
        {/* Cabelo comprido fica atrás do corpo */}
        {female && (
          <motion.path
            d="M66 58 Q60 120 74 150 L126 150 Q140 120 134 58 Z"
            fill={hair}
            style={{ originX: 0.5, originY: 0 }}
            animate={still ? undefined : { rotate: [-1.5, 1.5, -1.5] }}
            transition={{ ...LOOP, duration: 3 }}
          />
        )}

        {/* Pernas */}
        {female ? (
          <>
            <path d="M72 188 L98 188 L96 304 L80 304 Z" fill={SHORTS[kind]} />
            <path d="M102 188 L128 188 L120 304 L104 304 Z" fill={SHORTS[kind]} />
          </>
        ) : (
          <>
            <rect x={75} y={226} width={20} height={80} rx={9} fill={skin} />
            <rect x={105} y={226} width={20} height={80} rx={9} fill={skin} />
            <path d="M68 186 L132 186 L134 236 L102 236 L100 214 L98 236 L66 236 Z" fill={SHORTS[kind]} />
          </>
        )}
        <ellipse cx={86} cy={308} rx={15} ry={7} fill={SHOE} />
        <ellipse cx={114} cy={308} rx={15} ry={7} fill={SHOE} />

        {arm('left')}
        {arm('right')}

        {/* Tronco: respira */}
        <motion.g style={{ originX: 0.5, originY: 1 }} animate={still ? undefined : { scaleY: [1, 1.025, 1], scaleX: [1, 1.01, 1] }} transition={{ ...LOOP, duration: asleep ? 5 : 3.6 }}>
          <path d={torso} fill={SHIRT[kind]} />
          <path d={female ? 'M88 108 Q100 118 112 108' : 'M86 108 Q100 120 114 108'} stroke={shade} strokeWidth={3} fill="none" />
          <rect x={female ? 70 : 68} y={184} width={female ? 60 : 64} height={8} rx={3} fill={shade} />
        </motion.g>

        {/* Pescoço e cabeça */}
        <rect x={90} y={88} width={20} height={22} rx={6} fill={skin} />
        <motion.g style={{ originX: 0.5, originY: 1 }} animate={still ? undefined : asleep ? { rotate: 8, y: 4 } : { rotate: [-2, 2, -2] }} transition={asleep ? { duration: 1 } : { ...LOOP, duration: 5 }}>
          <ellipse cx={68} cy={62} rx={5} ry={8} fill={skin} />
          <ellipse cx={132} cy={62} rx={5} ry={8} fill={skin} />
          <ellipse cx={100} cy={60} rx={31} ry={35} fill={skin} />

          {/* Cabelo da frente */}
          {female ? (
            <path d="M68 58 Q66 22 100 22 Q134 22 132 58 Q118 40 96 38 Q84 44 68 58 Z" fill={hair} />
          ) : (
            <path d="M69 52 Q68 20 100 22 Q132 20 131 52 Q124 36 100 36 Q78 36 69 52 Z" fill={hair} />
          )}

          {/* Sobrancelhas */}
          <path d="M80 50 q8 -4 15 0" stroke={hair} strokeWidth={3} strokeLinecap="round" fill="none" />
          <path d="M105 50 q8 -4 15 0" stroke={hair} strokeWidth={3} strokeLinecap="round" fill="none" />

          {/* Olhos: piscam; dormindo, ficam fechados */}
          {asleep ? (
            <>
              <path d="M82 62 q6 4 12 0" stroke="#1d1d1f" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              <path d="M106 62 q6 4 12 0" stroke="#1d1d1f" strokeWidth={2.5} strokeLinecap="round" fill="none" />
            </>
          ) : (
            <motion.g style={{ originY: 0.5 }} animate={still ? undefined : { scaleY: [1, 1, 0.1, 1] }} transition={{ repeat: Infinity, duration: 4.2, times: [0, 0.9, 0.95, 1] }}>
              <ellipse cx={88} cy={62} rx={4} ry={5} fill="#1d1d1f" />
              <ellipse cx={112} cy={62} rx={4} ry={5} fill="#1d1d1f" />
              <circle cx={89.5} cy={60} r={1.3} fill="#fff" />
              <circle cx={113.5} cy={60} r={1.3} fill="#fff" />
            </motion.g>
          )}

          {/* Bochechas e boca */}
          <ellipse cx={80} cy={74} rx={6} ry={3.5} fill="rgb(232 120 110 / 0.35)" />
          <ellipse cx={120} cy={74} rx={6} ry={3.5} fill="rgb(232 120 110 / 0.35)" />
          {pose === 'celebrate' ? (
            <path d="M88 78 Q100 92 112 78 Z" fill="#7a2e2e" />
          ) : pose === 'train' ? (
            <path d="M92 82 Q100 79 108 82" stroke="#7a2e2e" strokeWidth={2.5} strokeLinecap="round" fill="none" />
          ) : (
            <path d="M90 79 Q100 87 110 79" stroke="#7a2e2e" strokeWidth={2.5} strokeLinecap="round" fill="none" />
          )}
        </motion.g>
      </motion.g>

      {/* Dormindo: "z" subindo */}
      {asleep &&
        !still &&
        [0, 1, 2].map(i => (
          <motion.text key={i} fill="var(--muted)" fontSize={14 + i * 4} fontWeight={700} initial={{ x: 136, y: 40, opacity: 0 }} animate={{ opacity: [0, 1, 0], x: [136, 146 + i * 6], y: [40, 10 - i * 10] }} transition={{ repeat: Infinity, duration: 3, delay: i, ease: 'easeOut' }}>
            z
          </motion.text>
        ))}
    </svg>
  )
}
