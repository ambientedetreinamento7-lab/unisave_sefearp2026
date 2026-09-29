import { HeroBrandBar } from '../../components/HeroBrandBar'

export function Privacidade() {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <HeroBrandBar compact />

        <div className="card mt-8 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-ink">Política de Privacidade</h1>
          <p className="mt-1 text-sm text-ink-soft">Última atualização: 29 de setembro de 2026 · Versão 2</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-bold text-ink">1. Quem trata os seus dados</h2>
              <p className="mt-1 text-ink-soft">
                Esta Política de Privacidade explica como a UniSave, Universidade Savegnago, pertencente ao Grupo
                Savegnago — <strong className="text-ink">Savegnago Supermercados Ltda</strong> (CNPJ{' '}
                <strong className="text-ink">71.322.150/0001-60</strong>), responsável pela plataforma UniSave |
                SEFEARP, coleta, usa e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de
                Dados (Lei nº 13.709/2018 — LGPD).
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">2. Quais dados coletamos</h2>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                <li>Dados de cadastro: nome, e-mail, WhatsApp e, quando solicitada, data de nascimento.</li>
                <li>Curso, fase da faculdade e respostas do quiz PDI Express (maior desafio e objetivo curricular).</li>
                <li>Autoavaliações, objetivos e itens do seu Plano de Desenvolvimento Individual (PDI 70-20-10).</li>
                <li>Progresso em cursos e trilhas, resultados de quizzes e certificados emitidos.</li>
                <li>Publicações e interações na comunidade: posts, fotos, vídeos, stories, enquetes e comentários.</li>
                <li>Dados de gamificação: pontos, nível e posição no ranking.</li>
                <li>Registros técnicos de check-in por QR code no estande — a câmera é usada apenas em tempo real, no
                  seu próprio navegador, e nenhuma imagem ou vídeo é armazenado por nós.</li>
                <li>Preferências salvas localmente no seu navegador ou dispositivo, como tema (claro/escuro) e
                  instalação do aplicativo.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-ink">3. Para que usamos esses dados</h2>
              <p className="mt-1 text-ink-soft">
                Usamos seus dados para viabilizar seu acesso à plataforma, acompanhar seu progresso nos cursos, emitir
                certificados, personalizar recomendações de trilha e do seu PDI, calcular pontuação e ranking, exibir
                o painel de TV do estande durante o evento, e manter a segurança e o bom funcionamento do ambiente de
                comunidade.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">4. Quem tem acesso aos seus dados</h2>
              <p className="mt-1 text-ink-soft">
                Moderadores e administradores da plataforma podem acessar seu progresso e o conteúdo do seu PDI
                (autoavaliações e objetivos) para fins de acompanhamento pedagógico. Outros participantes veem apenas
                dados públicos de gamificação (nome, avatar, pontos e nível) e o conteúdo que você mesmo publica na
                comunidade. Durante o evento, nome, avatar e pontuação de destaque também podem ser exibidos
                publicamente no painel de TV do estande.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">5. Compartilhamento com terceiros</h2>
              <p className="mt-1 text-ink-soft">
                Não vendemos seus dados pessoais. Dados podem ser compartilhados com provedores de nuvem que dão
                suporte técnico à plataforma (hospedagem, banco de dados e armazenamento de arquivos), sempre sob
                obrigação de confidencialidade, ou quando exigido por lei ou autoridade competente.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">6. Seus direitos</h2>
              <p className="mt-1 text-ink-soft">
                Você pode solicitar, a qualquer momento, a confirmação, o acesso, a correção ou a exclusão dos seus
                dados pessoais, além da portabilidade e da revogação do consentimento, conforme previsto na LGPD.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">7. Retenção e exclusão</h2>
              <p className="mt-1 text-ink-soft">
                Mantemos seus dados pelo tempo necessário para as finalidades descritas nesta política. A plataforma é
                encerrada 180 dias após o último dia do evento; a partir dessa data, seus dados são excluídos ou
                mantidos apenas de forma anonimizada (por exemplo, em relatórios estatísticos), ou pelo tempo exigido
                por lei.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">8. Cookies e armazenamento local</h2>
              <p className="mt-1 text-ink-soft">
                Usamos armazenamento local do navegador para lembrar preferências como tema (claro/escuro) e manter
                sua sessão conectada. Não usamos cookies de rastreamento publicitário.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">9. Segurança</h2>
              <p className="mt-1 text-ink-soft">
                Adotamos medidas técnicas e administrativas razoáveis para proteger seus dados contra acesso não
                autorizado, perda ou alteração indevida.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">10. Contato do encarregado (DPO)</h2>
              <p className="mt-1 text-ink-soft">
                Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados, entre em contato pelo
                e-mail <strong className="text-ink">unisave@savegnago.com.br</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
