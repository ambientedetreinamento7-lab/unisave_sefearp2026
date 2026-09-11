import { useState } from 'react'
import { usePlatformSettings } from '../context/PlatformSettingsContext'
import { Icon } from './Icon'

type Platform = 'android' | 'ios'

// Detecta pelo user agent só pra abrir na aba certa de cara — o aluno
// sempre pode trocar de aba manualmente (ex.: alguém vendo o próprio
// celular no computador de outra pessoa).
function detectPlatform(): Platform {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'android'
}

const STEPS: Record<Platform, string[]> = {
  android: [
    'Abra o UniSave no Chrome (não funciona dentro do navegador do WhatsApp/Instagram).',
    'Toque nos três pontinhos (⋮) no canto superior direito do navegador.',
    'Toque em "Instalar app" ou "Adicionar à tela inicial".',
    'Confirme tocando em "Instalar".',
  ],
  ios: [
    'Abra o UniSave no Safari (precisa ser o Safari, outros navegadores do iPhone não suportam isso).',
    'Toque no ícone de Compartilhar (o quadrado com uma seta pra cima) na barra inferior.',
    'Role a lista de opções e toque em "Adicionar à Tela de Início".',
    'Toque em "Adicionar" no canto superior direito.',
  ],
}

export function InstallHelpModal({ onClose }: { onClose: () => void }) {
  const { branding } = usePlatformSettings()
  const [platform, setPlatform] = useState<Platform>(detectPlatform)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 bg-navy px-5 py-3">
          <div className="flex items-center gap-2">
            <img src={branding.logoUrl ?? '/logos/UniSave.png'} alt="" className="h-4 w-auto" />
            <div className="h-4 w-px bg-white/25" />
            <img src={branding.secondaryLogoUrl ?? '/logos/sefea.png'} alt="" className="h-4 w-auto" />
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-white/70 hover:text-white">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2">
            <span className="icon-badge h-9 w-9 shrink-0">
              <Icon name="download" size={18} />
            </span>
            <div>
              <p className="font-bold text-ink">Como instalar o app</p>
              <p className="text-xs text-ink-soft">Escolha o sistema do seu aparelho</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPlatform('android')}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition ${
                platform === 'android' ? 'border-navy bg-navy-light text-navy' : 'border-navy-light text-ink-soft'
              }`}
            >
              Android
            </button>
            <button
              onClick={() => setPlatform('ios')}
              className={`flex-1 rounded-xl border-2 py-2 text-sm font-bold transition ${
                platform === 'ios' ? 'border-navy bg-navy-light text-navy' : 'border-navy-light text-ink-soft'
              }`}
            >
              iPhone / iPad
            </button>
          </div>

          <ol className="mt-4 space-y-3">
            {STEPS[platform].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-light text-xs font-bold text-navy">
                  {i + 1}
                </span>
                <p className="text-sm text-ink">{step}</p>
              </li>
            ))}
          </ol>

          {platform === 'android' && (
            <p className="mt-4 text-xs text-ink-soft">
              Se a opção não aparecer no menu, navegue um pouco mais pelo app e tente de novo — o Chrome libera essa
              opção depois de identificar que você usa o site com frequência.
            </p>
          )}

          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-navy py-2.5 font-bold text-white hover:bg-navy-dark"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
