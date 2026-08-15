import { mount } from 'svelte'
import 'maplibre-gl/dist/maplibre-gl.css' // first, so app.css can override it
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
