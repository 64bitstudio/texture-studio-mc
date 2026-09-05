// Jenkinsfile mínimo (mismo patrón que mail-core-mc/platform#002, punto 11):
// deploy: false porque todavía no existen Dockerfile/deploy/
// docker-compose.{dev,qa,prod}.yml/cleanup.sh reales -- eso llega con el
// ticket 001 (scaffold de la app). Sin buildAndTest tampoco: aún no hay
// código de aplicación que compilar/testear/analizar. Esta etapa queda
// como no-op explícito a propósito (ver corePipeline.groovy), no oculta.
//
// Cuando el ticket 001 traiga el scaffold real (frontend Vite+React+TS +
// backend Node), este Jenkinsfile se actualiza con buildAndTest real
// (npm ci + build + test + sonar-scanner, mismo patrón que
// mail-core-mc), containerPort/healthPath/healthyPattern del backend
// real, vhostFile y certbotDomains para
// texture-studio(.qa|-dev).64bitstudio.com, y se quita deploy: false.
@Library('platform') _

corePipeline(
    projectName: 'texture-studio-mc',
    deploy: false
)
