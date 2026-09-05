// Ticket 001: reemplaza el Jenkinsfile minimo de platform/002 (punto 11,
// `deploy: false`, sin buildAndTest) -- ahora que existen
// backend/Dockerfile, deploy/docker-compose.{dev,qa,prod}.yml y
// deploy/cleanup.sh, se activa el pipeline de aplicacion real: build +
// lint + test (frontend Vite+React+TS, backend Node minimo) + analisis
// SonarQube + build de imagen + deploy dev/qa/prod + promocion manual a
// PROD (gate exclusivo de Marco, sin cambios -- lo gestiona
// corePipeline mismo).
//
// containerPort: 3000 (backend escucha en process.env.PORT ?? 3000, ver
// backend/src/server.ts) -- el default de corePipeline es 8080 (asume
// Spring Boot), asi que hay que pasarlo explicito.
// healthPath: '/health' (backend/src/routes/health.ts).
// healthyPattern: la respuesta exitosa es {"status":"ok"} (el default de
// corePipeline, '"status":"UP"', es de Spring Boot Actuator y nunca
// aparaceria aqui).
//
// skipVaultSecrets: true -- este proyecto NO tiene base de datos ni
// secretos propios (ver docs/BASE_DE_DATOS.md, "N/A en el MVP"): sin
// este flag, corePipeline intentaria buscar
// secret/texture-studio-mc/<env> en Vault en cada deploy y fallaria
// ruidosamente (DB_PASSWORD nunca existira ahi, porque no hay nada que
// guardar). Ver corePipeline.groovy, contrato de `skipVaultSecrets`
// ("escape hatch explicito... para el caso... de un core que todavia no
// migro su secreto a Vault" -- aqui aplica el mismo mecanismo, pero
// porque nunca habra secreto, no porque falte migrarlo).
//
// vhostFile/certbotDomains: subdominios confirmados por Marco --
// texture-studio.64bitstudio.com (prod) / texture-studio-qa (qa) /
// texture-studio-dev (dev). Mismo patron ya establecido por
// auth-core-mc/mail-core-mc. Ver deploy/vm-infra/nginx/texture-studio-mc.conf.
//
// buildAndTest: dos subproyectos (frontend/, backend/) en vez de uno
// solo -- el build del frontend (Vite) se compila y su `dist/` se copia
// a `backend/public/` ANTES de que corePipeline corra
// `docker build ./backend` (contexto de build fijo, no configurable por
// proyecto -- ver la nota completa en backend/Dockerfile y
// docs/ARQUITECTURA.md, "Build de la imagen: frontend + backend en un
// solo Dockerfile"). Requiere Node.js 24 + sonar-scanner CLI en la
// imagen de Jenkins (ya agregados en platform para mail-core-mc, ver
// corePipeline.groovy) -- el withEnv de abajo activa el PATH del
// scanner solo para este closure.
@Library('platform') _

corePipeline(
    projectName: 'texture-studio-mc',
    containerPort: 3000,
    healthPath: '/health',
    healthyPattern: '"status":"ok"',
    vhostFile: 'deploy/vm-infra/nginx/texture-studio-mc.conf',
    certbotDomains: ['texture-studio.64bitstudio.com', 'texture-studio-qa.64bitstudio.com', 'texture-studio-dev.64bitstudio.com'],
    skipVaultSecrets: true,
    buildAndTest: {
        withEnv(["PATH+SONAR=/opt/sonar-scanner/bin"]) {
            dir('frontend') {
                sh 'npm ci'
                sh 'npm run lint'
                // Ticket 002: primer runner de tests del frontend
                // (Vitest, solo logica pura de TextureBuffer -- ver
                // docs/COMPONENTES.md). Antes de este ticket no habia
                // ningun `npm test` de frontend que correr aqui.
                sh 'npm test'
                sh 'npm run build'
            }

            // Aterriza el build del frontend DENTRO del contexto fijo de
            // `docker build ./backend` (ver backend/Dockerfile) -- debe
            // ocurrir antes de que corePipeline invoque ese build de
            // imagen, y este es el unico lugar del pipeline donde ambos
            // subproyectos coexisten en el mismo workspace.
            sh 'rm -rf backend/public && mkdir -p backend/public && cp -r frontend/dist/. backend/public/'

            dir('backend') {
                sh 'npm ci'
                sh 'npm run lint'
                sh 'npm run build'
                withSonarQubeEnv('sonarqube-vm') {
                    sh 'npm run test:cov'
                    sh 'sonar-scanner'
                }
            }
        }
    }
)
