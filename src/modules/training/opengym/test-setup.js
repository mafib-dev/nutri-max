// Os testes portados do openGym usam exercícios do catálogo dele pelo id ('0025' é o supino
// reto com barra). Este arquivo registra só esses exercícios antes de cada arquivo de teste.
import { registerCatalogue } from './exercises.js'
import catalogue from './test-catalogue.json'

registerCatalogue(catalogue)
