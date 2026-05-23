# Propuesta: Panel de Administración Nativo en Quid-App

## Visión General
Implementar un "Modo Administrador" integrado directamente en la aplicación, exclusivo y seguro, atado al correo del propietario (`rqcquintero@gmail.com`). El objetivo principal es tener un lugar desde donde hacer limpieza y mantenimiento de la base de datos (PostgreSQL) sin necesidad de acceder a herramientas de desarrollo como Prisma Studio o conectarse directamente por SQL.

## Características Propuestas

### 1. Interfaz de Usuario Condicional (Seguridad Visual)
El botón o acceso al "Modo Administrador" solo se renderizará en el menú de "Ajustes" si el usuario activo tiene una sesión donde el `email` coincide exactamente con el del administrador. Para el resto de los usuarios (nuevos o existentes), esta opción simplemente no existirá en su pantalla.

### 2. Dashboard de Gestión de Usuarios
Una interfaz que liste a los usuarios registrados en la base de datos y permita visualizar:
* Fecha de registro.
* Estado y cantidad de datos (cuántas cuentas tienen, transacciones, etc.).

### 3. Borrado Seguro y en Cascada
Un botón de eliminación directa de un usuario. Al presionarlo, el sistema no solo borrará al usuario de la tabla `User`, sino que, al aprovechar las relaciones de cascada configuradas en el esquema de Prisma (PostgreSQL), limpiará automáticamente todas sus dependencias asociadas (cuentas, presupuestos, transacciones, etc.), garantizando que no queden "registros huérfanos".

### 4. Búsqueda y Limpieza de Huérfanos
Una herramienta que analice registros que pudieran haber quedado desligados de un usuario válido (por fallos o testing antiguo) y ofrezca la posibilidad de eliminarlos con un solo clic.

## Arquitectura de Seguridad (Doble Capa)

* **Protección Frontend (Ocultamiento):** Ocultar los botones/enlaces en la interfaz.
* **Protección Backend (API y Rutas):** 
  * Las rutas (ej. `/admin`) validarán la sesión mediante `getServerSession`. Si el correo no es de admin, la página retornará un error 404 (Not Found), escondiendo el hecho de que la ruta siquiera existe.
  * Cualquier endpoint de la API (`/api/admin/...`) rechazará inmediatamente cualquier petición con un error de autorización (401 o 403) si el solicitante no es el administrador.

## Beneficios
* Control total del mantenimiento de la base de datos de producción desde la propia app.
* No requiere abrir puertos extra en el servidor Oracle.
* Interfaz amigable para tareas que, de otro modo, requerirían ejecutar scripts SQL manualmente.

---

# Propuesta: Sistema Inteligente de Sugerencia de Fondo de Emergencia

## Visión General
Dentro del módulo de finanzas, en el apartado de **Metas (Savings Goals)**, integrar un sistema analítico (o apoyado por Aura) que detecte de manera proactiva momentos ideales para sugerir al usuario la creación o aportación a un "Fondo de Emergencia".

## Parámetros Analizados para la Sugerencia
El sistema (o Aura) evaluará el panorama financiero actual del usuario utilizando las siguientes variables antes de hacer la sugerencia:

1. **Liquidez Disponible:** Hay dinero líquido en las cuentas principales.
2. **Cobertura de Pagos:** Los pagos recurrentes y cuotas de deudas (Installments) del mes actual ya están cubiertos o el saldo restante es superior al dinero necesario para cubrirlos.
3. **Inactividad de Gastos:** Se detectan varios días recientes sin salidas de dinero (no se ha gastado, lo que indica estabilidad o control temporal).
4. **Ingresos Próximos (Quincena/Nómina):** Por el historial de transacciones o ingresos recurrentes detectados, el sistema prevé que el usuario está próximo a recibir una inyección de dinero (ej. en los próximos 3-5 días).

Cuando esta matriz de condiciones se cumpla, el sistema mostrará un prompt proactivo:
> *"Oye, tienes dinero disponible y estás próximo a recibir tus ingresos. ¿Qué te parece si creamos/aportamos a un fondo de emergencia?"*

## Estructura del Fondo de Emergencia
Si el usuario acepta la propuesta, el sistema auto-configurará la estructura ideal del fondo:

* **Monto Meta (Target Amount):** Calculado automáticamente multiplicando el promedio de gastos mensuales esenciales (o la sumatoria de pagos recurrentes) por **3 a 6 meses**.
* **Plazo de Tiempo (Time Horizon):** Tiempo sugerido para alcanzar la meta (ej. 1 año).
* **Aporte Mensual Sugerido:** La cuota mensual necesaria para llegar a la meta en el tiempo estipulado, adaptada a la liquidez promedio del usuario.

---

# Propuesta: Sistema de Recordatorios Personalizados para Vehículos (Inspiración Drivvo)

## Visión General
Mejorar el módulo de Transportes/Vehículos añadiendo una sección completa y personalizable para la gestión del mantenimiento preventivo. El objetivo es ofrecer una experiencia similar a aplicaciones especializadas como *Drivvo*, pero sin publicidad y totalmente integrada en el ecosistema Quid.

## Características Propuestas

### 1. Gestión Integral de Recordatorios (CRUD)
* **Añadir, Editar y Eliminar:** Interfaz completa para gestionar alertas de mantenimiento para cualquier componente (cambio de aceite, revisión de bujías, cambio de filtros, empaques, llantas, etc.).

### 2. Triggers (Desencadenadores) Personalizables
A diferencia del sistema actual que usa asignaciones de kilometraje fijas, el nuevo sistema permitirá total libertad para que el usuario defina *cómo* y *cuándo* ser notificado:
* **Por Tiempo:** "Avisarme cada X meses/días".
* **Por Kilometraje:** "Avisarme cada X kilómetros recorridos".
* **Híbrido (Lo que ocurra primero):** "Avisarme a los 10,000 km o en 6 meses".

### 3. Interfaz de Usuario (UI) Modular y por Pestañas
Para evitar sobrecargar la pantalla con demasiada información (evitando scroll infinito), el módulo completo de Transporte/Vehículos se reestructurará utilizando el mismo sistema de pestañas (tabs) que ya usamos en el módulo de Finanzas. La navegación quedará dividida en apartados limpios:

* **Resumen:** Una pantalla inicial con *widgets* e indicadores clave (gasto total del mes, próximo mantenimiento más urgente, consumo promedio, etc.).
* **Combustible:** Historial y métricas exclusivas de recargas y rendimiento de combustible.
* **Mantenimiento:** Historial de facturas, gastos de taller y reparaciones ya realizadas.
* **Recordatorios:** La nueva pantalla dedicada exclusivamente a gestionar las alertas futuras. Aquí cada recordatorio tendrá su propia tarjeta visual (card) que mostrará, mediante barras de progreso y colores (verde, amarillo, rojo), qué tan cerca está de requerir servicio.

---

# Propuesta: Reestructuración del Formulario de Mantenimiento (Vehículos)

## Visión General
Actualmente, el registro de un nuevo mantenimiento está limitado. Si se requiere añadir un ítem que no está en la lista estándar, el formulario solo permite añadir el nombre, pero no el precio individual. Además, se dificulta agregar múltiples ítems nuevos en la misma transacción. La propuesta es rediseñar este formulario para que funcione de manera dinámica, similar a un "carrito de compras".

## Características Propuestas

### 1. Formulario Dinámico (Estilo Carrito de Compras)
* El usuario podrá añadir múltiples ítems en un solo registro de mantenimiento. Por ejemplo, en una sola visita al taller podrá registrar: Cambio de aceite, Compra de 3 repuestos diferentes, y Mano de obra, todo en la misma factura.

### 2. Asignación de Precios Individuales
* Cada vez que se seleccione o se añada un nuevo ítem personalizado, el sistema permitirá y exigirá colocar el precio exacto de ese ítem. El costo total del mantenimiento se calculará automáticamente como la sumatoria de todos los ítems en el "carrito".

### 3. Guardado en el Listado Maestro
* Cualquier ítem nuevo creado por el usuario (ej. "Empaque de culata") no solo servirá para ese registro, sino que quedará guardado permanentemente en su listado estándar de ítems. De este modo, en futuros mantenimientos podrá seleccionarlo directamente de la lista.

---

# Propuesta: Gestor de Medicamentos en el Módulo de Salud

## Visión General
Se requiere empezar a modelar el módulo de Salud incorporando un completo "Gestor de Medicamentos". El objetivo es llevar un control riguroso tanto de las tomas como de las existencias (inventario) de cada medicina, asegurando la adherencia a los tratamientos médicos y brindando inteligencia asistida sobre cada fármaco.

## Características Propuestas

### 1. Registro Asistido con Autocompletado (Internet/API)
* Al añadir el nombre del medicamento o de la enfermedad, la aplicación consumirá una API médica de internet para ofrecer **autocompletado predictivo**. Por ejemplo, al escribir "acet", el sistema sugerirá en tiempo real "Acetaminofén" y otras variantes válidas, estandarizando los nombres de medicinas y diagnósticos.

### 2. Resumen Clínico Inteligente (Validado por Aura)
* Una vez el usuario finalice el registro (indicando cantidad total, dosis y frecuencia), el sistema (a través del LLM/Aura) generará y mostrará una **ficha resumen** que incluirá:
  * Para qué sirve realmente el medicamento.
  * Los principales efectos secundarios esperados.
  * Una validación de si la pastilla introducida es verdaderamente efectiva y congruente con la enfermedad que el usuario seleccionó.

### 3. Control de Inventario (Existencias)
* El sistema llevará la cuenta de la cantidad física disponible (pastillas, dosis, mililitros). Al ir confirmando las tomas, el inventario se reducirá automáticamente, pudiendo avisar oportunamente cuando sea necesario comprar más.

### 4. Recordatorios con Sonido Distintivo (Dosificación)
* Se configurarán alertas precisas indicando la frecuencia y el horario exacto de cada toma.
* Las notificaciones push en el celular tendrán un **sonido característico y personalizado (similar al sonido de agitar un pastillero)**. Esto permitirá que el usuario sepa inmediatamente de qué trata la alarma sin siquiera tener que mirar la pantalla.

### 5. Recomendaciones de Consumo y Pestaña de Asistencia
* El sistema (impulsado por Aura) emitirá recomendaciones médicas personalizadas sobre *cómo* debe consumirse cada pastilla:
  * Si se debe tomar en ayunas o con alimentos.
  * Si es preferible tomarla de día o de noche según sus efectos secundarios (ej. somnolencia).
  * Advertencias de interacciones peligrosas si se cruza con otros medicamentos ya registrados en tu perfil.
* Toda esta inteligencia se consolidará en una **pestaña dedicada de "Recomendaciones"** dentro del módulo de Salud. Así, el usuario sentirá que cuenta con un verdadero asistente clínico velando por su seguridad, evitando tomar medicinas de forma incorrecta por desconocimiento.

---

# Propuesta: Gestor de Citas Médicas Integrado (Módulo de Salud)

## Visión General
Se añadirá una sección para gestionar Citas Médicas dentro del módulo de Salud. Esta sección no solo permitirá llevar la agenda médica, sino que estará profundamente interconectada con el módulo de Finanzas para automatizar el registro de copagos y gastos médicos.

## Características Propuestas

### 1. Gestión de Citas y Alertas Previas
* **Registro Detallado:** Permite registrar qué especialista vas a visitar, qué te van a tratar, fecha y hora.
* **Sistema de Recordatorios Escalonados:**
  * Alertas previas configurables: 1, 2 o 3 días antes de la cita.
  * Alerta el mismo día: Horas antes de la cita para preparar la salida.
* **Reprogramación:** Opción ágil para modificar la fecha u hora si la clínica la aplaza.

### 2. Flujo de Finalización e Interconexión Financiera (Copagos)
* Al marcar una cita como "Completada", el sistema desplegará automáticamente un formulario consultando si se generó algún **copago o gasto médico**, y si se generó una **Orden Médica** (medicamentos o controles).
* Si hubo gasto, pedirá el monto y permitirá seleccionar con qué cuenta financiera se pagó (Efectivo, Tarjeta de Crédito, Cuenta Débito, etc., listando tus cuentas reales de Quid).
* **Viaje de Datos Automático:** Al confirmar, este pago viajará de inmediato al módulo de Finanzas, registrándose como una transacción de gasto.
* **Viaje a Salud:** Si se generó una orden médica, el usuario será guiado a registrar los medicamentos recetados, atándolos inmediatamente a esta cita.

### 3. Reversión y Eliminación Segura
* **Reversión (Undo):** Si marcaste la cita como completada por error, puedes revertirla. Esto buscará automáticamente la transacción en el módulo de Finanzas y la eliminará/revertirá para devolver el saldo.
* **Eliminación Total:** Si borras la cita médica por completo, se eliminá junto con todo su historial asociado (pagos de copago, recordatorios), asegurando que los registros financieros queden intactos y sincronizados.

---

# Propuesta: Gestor de Órdenes Médicas y Entregas Pendientes

## Visión General
A menudo, tras una cita médica, se emite una fórmula u orden para varios meses de tratamiento, pero la farmacia solo entrega medicamentos para un mes (o no tienen inventario de alguno). Este submódulo gestionará esas entregas parciales y reclamaciones futuras, conectando el mundo de las citas con el inventario de medicinas.

## Características Propuestas

### 1. Trazabilidad (Vinculación a la Cita)
* Toda orden médica podrá vincularse directamente a la **Cita Médica** que la originó y a un **Número de Orden** específico. Esto crea un historial limpio donde se sabe exactamente qué médico recetó qué cosa y cuándo.

### 2. Control Lógico de Entregas Parciales (Dosis por Meses)
* El usuario registrará la receta médica completa (ej. 30 pastillas de un medicamento X para un tratamiento de 3 meses). El sistema subdividirá esto matemáticamente en "entregas" o "dosis mensuales" (ej. 3 entregas de 10 pastillas cada una).
* Al ir a la farmacia, la app desplegará un formulario interactivo detallando lo que se debe recibir en esa entrega. El usuario verificará exactamente qué le dieron de esa lista.
* **Separación Visual de Pendientes:** Para no mezclar información, habrá una ventana o pestaña independiente dedicada exclusivamente a los "Pendientes". Al entrar allí, el usuario verá dos mundos claramente divididos:
  1. **Pendientes de la Dosis Actual (Faltantes de inventario):** Lo que te debieron entregar hoy pero la farmacia no tenía (ej. te dieron la Medicina A, pero quedaron debiendo la B).
  2. **Pendientes por Reclamar a Futuro (Próximas entregas):** Las dosis completas de los meses venideros (ej. la entrega 2 y 3 del tratamiento).
* Esta división garantiza un seguimiento matemático estricto y una visualización limpia de lo que la EPS o farmacia te debe a corto y largo plazo.

### 3. Evidencia Fotográfica (Soporte Físico)
* El sistema permitirá adjuntar una **fotografía de la orden médica física o del comprobante de pendientes** emitido por la farmacia. Esto servirá como "testigo" o soporte visual al momento de volver a reclamar, evitando los problemas si se pierde la fórmula en papel.

### 4. Recordatorios de Reclamación Futura
* Para los medicamentos que quedaron pendientes para el mes siguiente, el sistema programará automáticamente un recordatorio (ej. en 25 días) alertando al usuario: *"Es hora de ir a reclamar la siguiente entrega de tu tratamiento de la Orden #12345"*.

---

# Propuesta: Módulo de Despensa (Nevera Virtual)

## Visión General
Crear un módulo dedicado a la gestión de alimentos del hogar. Funcionará como una "Nevera Virtual" donde el usuario podrá llevar un inventario en tiempo real de lo que tiene en su cocina, automatizando la creación de listas de mercado y recibiendo sugerencias de recetas inteligentes adaptadas a su perfil de salud.

## Características Propuestas

### 1. Inventario Base (Stock de Alimentos)
* El usuario podrá registrar su "mercado base" o inventario ideal (ej. 1 lb de tomates, 1 lb de cebolla, 2 lb de carne).
* A medida que se consumen, se puede ir restando del inventario virtual.

### 2. Generación Inteligente de Lista de Mercado
* Cuando el inventario esté bajo, un botón de **"Generar Lista de Mercado"** calculará automáticamente los faltantes basándose en el stock ideal y creará la lista de compras.
* **Control de Precios y Unidades:** La lista permitirá relacionar precios, cantidades y **unidad de medida**. 
* **Conversión de Unidades Automática:** Si el precio histórico de un producto está registrado por Kilogramo, pero el usuario va a comprar en Libras o Gramos, el sistema debe hacer la conversión matemática automática para proyectar el costo exacto.

### 3. Generador de Recetas Inteligente (Impulsado por Aura)
* **Con lo que hay en la Nevera:** Aura propondrá recetas creativas utilizando exclusivamente los ingredientes disponibles en el inventario actual.
* **Recetas con Faltantes:** También podrá proponer una receta ideal y advertir: *"Te faltan estos ingredientes"*, dando la opción inmediata de agregarlos a la Lista de Mercado.

### 4. Perfiles de Salud Múltiples e Invitaciones (Familia/Invitados)
* **Invitaciones entre Usuarios Quid:** Si un familiar o pareja también usa Quid, el usuario podrá enviarle una "invitación de conexión". Si la otra persona acepta, su Perfil de Salud completo (restricciones alimentarias, alergias, enfermedades) se vinculará y reflejará automáticamente en la cuenta del anfitrión. Esto evita el trabajo de registrar a mano las condiciones de salud de otros y funciona de forma bidireccional.
* **Perfiles Locales (Manuales):** Para niños, invitados esporádicos o personas que no usan la app, el usuario podrá seguir creando perfiles manualmente con sus restricciones (ej. celiaquía o alergia a nueces).
* **Dietas Cruzadas (Inteligencia Colectiva):** Al momento de generar una receta, el usuario seleccionará para quiénes cocinará. Aura cruzará automáticamente las restricciones de todos los perfiles elegidos (ej. la diabetes del anfitrión + la intolerancia a la lactosa del invitado vinculado) para proponer un plato 100% seguro para todos los comensales.

### 5. Interconexión Financiera del Mercado
* Al regresar del supermercado, el usuario abrirá su "Lista de Mercado" en la app para confirmar que todos los productos llegaron y verificará que los precios finales sean correctos.
* **Viaje de Datos Automático:** Al confirmar la compra, el sistema preguntará con qué cuenta se pagó (Efectivo, Tarjeta, etc.) y enviará automáticamente este valor total al módulo de Finanzas, registrándolo como un gasto para mantener el presupuesto perfectamente cuadrado.
