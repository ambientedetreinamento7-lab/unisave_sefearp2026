import { HeroBrandBar } from '../../components/HeroBrandBar'

export function Termos() {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <HeroBrandBar compact />

        <div className="card mt-8 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-ink">Termos de Uso</h1>
          <p className="mt-1 text-sm text-ink-soft">Última atualização: 29 de setembro de 2026 · Versão 2</p>

          <div className="mt-6 space-y-5 text-sm leading-relaxed text-ink">
            <section>
              <h2 className="font-bold text-ink">1. Quem somos</h2>
              <p className="mt-1 text-ink-soft">
                A plataforma UniSave | SEFEARP é operada pela UniSave, Universidade Savegnago, pertencente ao Grupo
                Savegnago — <strong className="text-ink">Savegnago Supermercados Ltda</strong>, inscrita no CNPJ{' '}
                <strong className="text-ink">71.322.150/0001-60</strong>. Ao criar uma conta, responder ao quiz do
                estande ou usar a plataforma de qualquer forma, você concorda com estes Termos de Uso.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">2. O que é a plataforma</h2>
              <p className="mt-1 text-ink-soft">
                A UniSave | SEFEARP é uma plataforma de treinamento e desenvolvimento profissional, com trilhas de
                curso (em vídeo, SCORM e H5P), quizzes de fixação, Plano de Desenvolvimento Individual (PDI) na
                metodologia 70-20-10, certificados, gamificação com ranking e uma comunidade de discussão entre
                participantes da IX SEFEA-RP — Semana Empresarial da FEA-RP. A plataforma foi desenvolvida
                exclusivamente para o evento, tendo como data de encerramento 180 dias após o seu último dia.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">3. Cadastro e conta</h2>
              <p className="mt-1 text-ink-soft">
                Seu cadastro pode começar pelo quiz PDI Express no estande do evento — onde coletamos nome, e-mail,
                WhatsApp, curso, fase da faculdade e maior desafio de desenvolvimento — ou diretamente pela tela de
                login. A confirmação do acesso é feita por link mágico enviado ao seu e-mail. A data de nascimento,
                quando solicitada, é usada apenas como verificação de segurança para recuperação de conta. Você é
                responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua
                conta, e deve informar dados verdadeiros e nos avisar assim que perceber uso não autorizado.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">4. Seu Plano de Desenvolvimento Individual (PDI)</h2>
              <p className="mt-1 text-ink-soft">
                No Meu PDI você registra autoavaliações de competências, objetivos pessoais e os itens de prática,
                troca de conhecimento e aprendizagem formal do seu plano. Essas informações podem ser visualizadas
                por moderadores e administradores da plataforma para fins de acompanhamento pedagógico e identificação
                de necessidades de desenvolvimento — elas não são exibidas publicamente a outros participantes.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">5. Comunidade e conteúdo publicado</h2>
              <p className="mt-1 text-ink-soft">
                Ao publicar posts, fotos, vídeos, stories, enquetes ou comentários na comunidade da plataforma, você
                declara ter os direitos necessários sobre esse conteúdo e concede à plataforma uma licença não
                exclusiva para exibi-lo dentro do ambiente da comunidade. Você concorda em não postar conteúdo
                ofensivo, discriminatório, ilegal ou que viole direitos de terceiros. Publicações podem passar por
                moderação e ser removidas a critério da equipe responsável.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">6. Gamificação, ranking e painel público do evento</h2>
              <p className="mt-1 text-ink-soft">
                Sua pontuação, nível e posição no ranking ficam visíveis a outros participantes dentro da plataforma.
                Durante o evento, nome, foto/avatar e pontuação de destaque também podem ser exibidos publicamente no
                painel de TV do estande, para fins de premiação e dinâmica do evento. Ao aceitar estes Termos, você
                concorda com essa exibição.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">7. Certificados</h2>
              <p className="mt-1 text-ink-soft">
                Certificados emitidos pela plataforma são pessoais, intransferíveis e podem ser verificados
                publicamente, sem necessidade de login, através do código de validação impresso em cada certificado.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">8. Check-in por QR code</h2>
              <p className="mt-1 text-ink-soft">
                Algumas atividades do estande usam a câmera do dispositivo para ler QR codes de check-in e liberar
                pontuação. A câmera é usada apenas localmente, em tempo real, e nenhuma imagem ou vídeo capturado é
                armazenado pela plataforma.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">9. Notificações</h2>
              <p className="mt-1 text-ink-soft">
                A plataforma pode enviar notificações (no navegador ou, se instalada como aplicativo, no dispositivo)
                sobre reações à sua conta, conclusão de cursos, progresso do seu PDI e pontos conquistados. Você pode
                desativá-las a qualquer momento nas configurações do seu navegador ou dispositivo.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">10. Propriedade intelectual</h2>
              <p className="mt-1 text-ink-soft">
                O conteúdo dos cursos, vídeos, materiais SCORM/H5P e demais recursos disponibilizados na plataforma
                são protegidos por direitos autorais e não podem ser reproduzidos ou redistribuídos sem autorização.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">11. Idade mínima</h2>
              <p className="mt-1 text-ink-soft">
                A plataforma é destinada a estudantes universitários e demais participantes maiores de 18 anos. Caso
                um participante menor de idade seja cadastrado, o consentimento de um responsável legal é necessário,
                conforme a legislação aplicável.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">12. Disponibilidade da plataforma</h2>
              <p className="mt-1 text-ink-soft">
                A plataforma é oferecida "como está", sem garantia de disponibilidade ininterrupta, e será encerrada
                180 dias após o último dia do evento, quando o acesso a cursos, PDI e certificados deixará de estar
                disponível online.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">13. Alterações destes termos</h2>
              <p className="mt-1 text-ink-soft">
                Podemos atualizar estes Termos de Uso periodicamente. Sempre que publicarmos uma nova versão, você
                precisará reaceitá-la para continuar usando a plataforma.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-ink">14. Contato</h2>
              <p className="mt-1 text-ink-soft">
                Dúvidas sobre estes termos podem ser enviadas para{' '}
                <strong className="text-ink">unisave@savegnago.com.br</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
