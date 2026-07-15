import Link from "next/link";
import styles from "./admin.module.css";

const nav = ["Resumen", "Miembros", "Membresías", "Pagos", "Entradas", "Reportes"];
const members = [
  { initials: "AM", name: "Ana Martínez", plan: "Mensual", status: "Activo", date: "14 ago 2026" },
  { initials: "JR", name: "Jorge Ramírez", plan: "Mensual", status: "Por vencer", date: "16 jul 2026" },
  { initials: "LC", name: "Lucía Castillo", plan: "Trimestral", status: "Activo", date: "02 oct 2026" },
  { initials: "DS", name: "Diego Sánchez", plan: "Mensual", status: "Vencido", date: "10 jul 2026" },
];

export default function AdminPage() {
  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/"><span>F</span>Fit Manager</Link>
        <div className={styles.gym}><small>GIMNASIO ACTUAL</small><strong>Impulso Fitness</strong><span>Managua, Nicaragua</span></div>
        <nav>
          {nav.map((item, index) => <a className={index === 0 ? styles.active : ""} href="#" key={item}><i>{["⌂","♙","▣","$","✓","↗"][index]}</i>{item}</a>)}
        </nav>
        <div className={styles.sideBottom}>
          <a href="#"><i>⚙</i>Configuración</a>
          <div className={styles.user}><span>JS</span><div><strong>Jason Suazo</strong><small>Propietario</small></div><b>⋯</b></div>
        </div>
      </aside>

      <section className={styles.content}>
        <header>
          <div><small>MARTES, 14 DE JULIO</small><h1>Buenos días, Jason.</h1><p>Esto es lo que está pasando en tu gimnasio hoy.</p></div>
          <div className={styles.headerActions}><button aria-label="Notificaciones">◦</button><button className={styles.add}>＋ Nuevo miembro</button></div>
        </header>

        <div className={styles.stats}>
          <article><span>MIEMBROS ACTIVOS <i>↗</i></span><strong>84</strong><small><b>↑ 6</b> desde el mes pasado</small></article>
          <article><span>ENTRADAS HOY <i>✓</i></span><strong>27</strong><small>32% de miembros activos</small></article>
          <article><span>INGRESOS DEL MES <i>$</i></span><strong>C$ 91,250</strong><small><b>↑ 8.4%</b> vs. mes pasado</small></article>
          <article><span>POR VENCER <i>!</i></span><strong>9</strong><small><em>Próximos 7 días</em></small></article>
        </div>

        <div className={styles.grid}>
          <article className={styles.chartCard}>
            <div className={styles.cardTitle}><div><small>INGRESOS</small><h2>Rendimiento mensual</h2></div><select aria-label="Periodo"><option>Últimos 6 meses</option></select></div>
            <div className={styles.chart}>
              <div className={styles.yAxis}><span>100k</span><span>75k</span><span>50k</span><span>25k</span><span>0</span></div>
              {[48,62,57,75,69,91].map((height,index)=><div className={styles.barCol} key={index}><div><span style={{height:`${height}%`}} /></div><small>{["FEB","MAR","ABR","MAY","JUN","JUL"][index]}</small></div>)}
            </div>
          </article>

          <article className={styles.quickCard}>
            <div className={styles.cardTitle}><div><small>ACCESOS RÁPIDOS</small><h2>¿Qué quieres hacer?</h2></div></div>
            <button><span>＋</span><div><strong>Registrar miembro</strong><small>Agrega una nueva persona</small></div><b>→</b></button>
            <button><span>$</span><div><strong>Registrar pago</strong><small>Cobra una membresía</small></div><b>→</b></button>
            <button><span>✓</span><div><strong>Registrar entrada</strong><small>Confirma una visita</small></div><b>→</b></button>
          </article>
        </div>

        <article className={styles.tableCard}>
          <div className={styles.cardTitle}><div><small>MIEMBROS</small><h2>Actividad reciente</h2></div><button>Ver todos →</button></div>
          <div className={styles.table}>
            <div className={styles.tableHead}><span>MIEMBRO</span><span>PLAN</span><span>ESTADO</span><span>PRÓXIMO VENCIMIENTO</span><span /></div>
            {members.map(member=><div className={styles.tableRow} key={member.name}><div><span>{member.initials}</span><strong>{member.name}</strong></div><span>{member.plan}</span><span><i className={styles[member.status.replace(" ","").toLowerCase()]}>{member.status}</i></span><span>{member.date}</span><button>•••</button></div>)}
          </div>
        </article>
        <p className={styles.demo}>Vista de demostración · Los datos mostrados son ficticios</p>
      </section>
    </main>
  );
}
