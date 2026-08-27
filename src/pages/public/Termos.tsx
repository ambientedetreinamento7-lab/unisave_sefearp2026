import { HeroBrandBar } from '../../components/HeroBrandBar'

export function Termos() {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <HeroBrandBar compact />

        <div className="card mt-8 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-ink">Termos de Uso</h1>
          <p className="mt-1 text-sm text-ink-soft">Última atualização: 27 de agosto de 2026 · Versão 1</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-bold text-ink">1. Quem somos</h2>
              <p className="mt-1 text-ink-soft">
                A plataforma UniSave | SEFEARP é operada por <strong className="text-ink">[RAZÃO SOCIAL]</strong>,
                inscrita no CNPJ <strong className="text-ink">[CNPJ]</strong>. Ao criar uma conta ou usar a
                plataforma, você concorda com estes Termos de Uso.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">2. O que é a plataforma</h2>
              <p className="mt-1 text-ink-soft">
                A UniSave | SEFEARP é uma plataforma de treinamento e desenvolvimento profissional, com trilhas de
                curso, quizzes de fixação, planos de desenvolvimento individual (PDI), certificados e uma comunidade
                de discussão entre participantes.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">3. Cadastro e conta</h2>
              <p className="mt-1 text-ink-soft">
                Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas
                na sua conta. Informe dados verdadeiros no cadastro e nos ative sua conta assim que perceber uso não
                autorizado.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">4. Conduta na comunidade</h2>
              <p className="mt-1 text-ink-soft">
                Ao publicar na comunidade da plataforma, você concorda em não postar conteúdo ofensivo, discriminatório,
                ilegal ou que viole direitos de terceiros. Publicações podem passar por moderação e ser removidas a
                critério da equipe responsável.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">5. Certificados</h2>
              <p className="mt-1 text-ink-soft">
                Certificados emitidos pela plataforma são pessoais, intransferíveis e podem ser verificados
                publicamente através do código de validação impresso em cada certificado.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">6. Propriedade intelectual</h2>
              <p className="mt-1 text-ink-soft">
                O conteúdo dos cursos, vídeos, materiais e demais recursos disponibilizados na plataforma são
                protegidos por direitos autorais e não podem ser reproduzidos ou redistribuídos sem autorização.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">7. Alterações destes termos</h2>
              <p className="mt-1 text-ink-soft">
                Podemos atualizar estes Termos de Uso periodicamente. Alterações relevantes exigem que você reaceite
                os termos para continuar usando a plataforma.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">8. Contato</h2>
              <p className="mt-1 text-ink-soft">
                Dúvidas sobre estes termos podem ser enviadas para{' '}
                <strong className="text-ink">[E-MAIL DE CONTATO]</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
