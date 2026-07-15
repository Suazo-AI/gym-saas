import Link from "next/link";
import styles from "./page.module.css";

const benefits = [
  {
    number: "01",
    title: "Membresías bajo control",
    copy: "Identifica quién está activo, quién vence pronto y quién necesita seguimiento.",
  },
  {
    number: "02",
    title: "Pagos sin confusión",
    copy: "Registra cobros en córdobas o dólares y mantén cada movimiento organizado.",
  },
  {
    number: "03",
    title: "Recepción más rápida",
    copy: "Encuentra miembros y registra entradas sin depender de hojas o cuadernos.",
  },
];

const activity = [
  ["JM", "José Martínez", "Entrada registrada", "8:42 AM"],
  ["AS", "Ana Salgado", "Membresía renovada", "8:18 AM"],
  ["CR", "Carlos Ruiz", "Nuevo miembro", "7:55 AM"],
];

export default function Home() {
  return (
    <main>
      <section className={styles.hero}>
        <nav className={styles.nav} aria-label="Navegación principal">
          <Link className={styles.brand} href="/">
            <span className={styles.mark}>F</span>
            Fit Manager
          </Link>
          <div className={styles.navLinks}>
            <a href="#funciones">Funciones</a>
            <a href="#como-funciona">Cómo funciona</a>
            <Link className={styles.login} href="/admin">Ver demo</Link>
          </div>
        </nav>

        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>Gestión simple para gimnasios</span>
            <h1>Tu gimnasio,<br /><em>en orden.</em></h1>
            <p>
              Controla membresías, pagos y entradas desde un solo lugar.
              Menos trabajo manual. Más tiempo para hacer crecer tu negocio.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/admin">Explorar el panel <span>→</span></Link>
              <a className={styles.secondary} href="#funciones">Conocer más</a>
            </div>
            <div className={styles.proof}>
              <div className={styles.avatars}><span>JM</span><span>AS</span><span>CR</span></div>
              <p><strong>Hecho para equipos pequeños</strong><br />Simple desde el primer día</p>
            </div>
          </div>

          <div className={styles.previewWrap} aria-label="Vista previa de Fit Manager">
            <div className={styles.glow} />
            <div className={styles.preview}>
              <div className={styles.previewTop}>
                <div><span className={styles.miniMark}>F</span><strong>Fit Manager</strong></div>
                <span className={styles.live}>● En línea</span>
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewHeading}>
                  <div><small>BUENOS DÍAS</small><h3>Resumen de hoy</h3></div>
                  <span>14 JUL 2026</span>
                </div>
                <div className={styles.metrics}>
                  <article><span>MIEMBROS ACTIVOS</span><strong>84</strong><small>↑ 6 este mes</small></article>
                  <article><span>ENTRADAS HOY</span><strong>27</strong><small>32% de activos</small></article>
                  <article><span>INGRESOS DEL MES</span><strong>C$ 91,250</strong><small>↑ 8.4%</small></article>
                </div>
                <div className={styles.activity}>
                  <div className={styles.activityTitle}><strong>Actividad reciente</strong><span>Ver todo</span></div>
                  {activity.map(([initials, name, event, time]) => (
                    <div className={styles.activityRow} key={name}>
                      <span className={styles.avatar}>{initials}</span>
                      <div><strong>{name}</strong><small>{event}</small></div>
                      <time>{time}</time>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.benefits} id="funciones">
        <div className={styles.sectionIntro}>
          <span>LO ESENCIAL, BIEN HECHO</span>
          <h2>Todo lo que necesitas.<br />Nada que te estorbe.</h2>
        </div>
        <div className={styles.benefitGrid}>
          {benefits.map((benefit) => (
            <article key={benefit.number}>
              <span>{benefit.number}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.cta} id="como-funciona">
        <span>EMPIEZA SIMPLE</span>
        <h2>Tu operación clara desde el primer vistazo.</h2>
        <p>Esta es una primera versión visual. Explora el panel con datos de demostración.</p>
        <Link href="/admin">Abrir panel administrativo →</Link>
      </section>

      <footer className={styles.footer}>
        <span><b>F</b> Fit Manager</span>
        <p>Gestión simple para gimnasios que quieren crecer.</p>
        <small>© 2026 Fit Manager</small>
      </footer>
    </main>
  );
}
