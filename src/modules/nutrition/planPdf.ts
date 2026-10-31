// PDF do plano alimentar, gerado no próprio aparelho. As bibliotecas só carregam quando a
// pessoa toca em "Baixar PDF", para não pesar na abertura do app.
import type { Guidance } from './anamnesis'
import type { SupplementRow } from './anamnesis'
import { buyAmount, itemMacros, portion, shoppingList, substitutes, type MealPlan, type PlanSettings, type Role } from './plan'

export interface PlanPdfInput {
  name: string | null
  plan: MealPlan
  settings: PlanSettings
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  fiberGoal: number
  tips: Guidance[]
  supplements: SupplementRow[]
  nextReturn: Date | null
  today?: Date
}

const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')

/** As fontes padrão do PDF não têm alguns símbolos; troca pelos equivalentes simples. */
export const pdfText = (s: string) =>
  s
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/[≥]/g, '>=')
    .replace(/[≤]/g, '<=')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7e\xa0-\xff–—•…×½·\n]/g, '')

/** "150 g · 1 metade" vira ["150 g", "1 metade"]. */
export function splitPortion(text: string): [string, string] {
  const i = text.indexOf(' · ')
  return i === -1 ? [text, ''] : [text.slice(0, i), text.slice(i + 3)]
}

const SHOP_GROUPS: { title: string; roles: Role[] }[] = [
  { title: 'Proteínas', roles: ['protein'] },
  { title: 'Carboidratos e leguminosas', roles: ['carb', 'legume'] },
  { title: 'Frutas', roles: ['fruit'] },
  { title: 'Legumes e verduras', roles: ['veg', 'salad'] },
  { title: 'Gorduras', roles: ['fat'] },
]

export function pdfFileName(today = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `plano-alimentar-${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.pdf`
}

export async function downloadPlanPdf(input: PlanPdfInput) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const today = input.today ?? new Date()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 16
  const INK: [number, number, number] = [20, 24, 23]
  const MUTED: [number, number, number] = [104, 112, 110]
  const ACCENT: [number, number, number] = [22, 140, 88]
  const LINE: [number, number, number] = [222, 226, 225]
  const T = (s: string) => pdfText(s)
  let y = M

  const ensure = (space: number) => {
    if (y + space > H - 18) {
      doc.addPage()
      y = M
    }
  }
  const heading = (text: string) => {
    ensure(16)
    y += 4
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...INK)
    doc.text(T(text), M, y)
    y += 2.5
    doc.setDrawColor(...ACCENT).setLineWidth(0.6).line(M, y, M + 14, y)
    y += 6
  }
  const after = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  // Cabeçalho
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ACCENT)
  doc.text('NutriMax', M, y + 2)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
  doc.text(T(`Gerado em ${today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`), W - M, y + 2, { align: 'right' })
  y += 12
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...INK)
  doc.text('Plano alimentar', M, y)
  y += 7
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED)
  const sub = [input.name, `${input.plan.meals.length} refeições por dia`, input.nextReturn ? `retorno em ${input.nextReturn.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : null].filter(Boolean).join(' · ')
  doc.text(T(sub), M, y)
  y += 8

  // Metas do dia em blocos
  const t = input.plan.total
  const boxes: [string, string, string][] = [
    ['Calorias', `${fmt(t.kcal)} kcal`, `meta ${fmt(input.targets.kcal)}`],
    ['Proteína', `${fmt(t.p)} g`, `meta ${fmt(input.targets.protein_g)} g`],
    ['Carboidrato', `${fmt(t.c)} g`, `meta ${fmt(input.targets.carbs_g)} g`],
    ['Gordura', `${fmt(t.f)} g`, `meta ${fmt(input.targets.fat_g)} g`],
    ['Fibra', `${fmt(t.fiber)} g`, `meta ${fmt(input.fiberGoal)} g`],
  ]
  const gap = 3
  const bw = (W - 2 * M - gap * (boxes.length - 1)) / boxes.length
  boxes.forEach(([label, value, meta], i) => {
    const x = M + i * (bw + gap)
    doc.setFillColor(243, 246, 245).roundedRect(x, y, bw, 19, 2, 2, 'F')
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED)
    doc.text(T(label), x + 3, y + 5)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK)
    doc.text(T(value), x + 3, y + 11.5)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text(T(meta), x + 3, y + 16)
  })
  y += 25

  // Cardápio
  heading('Cardápio do dia')
  for (const meal of input.plan.meals) {
    ensure(28)
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...ACCENT)
    doc.text(meal.time, M, y)
    doc.setTextColor(...INK)
    doc.text(T(meal.label), M + 13, y)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
    doc.text(T(`${fmt(meal.total.kcal)} kcal · P ${fmt(meal.total.p)} g · C ${fmt(meal.total.c)} g · G ${fmt(meal.total.f)} g`), W - M, y, { align: 'right' })
    y += 2
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Alimento', 'Quantidade', 'Medida caseira', 'kcal', 'Pode trocar por']],
      body: meal.items.map(i => {
        const [grams, measure] = splitPortion(portion(i.food, i.grams))
        const subs = substitutes(meal.kind, i, input.settings, 3).map(s => `${s.food.name} (${splitPortion(portion(s.food, s.grams))[0]})`)
        return [T(i.food.name), T(grams), T(measure || '–'), fmt(itemMacros(i).kcal), T(subs.join('; ') || '–')]
      }),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, lineColor: LINE, lineWidth: { bottom: 0.2 } },
      headStyles: { fontSize: 7.5, textColor: MUTED, fontStyle: 'normal' },
      columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' }, 1: { cellWidth: 20 }, 2: { cellWidth: 33 }, 3: { cellWidth: 12, halign: 'right' }, 4: { textColor: MUTED, fontSize: 8 } },
    })
    y = after() + 3
    if (meal.note) {
      ensure(8)
      doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...MUTED)
      const lines = doc.splitTextToSize(T(meal.note), W - 2 * M)
      doc.text(lines, M, y + 2)
      y += lines.length * 4 + 2
    }
    y += 4
  }

  // Suplementos
  if (input.supplements.length) {
    heading('Suplementos')
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Suplemento', 'Dose', 'Quando']],
      body: input.supplements.map(s => [T(s.name), T(s.dose), T(s.when)]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 2, lineColor: LINE, lineWidth: { bottom: 0.2 } },
      headStyles: { fontSize: 7.5, textColor: MUTED, fontStyle: 'normal' },
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 50 } },
    })
    y = after() + 6
  }

  // Orientações
  if (input.tips.length) {
    heading('Orientações')
    for (const tip of input.tips) {
      doc.setFont('helvetica', 'normal').setFontSize(9.5)
      const lines = doc.splitTextToSize(T(tip.text), W - 2 * M)
      ensure(7 + lines.length * 4.4)
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK)
      doc.text(T(tip.title), M, y)
      y += 5
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(60, 66, 64)
      doc.text(lines, M, y)
      y += lines.length * 4.4 + 4
    }
  }

  // Lista de compras
  const roleOf = new Map(input.plan.meals.flatMap(m => m.items).map(i => [i.key, i.role]))
  const list = shoppingList(input.plan)
  const body: string[][] = []
  for (const g of SHOP_GROUPS) {
    const items = list.filter(i => g.roles.includes(roleOf.get(i.key) ?? 'carb'))
    if (!items.length) continue
    body.push([T(g.title), ''])
    for (const i of items) body.push([T(i.food.name), T(buyAmount(i.food, i.grams))])
  }
  if (body.length) {
    heading('Lista de compras para 7 dias')
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      body,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 1.8, lineColor: LINE, lineWidth: { bottom: 0.2 } },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 } },
      didParseCell: data => {
        if (data.row.raw && (data.row.raw as string[])[1] === '') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = ACCENT
          data.cell.styles.fontSize = 8
          data.cell.styles.cellPadding = { top: 4, bottom: 1.5, left: 1.8, right: 1.8 }
        }
      },
    })
  }

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text(T('Orientação geral calculada pelo NutriMax. Não substitui a consulta com um nutricionista, principalmente se você tiver alguma condição de saúde.'), M, H - 9)
    doc.text(`${p} / ${pages}`, W - M, H - 9, { align: 'right' })
  }

  doc.save(pdfFileName(today))
}
