// h5p-standalone não publica um campo "types" no package.json (só
// dist/h5p.d.ts com os tipos de H5PIntegration, sem exportar a classe H5P
// em si) — essa declaração mínima só cobre a API que a gente realmente usa
// em components/H5pPlayer.tsx.
declare module 'h5p-standalone' {
  export interface H5POptions {
    h5pJsonPath: string
    frameJs: string
    frameCss: string
    id?: string
    frame?: boolean
    copyright?: boolean
    export?: boolean
    embed?: boolean
    icon?: boolean
    fullScreen?: boolean
  }

  export class H5P {
    constructor(el: HTMLElement, options: H5POptions)
    then<T>(onFulfilled: () => T): Promise<T>
  }
}
