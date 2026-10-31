#!/usr/bin/env python3
"""Gera src/modules/nutrition/planFoodsMore.ts: alimentos extras do plano (valores da TACO)
e preparações (crepioca, tapioca...) com macros somados dos ingredientes da TACO.
Rodar: python3 scripts/plan-foods.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TACO = {f['id']: f for f in json.load(open(os.path.join(ROOT, 'scripts/data/taco-foods.json')))}

M, MO, SN, PR, SU = 'main', 'morning', 'snack', 'pre', 'supper'
# key, taco, nome, [(grupo, papel)], tags, unidade(sing, plural, g), whole, max, price, quick
ITEMS = [
  # Proteínas do almoço e do jantar
  ('frangoCozido', 408, 'Peito de frango cozido (desfiado)', [(M,'protein'),(PR,'protein')], ['meat'], ('col. de sopa','col. de sopa',25), False, None, 1, True),
  ('frangoAssado', 403, 'Frango assado sem pele', [(M,'protein')], ['meat'], ('pedaço médio','pedaços médios',100), False, None, 1, False),
  ('sobrecoxa', 413, 'Sobrecoxa de frango sem pele assada', [(M,'protein')], ['meat'], ('sobrecoxa','sobrecoxas',90), False, None, 1, False),
  ('lagarto', 363, 'Lagarto cozido', [(M,'protein')], ['meat'], ('fatia média','fatias médias',60), False, None, 2, False),
  ('pernil', 435, 'Pernil de porco assado', [(M,'protein')], ['meat','pork'], ('fatia média','fatias médias',80), False, None, 2, False),
  ('bisteca', 429, 'Bisteca de porco grelhada', [(M,'protein')], ['meat','pork'], ('bisteca','bistecas',100), False, None, 1, True),
  ('abadejo', 276, 'Filé de abadejo grelhado', [(M,'protein')], ['fish'], ('filé médio','filés médios',120), False, None, 2, True),
  ('cacao', 282, 'Cação cozido', [(M,'protein')], ['fish'], ('posta média','postas médias',120), False, None, 2, False),
  ('corvina', 293, 'Corvina assada', [(M,'protein')], ['fish'], ('posta média','postas médias',120), False, None, 2, False),
  ('pintado', 313, 'Pintado grelhado', [(M,'protein')], ['fish'], ('posta média','postas médias',120), False, None, 3, False),
  ('salmao', 317, 'Salmão grelhado', [(M,'protein')], ['fish'], ('posta média','postas médias',120), False, None, 3, True),
  ('camarao', 284, 'Camarão cozido', [(M,'protein')], ['fish'], ('col. de sopa','col. de sopa',25), False, None, 3, True),
  ('bacalhau', 280, 'Bacalhau refogado', [(M,'protein')], ['fish','processed'], ('col. de servir','col. de servir',60), False, None, 3, False),
  ('omelete', 484, 'Omelete de queijo', [(MO,'protein'),(SU,'protein')], ['egg','lactose'], ('omelete (2 ovos)','omeletes (2 ovos)',110), False, 220, 1, True),
  # Proteínas do café, lanches e ceia
  ('clara', 486, 'Clara de ovo cozida', [(MO,'protein'),(SN,'protein'),(PR,'protein'),(SU,'protein')], ['egg'], ('clara','claras',30), True, 240, 1, True),
  ('mussarela', 463, 'Queijo mussarela', [(MO,'protein'),(SN,'protein')], ['lactose'], ('fatia','fatias',15), False, 60, 2, True),
  ('meiaCura', 462, 'Queijo minas meia cura', [(MO,'protein'),(SN,'protein')], ['lactose'], ('fatia','fatias',30), False, 60, 2, True),
  ('iogurteIntegral', 448, 'Iogurte natural integral', [(MO,'protein'),(SN,'protein'),(SU,'protein')], ['lactose'], ('pote','potes',170), False, 340, 1, True),
  # Carboidratos
  ('cara', 102, 'Cará cozido', [(M,'carb'),(MO,'carb')], [], ('pedaço médio','pedaços médios',80), False, None, 1, False),
  ('mandioquinha', 86, 'Mandioquinha cozida', [(M,'carb')], [], ('pedaço médio','pedaços médios',70), False, None, 2, False),
  ('nhoque', 136, 'Nhoque de batata', [(M,'carb')], ['gluten'], ('col. de servir','col. de servir',50), False, 250, 2, False),
  ('pinhao', 595, 'Pinhão cozido', [(SN,'carb')], [], ('pinhão','pinhões',8), False, 120, 2, False),
  ('paoAveia', 48, 'Pão de aveia de forma', [(MO,'carb'),(SN,'carb'),(PR,'carb')], ['gluten'], ('fatia','fatias',25), True, None, 2, True),
  ('paoMilho', 51, 'Pão de milho de forma', [(MO,'carb'),(SN,'carb')], ['gluten'], ('fatia','fatias',25), True, None, 2, True),
  ('paoSovado', 54, 'Pão sovado', [(MO,'carb'),(PR,'carb')], ['gluten'], ('pão','pães',50), True, None, 1, True),
  ('paoQueijo', 140, 'Pão de queijo', [(MO,'carb'),(SN,'carb')], ['lactose'], ('pão de queijo médio','pães de queijo médios',25), True, 100, 2, True),
  ('flocosMilho', 22, 'Flocos de milho sem açúcar', [(MO,'carb')], [], ('col. de sopa','col. de sopa',8), False, 60, 2, True),
  # Leguminosas
  ('feijaoFradinho', 563, 'Feijão fradinho cozido', [(M,'legume')], [], ('concha','conchas',80), False, None, 1, False),
  ('feijaoJalo', 565, 'Feijão jalo cozido', [(M,'legume')], [], ('concha','conchas',80), False, None, 1, False),
  ('feijaoRajado', 569, 'Feijão rajado cozido', [(M,'legume')], [], ('concha','conchas',80), False, None, 1, False),
  ('feijaoRosinha', 571, 'Feijão rosinha cozido', [(M,'legume')], [], ('concha','conchas',80), False, None, 1, False),
  ('feijaoRoxo', 573, 'Feijão roxo cozido', [(M,'legume')], [], ('concha','conchas',80), False, None, 1, False),
  # Legumes cozidos
  ('couve', 116, 'Couve refogada', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, True),
  ('espinafre', 120, 'Espinafre refogado', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 2, True),
  ('berinjela', 95, 'Berinjela cozida', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, False),
  ('moranga', 68, 'Abóbora moranga refogada', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, False),
  ('almeiraoRefogado', 85, 'Almeirão refogado', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, True),
  ('repolhoRefogado', 151, 'Repolho roxo refogado', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, True),
  ('vagem', 162, 'Vagem', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, False),
  ('quiabo', 147, 'Quiabo', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, False),
  ('legumesVapor', 546, 'Legumes no vapor', [(M,'veg')], [], ('col. de servir','col. de servir',40), False, None, 1, False),
  ('seleta', 154, 'Seleta de legumes em conserva', [(M,'veg')], ['processed'], ('col. de sopa','col. de sopa',25), False, None, 1, True),
  # Saladas cruas
  ('alfaceAmericana', 77, 'Salada de alface americana', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('rucula', 152, 'Salada de rúcula', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 2, True),
  ('agriao', 75, 'Salada de agrião', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 2, True),
  ('tomate', 157, 'Salada de tomate', [(M,'salad')], ['acid'], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('pepino', 142, 'Salada de pepino', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('cenouraRalada', 110, 'Cenoura ralada', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('beterrabaRalada', 98, 'Beterraba ralada', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('repolhoRoxo', 150, 'Salada de repolho roxo', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('acelga', 74, 'Salada de acelga', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('chicoria', 111, 'Salada de chicória', [(M,'salad')], [], ('prato de sobremesa','pratos de sobremesa',100), False, None, 1, True),
  ('palmito', 139, 'Palmito pupunha', [(M,'salad')], ['processed'], ('prato de sobremesa','pratos de sobremesa',100), False, None, 3, True),
  # Frutas
  ('bananaNanica', 179, 'Banana nanica', [(MO,'fruit'),(SN,'fruit'),(PR,'carb')], [], ('banana','bananas',90), True, 270, 1, True),
  ('bananaMaca', 178, 'Banana maçã', [(MO,'fruit'),(SN,'fruit'),(PR,'carb')], [], ('banana','bananas',60), True, 240, 1, True),
  ('macaArgentina', 221, 'Maçã argentina', [(MO,'fruit'),(SN,'fruit')], [], ('maçã','maçãs',150), True, 300, 2, True),
  ('pera', 243, 'Pera', [(MO,'fruit'),(SN,'fruit')], [], ('pera','peras',150), True, 300, 2, True),
  ('kiwi', 207, 'Kiwi', [(MO,'fruit'),(SN,'fruit')], [], ('kiwi','kiwis',75), True, 225, 3, True),
  ('melao', 236, 'Melão', [(MO,'fruit'),(SN,'fruit')], [], ('fatia média','fatias médias',150), False, 450, 2, True),
  ('mamaoFormosa', 225, 'Mamão formosa', [(MO,'fruit'),(SN,'fruit')], [], ('fatia média','fatias médias',170), False, 340, 1, True),
  ('mangaPalmer', 229, 'Manga palmer', [(MO,'fruit'),(SN,'fruit')], [], ('fatia','fatias',80), False, 240, 2, True),
  ('maracuja', 232, 'Maracujá (polpa)', [(SN,'fruit')], [], ('maracujá','maracujás',50), True, 150, 2, True),
  ('pessego', 244, 'Pêssego', [(MO,'fruit'),(SN,'fruit')], [], ('pêssego','pêssegos',110), True, 330, 3, True),
  ('ameixa', 172, 'Ameixa', [(MO,'fruit'),(SN,'fruit')], [], ('ameixa','ameixas',60), True, 240, 3, True),
  ('acerola', 169, 'Acerola', [(MO,'fruit'),(SN,'fruit')], ['acid'], ('acerola','acerolas',12), False, 240, 1, True),
  ('caqui', 189, 'Caqui', [(MO,'fruit'),(SN,'fruit')], [], ('caqui','caquis',110), True, 220, 2, True),
  ('figo', 194, 'Figo', [(SN,'fruit')], [], ('figo','figos',50), True, 200, 3, True),
  ('jabuticaba', 203, 'Jabuticaba', [(SN,'fruit')], [], ('xícara','xícaras',130), False, 260, 2, True),
  ('ponca', 251, 'Tangerina poncã', [(MO,'fruit'),(SN,'fruit')], ['acid'], ('tangerina','tangerinas',150), True, 300, 1, True),
  ('laranjaBaia', 208, 'Laranja baía', [(MO,'fruit'),(SN,'fruit')], ['acid'], ('laranja','laranjas',180), True, 360, 1, True),
  ('laranjaLima', 212, 'Laranja lima', [(MO,'fruit'),(SN,'fruit')], [], ('laranja','laranjas',140), True, 280, 1, True),
  ('goiabaBranca', 197, 'Goiaba branca', [(MO,'fruit'),(SN,'fruit')], [], ('goiaba','goiabas',150), True, 300, 1, True),
  ('carambola', 190, 'Carambola', [(SN,'fruit')], [], ('carambola','carambolas',130), True, 260, 2, True),
  ('cajuFruta', 186, 'Caju (fruta)', [(SN,'fruit')], [], ('caju','cajus',100), True, 300, 2, True),
  ('graviola', 201, 'Graviola', [(SN,'fruit')], [], ('xícara','xícaras',120), False, 240, 3, True),
  ('acai', 168, 'Açaí (polpa sem açúcar)', [(SN,'fruit')], [], ('pacote de polpa','pacotes de polpa',100), False, 200, 2, True),
  ('uvaRubi', 257, 'Uva rubi', [(MO,'fruit'),(SN,'fruit')], [], ('cacho pequeno','cachos pequenos',100), False, 250, 2, True),
  ('atemoia', 174, 'Atemoia', [(SN,'fruit')], [], ('metade','metades',120), False, 240, 3, True),
  ('pinha', 246, 'Pinha', [(SN,'fruit')], [], ('pinha','pinhas',120), True, 240, 2, True),
  ('jaca', 204, 'Jaca', [(SN,'fruit')], [], ('bago','bagos',15), False, 200, 1, True),
  # Gorduras boas
  ('gergelim', 593, 'Gergelim', [(SN,'fat'),(SU,'fat')], [], ('col. de sopa','col. de sopa',10), False, None, 2, True),
]

# Preparações: ingredientes da TACO (id, gramas) + água; macros por 100 g do pronto.
# key, nome, [(taco, g)], água g, [(grupo, papel)], tags, unidade, whole, max, price, quick
RECIPES = [
  ('crepioca', 'Crepioca', [(489, 50), (146, 20)], 0, [(MO,'carb'),(SN,'carb'),(PR,'carb')], ['egg'], ('crepioca (1 ovo)','crepiocas',70), True, 210, 1, True),
  ('tapioca', 'Tapioca (sem recheio)', [(146, 40)], 15, [(MO,'carb'),(SN,'carb'),(PR,'carb')], [], ('tapioca média','tapiocas médias',55), True, 165, 1, True),
  ('panquecaBanana', 'Panqueca de banana com aveia', [(489, 50), (182, 70), (7, 15)], 0, [(MO,'carb'),(SN,'carb'),(PR,'carb')], ['egg','gluten'], ('panqueca','panquecas',135), True, 270, 1, True),
  ('mingau', 'Mingau de aveia com leite desnatado', [(7, 30), (456, 20)], 180, [(MO,'carb'),(SN,'carb')], ['lactose','gluten'], ('tigela','tigelas',230), True, 460, 1, True),
  ('vitamina', 'Vitamina de banana com leite desnatado', [(456, 20), (182, 70), (7, 10)], 180, [(MO,'carb'),(SN,'carb'),(PR,'carb')], ['lactose','gluten'], ('copo','copos',280), True, 560, 1, True),
  ('iogurteBowl', 'Iogurte com banana e aveia', [(449, 170), (182, 70), (7, 15)], 0, [(MO,'carb'),(SN,'carb')], ['lactose','gluten'], ('tigela','tigelas',255), True, 510, 1, True),
  ('sanduiche', 'Sanduíche natural de frango', [(52, 50), (408, 40), (469, 20), (78, 15), (110, 15)], 0, [(SN,'carb'),(PR,'carb')], ['gluten','meat','lactose'], ('sanduíche','sanduíches',140), True, 280, 2, True),
  ('graoDeBico', 'Grão-de-bico cozido', [(575, 40)], 60, [(M,'legume')], [], ('concha','conchas',80), False, None, 2, False),
]

# Como cada ingrediente aparece na lista de compras.
SHOP_NAME = {489: 'ovos', 146: 'goma de tapioca', 182: 'banana', 7: 'aveia', 456: 'leite desnatado em pó', 449: 'iogurte natural desnatado', 52: 'pão integral de forma', 408: 'peito de frango', 469: 'ricota', 78: 'alface', 110: 'cenoura', 575: 'grão-de-bico seco'}

def num(v):
    v = round(v or 0, 1)
    return str(int(v)) if v == int(v) else str(v)

def entry(key, id_, name, kcal, p, c, f, fiber, tags, unit, whole, mx, price, quick):
    tags_s = '[' + ', '.join(f"'{t}'" for t in tags) + ']'
    unit_s = f"['{unit[0]}', '{unit[1]}', {num(unit[2])}]"
    mx_s = 'undefined' if mx is None else num(mx)
    q = ', quick: true' if quick else ''
    return f"  {key}: food('{id_}', '{name}', {num(kcal)}, {num(p)}, {num(c)}, {num(f)}, {num(fiber)}, {tags_s}, {unit_s}, {'true' if whole else 'false'}, {mx_s}, {{ price: {price}{q} }}),"

out = ['// Gerado por scripts/plan-foods.py. Não edite à mão: mude o script e rode de novo.',
       "import { food, type PlanFood, type Role } from './planFood'", '',
       '/** Mais alimentos do plano, com os valores por 100 g copiados da TACO. */',
       'export const MORE_FOODS = {']
groups = {}
for key, tid, name, where, tags, unit, whole, mx, price, quick in ITEMS:
    t = TACO[f'taco-{tid}']
    out.append(entry(key, t['id'], name, t['kcal'], t['protein_g'], t['carbs_g'], t['fat_g'], t['fiber_g'], tags, unit, whole, mx, price, quick))
    for g, r in where: groups.setdefault(g, {}).setdefault(r, []).append(key)
out += ['} satisfies Record<string, PlanFood>', '',
        '/** Preparações: macros somados dos ingredientes da TACO, por 100 g do prato pronto. */',
        'export const RECIPES = {']
recipe_ings = []
for key, name, ings, water, where, tags, unit, whole, mx, price, quick in RECIPES:
    total = sum(g for _, g in ings) + water
    s = {k: 0.0 for k in ('kcal','protein_g','carbs_g','fat_g','fiber_g')}
    for tid, g in ings:
        t = TACO[f'taco-{tid}']
        assert t['kcal'] > 0, t['name']
        for k in s: s[k] += (t[k] or 0) * g / 100
    per = {k: v * 100 / total for k, v in s.items()}
    out.append(entry(key, f'recipe-{key}', name, per['kcal'], per['protein_g'], per['carbs_g'], per['fat_g'], per['fiber_g'], tags, unit, whole, mx, price, quick))
    recipe_ings.append(f"  {key}: {{ water: {water}, items: [{', '.join(f'[\'taco-{tid}\', {g}, \'{SHOP_NAME[tid]}\']' for tid, g in ings)}] }},")
    for g, r in where: groups.setdefault(g, {}).setdefault(r, []).append(key)
out += ['} satisfies Record<string, PlanFood>', '',
        '/** Ingredientes de cada preparação (id da TACO, gramas) e água, para conferir as contas. */',
        'export const RECIPE_INGREDIENTS: Record<string, { water: number; items: [string, number, string][] }> = {']
out += recipe_ings
out += ['}', '', '/** Onde cada alimento extra entra: grupo de refeição → papel → chaves, na ordem de preferência. */',
        "export const MORE_OPTIONS: Record<'main' | 'morning' | 'snack' | 'pre' | 'supper', Partial<Record<Role, (keyof typeof MORE_FOODS | keyof typeof RECIPES)[]>>> = {"]
for g in (M, MO, SN, PR, SU):
    roles = groups.get(g, {})
    out.append(f'  {g}: {{')
    for r, keys in roles.items():
        out.append(f"    {r}: [{', '.join(repr(k) for k in keys)}],")
    out.append('  },')
out += ['}', '']
open(os.path.join(ROOT, 'src/modules/nutrition/planFoodsMore.ts'), 'w').write('\n'.join(out))
print(len(ITEMS), 'alimentos,', len(RECIPES), 'preparações')
