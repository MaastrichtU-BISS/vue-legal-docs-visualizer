import { createApp } from 'vue'
import App from './App.vue'
// The package's own styles and its PrimeVue setup, exactly as a consumer
// imports them.
import plugin from '../src'
import '../src/styles/main.css'

createApp(App).use(plugin).mount('#app')
