import { HeroBrandBar } from '../../components/HeroBrandBar'

export function Privacidade() {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <HeroBrandBar compact />

        <div className="card mt-8 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-ink">Política de Privacidade</h1>
          <p className="mt-1 text-sm text-ink-soft">Última atualização: 27 de agosto de 2026 · Versão 1</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-bold text-ink">1. Quem trata os seus dados</h2>
              <p className="mt-1 text-ink-soft">
                Esta Política de Privacidade explica como <strong className="text-ink">[RAZÃO SOCIAL]</strong>{' '}
                (CNPJ <strong className="text-ink">[CNPJ]</strong>), responsável pela plataforma UniSave | SEFEARP,
                coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
                (Lei nº 13.709/2018 — LGPD).
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">2. Quais dados coletamos</h2>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                <li>Dados de cadastro: nome e e-mail.</li>
                <li>Respostas do quiz de perfil e resultados associados.</li>
                <li>Progresso em cursos, trilhas e certificados emitidos.</li>
                <li>Plano de Desenvolvimento Individual (PDI) criado por você.</li>
                <li>Publicações e interações na comunidade da plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-ink">3. Para que usamos esses dados</h2>
              <p className="mt-1 text-ink-soft">
                Usamos seus dados para viabilizar seu acesso à plataforma, acompanhar seu progresso nos cursos,
                emitir certificados, personalizar recomendações de trilha e manter a segurança e o bom funcionamento
                do ambiente de comunidade.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">4. Compartilhamento de dados</h2>
              <p className="mt-1 text-ink-soft">
                Não vendemos seus dados pessoais. Dados podem ser compartilhados com prestadores de serviço que
                dão suporte técnico à plataforma (ex.: hospedagem e infraestrutura), sempre sob obrigação de
                confidencialidade, ou quando exigido por lei.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">5. Seus direitos</h2>
              <p className="mt-1 text-ink-soft">
                Você pode solicitar, a qualquer momento, a confirmação, o acesso, a correção ou a exclusão dos seus
                dados pessoais, além da portabilidade e da revogação do consentimento, conforme previsto na LGPD.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">6. Retenção e segurança</h2>
              <p className="mt-1 text-ink-soft">
                Mantemos seus dados apenas pelo tempo necessário para as finalidades descritas nesta política ou
                conforme exigido por lei, adotando medidas técnicas e administrativas razoáveis para protegê-los
                contra acesso não autorizado.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">7. Contato do encarregado (DPO)</h2>
              <p className="mt-1 text-ink-soft">
                Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados, entre em contato pelo
                e-mail <strong className="text-ink">[E-MAIL DE CONTATO]</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
