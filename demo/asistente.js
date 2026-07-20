/* ============================================================================
   UNAM Inteligente — capa IA de la demo (asistente.js)
   SintelIA · 2026-07 · JS vanilla, sin backend, sin dependencias.

   CÓMO AGREGAR UN INTENT NUEVO — append al array INTENTS, nada más:
   {
     id:        'slug-unico',
     nombre:    'Título de la card',
     prioridad: 1-10,            // según 20-RANKING-DOLORES (10 = dolor máximo);
                                 // ordena sugerencias y desempata scores
     keywords:  ['frase con espacios', 'token'],
                                 // frase (contiene espacio) presente en la query → +4
                                 // token suelto con match exacto de palabra   → +2
                                 // todo se normaliza (minúsculas, sin acentos)
     fuente:    'dgae.unam.mx',  // dominio del badge "Fuente oficial"
     respuesta(){ return `<p>HTML de la respuesta…</p>`; }
                                 // SOLO datos del research verificado
                                 // (clientes/unam/research-unam/), cifras en <strong>
   }

   Matching: score por keywords; top-1 si score ≥ 4 y ventaja ≥ 3 sobre el
   segundo; top-3 (card de ambigüedad) si hay empate o señal débil; fallback
   honesto si nadie llega a 2.

   API pública: window.AsistenteUNAM = { responder, resolver, intents }
   Hooks del DOM (los crea demo/index.html): form#omnibox, #omnibox-input,
   #omnibox-results, botones .sugerencia[data-q]. Si no existen, el motor
   sigue funcionando standalone (modo de prueba / QA con Node).
============================================================================ */

(function () {
  'use strict';

  /* ---------- utilidades ---------- */

  function normaliza(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function badge(fuente) {
    return '<span class="asist-fuente" title="Dato verificado en fuente oficial">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0 2 2v5c0 4 2.6 7.2 6 9 3.4-1.8 6-5 6-9V2L8 0Zm3.2 5.8-3.7 4.5a.7.7 0 0 1-1.1 0L4.8 8.4l1.1-.9 1.1 1.3 3.1-3.9 1.1.9Z"/></svg>' +
      'Fuente oficial: ' + escapeHtml(fuente) + '</span>';
  }

  /* ---------- diccionario de intents ---------- */

  var INTENTS = [

    /* ===== Titulación y título ===== */

    {
      id: 'titulo-tiempo',
      nombre: '¿Cuánto tarda el título?',
      prioridad: 9,
      keywords: ['cuanto tarda el titulo', 'cuanto tarda mi titulo', 'cuanto tiempo tarda', 'tramite de titulo', 'emision de titulo', 'emision de mi titulo', 'tarda en salir el titulo', 'titulo', 'grado', 'diploma'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>El título, grado o diploma se entrega <strong>a los 25 días hábiles</strong> posteriores a que tu plantel entrega la carpeta de titulación a la Dirección de Certificación y Control Documental (cita literal de la DGAE).</p>' +
          '<ul><li>El trámite <strong>inicia en Servicios Escolares de tu plantel</strong>, tras el examen profesional o tu opción de titulación.</li>' +
          '<li>Eliges material: papel seguridad, cartulina imitación pergamino o pergamino piel de cabra — la decisión es <strong>irrevocable</strong>.</li>' +
          '<li>Sigue el avance en <strong>escolar.unam.mx → "Consulta Trámite de Titulación y Graduación"</strong>: al final del <strong>renglón 15</strong> aparece la fecha para recogerlo.</li></ul>';
      }
    },
    {
      id: 'titulo-en-tramite',
      nombre: 'Constancia de título en trámite',
      prioridad: 8,
      keywords: ['titulo esta en tramite', 'titulo en tramite', 'constancia de titulo', 'que constancia puedo entregar', 'comprobar que mi titulo'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Existe la <strong>constancia de título o grado en trámite</strong>: comprueba ante cualquier instancia que tu documento está en elaboración.</p>' +
          '<ul><li>Se solicita en <strong>TRAMITEL</strong> (Dirección de Certificación y Control Documental) cuando ya recibieron tu <strong>Acta de Examen</strong> aprobada.</li>' +
          '<li>Requisitos: formato de TRAMITEL + identificación oficial (original y fotocopia). Debe tener <strong>destinatario definido</strong> — no puede ir "A QUIEN CORRESPONDA".</li>' +
          '<li>Tiempo oficial: <strong>3 días hábiles</strong>. Horario: L–V <strong>9:00–15:00 y 17:00–18:00</strong>.</li></ul>';
      }
    },
    {
      id: 'titulo-fotos',
      nombre: 'Fotografías para trámites',
      prioridad: 5,
      keywords: ['fotografias', 'fotos', 'ovaladas', 'cuantas fotos', 'fotos necesito'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Requisitos oficiales de fotografías:</p>' +
          '<ul><li><strong>Título o grado en pergamino/cartulina:</strong> 6 fotografías tamaño título, <strong>ovaladas (6 × 9 cm)</strong>, blanco y negro, fondo gris claro, papel mate de revelado tradicional, <strong>sin retoque</strong>.</li>' +
          '<li><strong>Papel seguridad:</strong> 6 fotografías tamaño diploma, ovaladas (5 × 7 cm).</li>' +
          '<li><strong>Certificados de estudios:</strong> 4 fotografías recientes <strong>tamaño credencial, ovaladas</strong>, de frente, rostro serio, orejas despejadas.</li>' +
          '<li>Vestimenta formal; sin lentes oscuros ni pupilentes de color; Enfermería con uniforme y cofia.</li></ul>';
      }
    },
    {
      id: 'titulo-reposicion',
      nombre: 'Reposición de título extraviado',
      prioridad: 4,
      keywords: ['perdi mi titulo', 'titulo extraviado', 'reposicion', 'duplicado', 'extravio', 'danado', 'segundo titulo'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>La <strong>reposición de diploma, título o grado extraviado o dañado</strong> se solicita en el <strong>Departamento de Títulos</strong> de la Dirección de Certificación y Control Documental.</p>' +
          '<ul><li>Solicitud por escrito firmada (nombre, nivel, plantel, número de cuenta y contacto).</li>' +
          '<li><strong>Acta ante el Ministerio Público</strong> por el extravío — o el documento dañado tal como esté.</li>' +
          '<li><strong>4 fotografías</strong> según el formato oficial + identificación (original y copia).</li>' +
          '<li>Costo y tiempo: <strong>no publicados</strong> — la DGAE se comunica contigo tras revisar tu expediente. Decírtelo tal cual es parte de la honestidad de este asistente.</li></ul>';
      }
    },
    {
      id: 'titulacion-opciones',
      nombre: 'Opciones de titulación (sin tesis incluidas)',
      prioridad: 8,
      keywords: ['opciones de titulacion', 'sin hacer tesis', 'sin tesis', 'titularme', 'titulacion', 'experiencia laboral', 'formas de titularse', 'tesina'],
      fuente: 'abogadogeneral.unam.mx',
      respuesta: function () {
        return '<p>El <strong>artículo 20 del Reglamento General de Exámenes</strong> reconoce más de <strong>10 opciones de titulación</strong>. Sin tesis puedes titularte por:</p>' +
          '<ul><li><strong>Examen general de conocimientos</strong> (examen escrito).</li>' +
          '<li><strong>Totalidad de créditos y alto nivel académico</strong> — promedio mínimo que fija tu consejo técnico, <strong>nunca menor de 9.5</strong>, sin reprobadas y en tiempo curricular.</li>' +
          '<li><strong>Trabajo profesional</strong> — incorporarte <strong>al menos un semestre</strong> a una actividad profesional y presentar informe avalado (la vía de "titulación por experiencia laboral").</li>' +
          '<li><strong>Estudios de posgrado</strong> — ingresar a especialización, maestría o doctorado UNAM y acreditar su plan.</li>' +
          '<li><strong>Ampliación y profundización de conocimientos</strong> — promedio ≥8.5 + asignaturas extra, o cursos de educación continua UNAM de <strong>240 horas</strong> mínimo.</li>' +
          '<li><strong>Servicio social</strong> (tesina evaluada), <strong>apoyo a la docencia</strong>, <strong>actividad de investigación</strong>, <strong>seminario de tesis</strong>, y <strong>obra artística</strong> en carreras de producción artística.</li></ul>' +
          '<p>Cada facultad adopta y reglamenta su propio subconjunto — verifica en tu consejo técnico. El servicio social es requisito previo (art. 19).</p>';
      }
    },
    {
      id: 'titulacion-estatus',
      nombre: 'Estatus de tu título en trámite',
      prioridad: 7,
      keywords: ['estatus de mi titulo', 'checo el estatus', 'avance de titulacion', 'seguimiento de titulo', 'consulta tramite de titulacion', 'estatus'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>El avance se consulta en <strong>www.escolar.unam.mx → Alumnos → Acceso a Sistemas → "Consulta Trámite de Titulación y Graduación"</strong> (acceso directo: ingreso.dgae.unam.mx:8020/consulta_avance_sl).</p>' +
          '<ul><li>Al final del <strong>renglón 15</strong> aparece la fecha en la que podrás recoger tu título.</li>' +
          '<li>La cita para la recepción se agenda en <strong>egreso.dgae.unam.mx:8005</strong>.</li>' +
          '<li>Entrega: Dirección de Certificación y Control Documental, L–V <strong>9:00–15:00 y 17:00–18:00</strong>, con identificación oficial + fotocopia.</li></ul>';
      }
    },
    {
      id: 'cedula-profesional',
      nombre: 'Cédula profesional',
      prioridad: 7,
      keywords: ['cedula profesional', 'cedula', 'tramito la cedula'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>La cédula la expide la <strong>Dirección General de Profesiones de la SEP</strong>; en la UNAM el paso clave es requisitar la <strong>"Autorización de Transferencia de Información a la DGP-SEP"</strong>, que faculta a la DGAE a enviar tus datos.</p>' +
          '<ul><li>¿Egresaste con título previo y sin cédula? Envía el formato + <strong>INE, CURP y acta de nacimiento escaneados</strong> a <strong>jefatura_titulos@dgae.unam.mx</strong>.</li>' +
          '<li>Atención telefónica: <strong>55 5622-1524 y 55 5622-1525</strong>, de 9:00 a 15:00 y de 17:00 a 19:30.</li></ul>';
      }
    },

    /* ===== Certificados y constancias ===== */

    {
      id: 'certificado-estudios',
      nombre: 'Certificado de estudios',
      prioridad: 8,
      keywords: ['certificado de estudios', 'certificado de bachillerato', 'certificado de prepa', 'donde pido mi certificado', 'sacar certificado', 'certificado'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Depende del nivel (derecho fundado en el <strong>artículo 5 del Estatuto General</strong>):</p>' +
          '<ul><li><strong>Licenciatura / técnico:</strong> en <strong>Servicios Escolares de tu plantel</strong>, con identificación o credencial UNAM + <strong>4 fotografías recientes tamaño credencial (ovaladas)</strong>.</li>' +
          '<li><strong>Bachillerato ENP:</strong> Unidad de Registro Escolar, <strong>Adolfo Prieto 722, Col. Del Valle</strong> · tel. 55 5687 6828 · L–J 9:00–18:00, V 9:00–17:30.</li>' +
          '<li><strong>Bachillerato CCH:</strong> Dirección General del CCH, <strong>Av. Universidad 3000, CU</strong> · tel. 55 5622 2388 · L–V 9:00–15:00 y 16:00–17:00.</li>' +
          '<li><strong>Envío a otros estados o al extranjero:</strong> escrito firmado a <strong>tramitel@dgae.unam.mx</strong>.</li></ul>';
      }
    },
    {
      id: 'certificado-posgrado',
      nombre: 'Certificado de posgrado ($100)',
      prioridad: 6,
      keywords: ['certificado de posgrado', 'certificados de posgrado', 'certificado digital'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Se tramita ante la <strong>Subdirección de Asuntos Escolares de Posgrado</strong> (edificio G, Unidad de Posgrado, CU).</p>' +
          '<ul><li>Costo: <strong>$100.00 por cada certificado</strong>, con ficha personalizada generada en <strong>SIGEREL</strong> (sigerel.dgae.unam.mx).</li>' +
          '<li>Solicitud por correo a <strong>certificados_posgrado@dgae.unam.mx</strong>; tras <strong>5 días hábiles</strong>, llama al <strong>55 5623 7073</strong> (9:00–14:30) para tu cita de entrega.</li>' +
          '<li>2 fotografías óvalo tamaño credencial en papel mate (no de celular ni instantáneas).</li>' +
          '<li>Ya existe la vía <strong>digital</strong>: <strong>10,486 certificados digitales</strong> de posgrado emitidos desde junio de 2025, con código QR de verificación (Gaceta UNAM).</li></ul>';
      }
    },
    {
      id: 'certificado-recuperar',
      nombre: 'Recuperar documentos entregados a la UNAM',
      prioridad: 7,
      keywords: ['recupero mi certificado', 'que entregue', 'devolucion de mi certificado', 'documentos originales', 'recuperar mis documentos', 'certificado original', 'entregue al ingresar'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>La <strong>recuperación de documentos originales</strong> (como el certificado de prepa que entregaste al ingresar) depende de tu generación:</p>' +
          '<ul><li><strong>Generaciones 2021–2023:</strong> Local de Registro de Aspirantes, <strong>Av. del Imán #7, CU</strong> · 9:30–14:30 y 17:00–18:30.</li>' +
          '<li><strong>Generación 2020 y anteriores:</strong> <strong>Archivo General</strong> (frente a Universum) · <strong>9:00–12:30</strong> · tels. <strong>55 5622-6482 y 55 5622-6483</strong>.</li></ul>' +
          '<p>Aplica también para pedir la devolución de tu certificado de licenciatura para un posgrado externo.</p>';
      }
    },
    {
      id: 'certificacion-copias',
      nombre: 'Certificación de copias (2–5 días)',
      prioridad: 6,
      keywords: ['certificacion de copias', 'copia certificada', 'certificar mi titulo', 'certificar documentos', 'autenticidad'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>La <strong>certificación de copias</strong> (títulos, diplomas, grados, actas y certificados) reconoce la autenticidad del documento para requerimientos laborales o de otra universidad.</p>' +
          '<ul><li>Lleva el <strong>original</strong> + fotocopia tamaño carta en blanco y negro (título/grado por ambos lados en una misma hoja) + identificación oficial.</li>' +
          '<li>Tiempo oficial: <strong>de 2 a 5 días hábiles</strong> (5 para trámites al extranjero).</li>' +
          '<li>Costo por documento: se paga vía <strong>SIGEREL</strong>; el monto <strong>no está publicado en abierto</strong> — se muestra al generar tu referencia.</li>' +
          '<li>Dónde: Dirección de Certificación y Control Documental, L–V 9:30–15:00 y 17:00–18:00.</li></ul>';
      }
    },
    {
      id: 'homologacion',
      nombre: 'Constancia de homologación (3 días)',
      prioridad: 6,
      keywords: ['homologacion', 'constancia de homologacion'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>La <strong>constancia de homologación</strong> verifica que tu título o grado fue emitido por la UNAM.</p>' +
          '<ul><li>Se tramita en <strong>TRAMITEL</strong> (Dirección de Certificación y Control Documental): formato de solicitud + identificación oficial (original y fotocopia).</li>' +
          '<li>Debe llevar <strong>destinatario definido</strong> — no puede ir dirigida "A QUIEN CORRESPONDA".</li>' +
          '<li>Tiempo oficial (cita literal): "si contamos con tus datos en el sistema, <strong>en tres días hábiles</strong> podremos entregártela". Generaciones anteriores a 1970: te avisan por correo o teléfono (el expediente está en el archivo general).</li>' +
          '<li>Horario: L–V <strong>9:00–15:00 y 17:00–18:00</strong>.</li></ul>';
      }
    },
    {
      id: 'carta-pasante',
      nombre: 'Carta de pasante',
      prioridad: 4,
      keywords: ['carta de pasante', 'pasante', 'autorizacion provisional'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>El nombre oficial es <strong>"Constancia para trámite de Autorización provisional para ejercer como pasante"</strong>.</p>' +
          '<ul><li>Se solicita en <strong>Servicios Escolares de tu entidad académica</strong>; la firma la Dirección de Certificación y Control Documental.</li>' +
          '<li>El trámite ante la SEP se hace en gob.mx (ficha <strong>SEP1239</strong>).</li>' +
          '<li>Si necesitas segunda firma de la constancia: preséntate en la DCyCD, L–V 9:00–15:00 y 17:00–18:00.</li></ul>';
      }
    },
    {
      id: 'actualizacion-datos',
      nombre: 'Corrección de datos personales',
      prioridad: 4,
      keywords: ['cambio de nombre', 'identidad de genero', 'actualizar mis datos', 'correccion de datos', 'cambiar mi nombre', 'dictamenes'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>La <strong>actualización de datos personales</strong> (nombre, apellidos, fecha de nacimiento o <strong>identidad de género</strong>) se tramita en el <strong>Departamento de Dictámenes y Revisiones de Documentos</strong> (DCyCD), con fundamento en el artículo 2 del Estatuto General.</p>' +
          '<ul><li>Requisitos: <strong>acta de nacimiento actual, CURP actualizada e identificación</strong>.</li>' +
          '<li>Horario: 9:00–13:00 y 15:30–17:30 · tels. <strong>55 5622 5506 y 55 5622 5511</strong> · correo rlopez@dgae.unam.mx.</li></ul>';
      }
    },

    /* ===== Costos ===== */

    {
      id: 'costos',
      nombre: '¿Cuánto cuesta estudiar y tramitar en la UNAM?',
      prioridad: 7,
      keywords: ['es realmente gratis', 'gratis', 'colegiaturas', 'mensualidades', 'cuanto cuesta', 'cuesta tramitar', 'pagar algo ademas', 'cuotas', 'costos'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Respuesta honesta: <strong>la UNAM no publica un tarifario único en línea</strong>. Esto es lo que sí está verificado en fuentes oficiales:</p>' +
          '<ul><li>Examen de admisión a licenciatura: <strong>$490.00 M.N.</strong> (instructivo 2026).</li>' +
          '<li>Certificado de posgrado: <strong>$100.00</strong> por documento (vía SIGEREL).</li>' +
          '<li>Legalización de plan de estudios: <strong>$1.00 por copia de hoja</strong>.</li>' +
          '<li><strong>El costo del título no está publicado</strong> — cita literal del formato oficial: "deberá consultarlo en la oficina de Servicios Escolares… de su escuela". Las becas, en cambio, son de trámite <strong>gratuito</strong>.</li></ul>' +
          '<p>Las cuotas de inscripción se rigen por el Reglamento General de Pagos (abogadogeneral.unam.mx); los montos exactos por plantel no están en una fuente pública central.</p>';
      }
    },

    /* ===== Admisión ===== */

    {
      id: 'examen-costo',
      nombre: 'Costo y pago del examen de admisión',
      prioridad: 8,
      keywords: ['cuanto cuesta el examen de admision', 'cuanto cuesta el examen', 'costo del examen', 'pagar la ficha', 'donde puedo pagar', 'ficha del examen', 'ficha de deposito', 'pago del examen', 'cuesta', '490'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>El derecho a examen del Concurso de Selección 2026 costó <strong>$490.00 (cuatrocientos noventa pesos M.N.)</strong> — cita literal del instructivo oficial.</p>' +
          '<ul><li>Se paga <strong>en línea o con ficha de depósito en Santander</strong> (referencia de 11 caracteres, cliente "UNAM ASPIRANTES").</li>' +
          '<li>En 2026 la ficha se descargaba hasta el <strong>5 de febrero, 15:00</strong> y el pago debía registrarse ese día antes de las 15:59 — <strong>"NO HAY PRÓRROGA"</strong>.</li>' +
          '<li>Desde el extranjero: mismo monto (o equivalente en dólares) + comisiones bancarias.</li>' +
          '<li>Preparación <strong>gratuita y oficial</strong>: plataforma <strong>Pruéb@te UNAM</strong> — con la misma metodología del examen.</li></ul>';
      }
    },
    {
      id: 'admision',
      nombre: 'Admisión a licenciatura: fechas y cifras',
      prioridad: 8,
      keywords: ['examen de admision', 'resultados del examen', 'cuando salen los resultados', 'convocatoria', 'admision', 'concurso de seleccion', 'aspirantes', 'registro', 'registrarme', 'curp', 'ingresar a la unam'],
      fuente: 'dgcs.unam.mx',
      respuesta: function () {
        return '<p>Concurso de Selección 2026 (datos oficiales):</p>' +
          '<ul><li>Registro: <strong>23 de enero – 3 de febrero</strong> en www.dgae.unam.mx · examen <strong>100% en línea</strong> (primera vez): <strong>23 de mayo – 10 de junio</strong>.</li>' +
          '<li>Resultados: <strong>17 de julio de 2026</strong> (consulta habilitada hasta el 20 de julio, 23:59) · entrega documental de seleccionados: <strong>27–31 de julio</strong>.</li>' +
          '<li>Cifras del boletín <strong>UNAM-DGCS-413</strong>: <strong>191,306 aspirantes</strong>, 158,712 presentaron examen, <strong>50,113 lugares</strong> de primer ingreso (21,962 por concurso + 28,151 por pase reglamentado).</li>' +
          '<li>Requisito: bachillerato concluido con <strong>promedio mínimo 7.0</strong>.</li>' +
          '<li>¿Error en tu registro (CURP, sede)? El canal oficial de asesoría es <strong>concursos_de_seleccion_2026@dgae.unam.mx</strong>.</li></ul>';
      }
    },
    {
      id: 'pase-reglamentado',
      nombre: 'Pase reglamentado',
      prioridad: 6,
      keywords: ['pase reglamentado', 'pase'],
      fuente: 'dgcs.unam.mx',
      respuesta: function () {
        return '<p>Dato oficial 2026: <strong>28,151 estudiantes</strong> ingresaron a licenciatura por Pase Reglamentado (boletín UNAM-DGCS-413), de un total de 50,113 de primer ingreso.</p>' +
          '<p>Honestidad ante todo: las reglas finas (vigencia, efecto de los años cursados en prepa, cambio de carrera) las fija el <strong>Reglamento General de Inscripciones</strong> y no están verificadas en mi base actual — en la versión real consultaría ese reglamento en abogadogeneral.unam.mx y la normativa de tu plantel.</p>';
      }
    },
    {
      id: 'fraude-gestores',
      nombre: 'Gestores y "cursos que garantizan ingreso" = fraude',
      prioridad: 9,
      keywords: ['gestor', 'gestores', 'fraude', 'garantia de ingreso', 'curso de preparacion', 'curso para el examen', 'venden curso', 'vender curso', 'curso garantiza', 'cursos que garantizan', 'estafa', 'legitimo', 'venden el examen', 'ayuda para ingresar', 'garantizan'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Posición oficial, cita literal de la Convocatoria 2026: <strong>"La UNAM no tiene acuerdos ni convenios con instituciones u organizaciones que ofrecen cursos de preparación para el examen de selección… la \'ayuda\' o \'garantía de ingreso\' ofrecida en estos lugares o en redes sociales, es totalmente falsa."</strong></p>' +
          '<ul><li><strong>La única forma de ingresar es el concurso de selección.</strong> Quien venda preguntas o "lugares" será denunciado; en 2026 se canceló el proceso del <strong>2%</strong> de aspirantes por conductas contrarias a la convocatoria.</li>' +
          '<li>La DGAE <strong>se deslinda</strong> de cualquier cobro o promesa hecha fuera de sus canales oficiales.</li>' +
          '<li>Preparación gratuita y oficial: <strong>Pruéb@te UNAM</strong>.</li>' +
          '<li>Si te ofrecen ingreso a cambio de dinero: <strong>no pagues y denúncialo</strong>.</li></ul>';
      }
    },
    {
      id: 'posgrado-admision',
      nombre: 'Admisión a posgrado',
      prioridad: 6,
      keywords: ['maestria', 'doctorado', 'posgrado', 'especializacion', 'admision al posgrado'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Convocatoria de ingreso al semestre <strong>2027-1</strong> (Gaceta UNAM, suplemento especial):</p>' +
          '<ul><li>Registro y carga de documentos: <strong>3 – 16 de febrero de 2026</strong> en posgrado.dgae.unam.mx/ingreso.</li>' +
          '<li><strong>Cada comité académico tiene su propio calendario</strong> — consulta el instructivo de tu programa en posgrado.unam.mx/oferta-academica.</li>' +
          '<li>Resultados: <strong>16 de junio de 2026, 12:00</strong> · entrega documental: <strong>27 de julio – 7 de agosto</strong> · el semestre inicia el <strong>lunes 10 de agosto de 2026</strong>.</li>' +
          '<li>Aviso literal: "Ni los Programas de Posgrado ni la DGAE brindarán retroalimentación alguna sobre el proceso de selección".</li>' +
          '<li>Hoy (19-jul-2026) el portal indica: <strong>"No hay convocatorias abiertas"</strong>.</li></ul>';
      }
    },

    /* ===== Becas ===== */

    {
      id: 'becas',
      nombre: 'Becas UNAM: catálogo y registro',
      prioridad: 8,
      keywords: ['becas', 'beca', 'que becas', 'portal del becario', 'integra', 'solicitar beca', 'dos becas', 'compatible'],
      fuente: 'becarios.unam.mx',
      respuesta: function () {
        return '<p>El catálogo oficial del ciclo 2025-2026 lista <strong>21 programas de beca</strong> en <strong>becarios.unam.mx</strong> (DGOAE). Toda solicitud se hace <strong>personalmente</strong> en el <strong>Sistema INTEGRA (www.integra.unam.mx)</strong> y el trámite es <strong>gratuito</strong>.</p>' +
          '<ul><li>Montos verificados: Manutención <strong>$3,600</strong> · FAEL/Alta Exigencia <strong>$5,700</strong> (promedio ≥8.5) · Mujeres Universitarias <strong>$5,700</strong> · Grupos Vulnerables <strong>hasta $10,000</strong> · Deportistas <strong>hasta $6,000/semestre</strong> · Apoyo Nutricional (desayuno o comida en especie).</li>' +
          '<li>La compatibilidad entre becas la regula el <strong>Reglamento General para la Operación y Asignación de Becas</strong> (2024).</li>' +
          '<li>Ojo: el "Portal de Becas" becas.unam.mx estaba <strong>caído (error 500)</strong> el 19-jul-2026 — usa becarios.unam.mx.</li>' +
          '<li>Dudas: <strong>dgoae.depbecas@unam.mx</strong> · tel. <strong>55 5622 0429</strong>.</li></ul>';
      }
    },
    {
      id: 'beca-manutencion',
      nombre: 'Beca de manutención (pagos y fechas)',
      prioridad: 7,
      keywords: ['beca de manutencion', 'manutencion', 'ya pagaron', 'cuando depositan', 'tardan en depositar', 'deposito de la beca'],
      fuente: 'becarios.unam.mx',
      respuesta: function () {
        return '<p>Beca <strong>Manuela Garín Pinillos — Manutención UNAM 2026-2</strong> (convocatoria oficial):</p>' +
          '<ul><li>Monto: <strong>$3,600</strong> por el periodo febrero–mayo 2026, pagado <strong>en una sola exhibición</strong>.</li>' +
          '<li>Registro: <strong>18 de marzo – 6 de abril de 2026</strong> en el Sistema INTEGRA · promedio mínimo <strong>7.00</strong> (excepto primer ingreso) · trámite gratuito y personal.</li>' +
          '<li>Sobre "¿ya depositaron?": la convocatoria <strong>no publica calendario de dispersión</strong> — eso es parte del dolor que esta demo resuelve. Canal oficial: <strong>dgoae.beca.manutencion@unam.mx</strong>.</li></ul>';
      }
    },

    /* ===== Sistemas ===== */

    {
      id: 'siae-acceso',
      nombre: 'SIAE: acceso, NIP y contraseñas',
      prioridad: 9,
      keywords: ['siae', 'nip', 'contrasena', 'no puedo entrar', 'recupero mi contrasena', 'tira de materias', 'trayectoria', 'historial academico', 'historial'],
      fuente: 'dgae-siae.unam.mx',
      respuesta: function () {
        return '<p>El <strong>SIAE</strong> (dgae-siae.unam.mx) concentra tu trayectoria académica, constancias, actas, titulación y seguro de salud.</p>' +
          '<ul><li>Acceso alumnos: <strong>número de cuenta + NIP</strong>. NIP por defecto: <strong>tu fecha de nacimiento en formato DDMMAAAA</strong>.</li>' +
          '<li>Generación anterior al 2000: <strong>agrega un cero al inicio</strong> de tu cuenta (ej. 9025888-5 → 090258885).</li>' +
          '<li>Hay CAPTCHA aritmético; ahí también ves tu <strong>trayectoria académica</strong> ("tira de materias" / historial).</li>' +
          '<li>Honesto: el portal <strong>no publica un flujo de autoservicio</strong> para recuperar una contraseña personalizada, y su página de contacto solo tiene <strong>formulario web</strong> (sin teléfono). Por teléfono, el canal es TRAMITEL: <strong>55 5622-5999</strong>.</li>' +
          '<li>El portal alterno siae.dgae.unam.mx estaba <strong>"temporalmente suspendido"</strong> el 19-jul-2026.</li></ul>';
      }
    },
    {
      id: 'sigerel-pagos',
      nombre: 'SIGEREL: referencias de pago',
      prioridad: 6,
      keywords: ['sigerel', 'referencia de pago', 'pago no reflejado', 'ficha de pago', 'generar referencia'],
      fuente: 'sigerel.dgae.unam.mx',
      respuesta: function () {
        return '<p><strong>SIGEREL</strong> (sigerel.dgae.unam.mx) genera las referencias de pago de trámites como revisión de estudios, emisión de título y certificaciones.</p>' +
          '<ul><li>Acceso: <strong>número de cuenta + la misma contraseña/NIP del SIAE</strong>.</li>' +
          '<li>Es un login <strong>independiente</strong> del SIAE y del sistema de citas — para titularte usas <strong>3 sistemas con 3 logins</strong> (dato documentado del flujo actual).</li>' +
          '<li>¿Pago no reflejado? No hay flujo público de aclaración en línea — el canal es <strong>TRAMITEL: 55 5622-5999</strong>.</li></ul>';
      }
    },
    {
      id: 'citas-dgae',
      nombre: 'Citas DGAE (revisión de estudios y títulos)',
      prioridad: 7,
      keywords: ['cita', 'citas', 'agendar', 'sin cita', 'no me deja agendar', 'sistema de citas'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>El <strong>Sistema de Citas de la DGAE</strong> vive en <strong>egreso.dgae.unam.mx:8005</strong> (sí, puerto :8005) y cubre <strong>Revisiones de Estudio</strong> y la <strong>recepción de títulos y grados</strong>.</p>' +
          '<ul><li>Acceso con tu contraseña de <strong>SIAE o SAEP</strong> (posgrado); escuelas incorporadas: fecha de nacimiento DDMMAAAA.</li>' +
          '<li>Citas para credencial de posgrado: atencionpi.dgae.unam.mx:8443.</li>' +
          '<li>¿Atención sin cita? TRAMITEL atiende presencial L–V <strong>9:00–15:00 y 17:00–18:00</strong>; todo trámite en la DCyCD exige <strong>identificación oficial + fotocopia</strong> en el módulo de vigilancia.</li>' +
          '<li>Si el sistema falla, el canal alterno documentado es el teléfono: <strong>55 5622-5999</strong>.</li></ul>';
      }
    },

    /* ===== Atención y contacto ===== */

    {
      id: 'tramitel-atencion',
      nombre: '¿A quién llamo? Teléfonos que sí responden',
      prioridad: 10,
      keywords: ['nadie contesta', 'no contestan', 'telefono', 'a que numero', 'llamar', 'tramitel', 'atencion', 'contacto', 'ventanilla', 'en linea o tengo que ir'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p><strong>TRAMITEL</strong> es el programa oficial de la DGAE para informarte por teléfono sobre trámites, requisitos y fechas:</p>' +
          '<ul><li>Tels.: <strong>55 5622-5999</strong> · <strong>55 5622-8222 ext. 81358</strong> · <strong>55 5622-5513</strong> (atención telefónica 9:00–17:30).</li>' +
          '<li>Presencial: Dirección de Certificación y Control Documental, <strong>Circuito de la Investigación Científica s/n</strong> (junto al CENDI, cerca del metro Universidad), L–V <strong>9:00–15:00 y 17:00–18:00</strong>.</li>' +
          '<li>Correo: <strong>tramitel@dgae.unam.mx</strong>.</li>' +
          '<li>Servicios escolares de tu facultad: cada plantel publica su propio contacto — no hay directorio único central.</li>' +
          '<li>Si nadie responde y tu trámite se afecta, la <strong>Defensoría de los Derechos Universitarios</strong> tiene <strong>40 líneas</strong>: <strong>55 4161 6048</strong>.</li></ul>';
      }
    },
    {
      id: 'whatsapp-chat',
      nombre: '¿Hay WhatsApp o chat oficial?',
      prioridad: 7,
      keywords: ['whatsapp', 'chat oficial', 'chat', 'mensaje directo'],
      fuente: 'dgae.unam.mx',
      respuesta: function () {
        return '<p>Respuesta verificada: <strong>no existe un WhatsApp oficial de la DGAE</strong>. Sus avisos oficiales señalan WhatsApp y redes sociales como canales usados por <strong>fraudes</strong> de suplantación.</p>' +
          '<ul><li>El único chat institucional documentado es la <strong>"Asistencia Virtual" de la DGOAE</strong> — atendido por <strong>personas, en horario de oficina</strong>.</li>' +
          '<li>La página de contacto del SIAE solo ofrece un <strong>formulario web</strong>.</li>' +
          '<li>Canal social oficial de la DGAE: Facebook <strong>@DGAE.UNAM.Oficial</strong>.</li></ul>' +
          '<p>Precisamente ese vacío es lo que "UNAM Inteligente" propone llenar: un asistente 24/7 con fuentes citadas.</p>';
      }
    },
    {
      id: 'defensoria',
      nombre: 'Defensoría de los Derechos Universitarios',
      prioridad: 7,
      keywords: ['defensoria', 'derechos universitarios', 'queja', 'violencia de genero', 'acoso', 'denuncia'],
      fuente: 'defensoria.unam.mx',
      respuesta: function () {
        return '<p>La <strong>Defensoría de los Derechos Universitarios, Igualdad y Atención de la Violencia de Género</strong> atiende: 1) actos que afecten tus derechos universitarios y 2) violencia de género.</p>' +
          '<ul><li>Teléfono: <strong>55 4161 6048</strong> — con <strong>40 líneas disponibles</strong>.</li>' +
          '<li>Correo: <strong>defensoria@unam.mx</strong> · chat en línea y formularios en defensoria.unam.mx.</li>' +
          '<li>Ubicación: 2.º piso del Edificio D, Zona Cultural de CU (frente a Universum) · L–V <strong>9:00–15:00 y 17:00–20:30</strong>.</li>' +
          '<li>Para violencia de género existe una <strong>Ruta de atención</strong> con acompañamiento psicológico.</li></ul>';
      }
    },
    {
      id: 'apoyo-psicologico',
      nombre: 'Atención psicológica UNAM',
      prioridad: 8,
      keywords: ['ayuda psicologica', 'psicologica', 'psicologo', 'salud mental', 'ansiedad', 'crisis', 'terapia', 'suicida', 'depresion'],
      fuente: 'saludmental.unam.mx',
      respuesta: function () {
        return '<p>Sí hay atención — y más cercana de lo que parece:</p>' +
          '<ul><li><strong>Atención Psicológica UNAM (a distancia): 55 5025 0855</strong>, L–V 9:00–18:00. <strong>Opción 3 = atención inmediata a riesgo suicida</strong>.</li>' +
          '<li>Emergencias 24 h: <strong>Línea de la Vida 800 911 2000</strong>.</li>' +
          '<li>Presencial: Centro de Servicios Psicológicos <strong>"Dr. Guillermo Dávila"</strong> (sótano del edificio D, Fac. de Psicología) · tel. 55 5622-2335 · L–V 8:30–19:00 — más centros comunitarios en Coyoacán y Tlalpan.</li>' +
          '<li><strong>Atienden a toda la comunidad universitaria y al público general</strong> — sí puedes ir aunque seas de otra facultad.</li>' +
          '<li>Costos: los centros operan con cuotas de recuperación <strong>no publicadas en línea</strong> — pregunta al agendar.</li></ul>';
      }
    },
    {
      id: 'seguro-salud',
      nombre: 'Servicio médico: seguro IMSS estudiante',
      prioridad: 6,
      keywords: ['servicio medico', 'seguro', 'imss', 'medico', 'seguro de salud', 'facultativo', 'nss', 'atencion medica'],
      fuente: 'dgsm.unam.mx',
      respuesta: function () {
        return '<p>Todos los estudiantes de media superior, superior y posgrado <strong>tienen derecho a atención médica en el IMSS</strong> (seguro de enfermedades y maternidad).</p>' +
          '<ul><li>El derecho <strong>inicia al ser aceptado en la UNAM</strong>, se renueva al reinscribirte y <strong>no es extensivo a familiares</strong>.</li>' +
          '<li>Activación en línea vía <strong>IMSS Digital</strong> (necesitas CURP, comprobante de domicilio, número de cuenta, NSS y correo) o presencial en tu clínica — <strong>"menciona que eres estudiante de la UNAM"</strong>.</li>' +
          '<li>Obtén tu NSS en serviciosdigitales.imss.gob.mx.</li>' +
          '<li>Baja o reingreso al seguro: <strong>sse@dgae.unam.mx</strong>.</li></ul>';
      }
    },

    /* ===== Vida académica ===== */

    {
      id: 'servicio-social',
      nombre: 'Servicio social',
      prioridad: 5,
      keywords: ['servicio social', 'siass'],
      fuente: 'dgoae.unam.mx',
      respuesta: function () {
        return '<p>Puedes iniciar tu servicio social al cubrir el <strong>70% de créditos</strong> de la carrera (o el porcentaje que autorice tu plan de estudios).</p>' +
          '<ul><li>Los programas autorizados se consultan en el <strong>SIASS</strong> (Sistema de Información Automatizado de Servicio Social), por entidad y carrera.</li>' +
          '<li>Es <strong>requisito para titularte</strong> (art. 19 del Reglamento General de Exámenes).</li>' +
          '<li>Programas especiales: Multidisciplinarios de alto impacto y el tutorial <strong>"Peraj — Adopta un Amig@"</strong>.</li>' +
          '<li>Aviso oficial: si alguien te ofrece "AYUDA" para agilizar el trámite, es un gestor — <strong>no pagues</strong>.</li></ul>';
      }
    },
    {
      id: 'cambio-carrera',
      nombre: 'Cambio de carrera, plantel o turno',
      prioridad: 6,
      keywords: ['cambio de carrera', 'cambiar de carrera', 'segunda carrera', 'cambio de plantel', 'cambio de turno', 'carrera simultanea', 'cambio de sistema'],
      fuente: 'dgae-siae.unam.mx',
      respuesta: function () {
        return '<p>El SIAE ofrece <strong>trámites en línea</strong> para el ciclo 2027: <strong>Cambio Interno de Carrera, Segunda Carrera, Carrera Simultánea, Cambio de Plantel, Cambio de Sistema, Cambio de Modalidad y Cambio de Turno</strong>.</p>' +
          '<ul><li>Cada trámite abre en <strong>ventanas de fechas específicas por plantel</strong> (en 2026 fueron entre abril y junio) — se consultan en dgae-siae.unam.mx → Trámites.</li>' +
          '<li>Si vienes del pase reglamentado y quieres otra carrera, la vía documentada es este mismo bloque de trámites del SIAE.</li></ul>';
      }
    },
    {
      id: 'revalidacion-equivalencia',
      nombre: 'Revalidación y equivalencia de estudios',
      prioridad: 5,
      keywords: ['revalidacion', 'equivalencia', 'estudios en el extranjero', 'otra universidad', 'revalidar'],
      fuente: 'dgire.unam.mx',
      respuesta: function () {
        return '<p>Dos trámites distintos de la <strong>DGIRE</strong>: <strong>revalidación</strong> = estudios hechos en el <strong>extranjero</strong>; <strong>equivalencia</strong> = estudios de <strong>otras instituciones nacionales</strong>.</p>' +
          '<ul><li>Tiempo oficial: <strong>15 días hábiles</strong> desde que entregas documentación completa y pagas.</li>' +
          '<li>Costos publicados <strong>en UMAs</strong>: 4 UMAs revisión documental · 3 UMAs por año (o 1½ por semestre) · 1½ UMA por asignatura. Pago en BBVA o en ventanilla DGIRE (solo tarjeta).</li>' +
          '<li>Extranjeros: documentos <strong>apostillados o legalizados</strong> + traducción por perito.</li>' +
          '<li>Dónde: costado sur de la Sala Nezahualcóyotl, CU · L–V 9:00–14:00 · Depto. de Equivalencia: <strong>55 5622 6046</strong>.</li></ul>';
      }
    },
    {
      id: 'movilidad',
      nombre: 'Movilidad e intercambios',
      prioridad: 4,
      keywords: ['movilidad', 'intercambio', 'estudiar en el extranjero', 'dgeci'],
      fuente: 'unaminternacional.unam.mx',
      respuesta: function () {
        return '<p>Las convocatorias de movilidad (DGECI) se concentran en <strong>unaminternacional.unam.mx/convocatorias</strong>: nacional e internacional, para alumnos UNAM y visitantes.</p>' +
          '<ul><li>Recientes: <strong>Movilidad Internacional Semestral 2026-2</strong> y <strong>2027-1 (Otoño 2026)</strong>.</li>' +
          '<li>El certificado parcial de movilidad se gestiona vía DGECI (extranjeros), ECOES (nacionales) o tu plantel.</li>' +
          '<li>Ya hay <strong>certificados digitales de movilidad</strong>: 279 emitidos desde febrero de 2026 (Gaceta UNAM).</li></ul>';
      }
    },
    {
      id: 'ciclo-escolar',
      nombre: 'Inicio del ciclo escolar',
      prioridad: 5,
      keywords: ['ciclo escolar', 'cuando inicia', 'inicio de clases', 'calendario escolar', 'cuando empiezan las clases', 'semestre'],
      fuente: 'gaceta.unam.mx',
      respuesta: function () {
        return '<p>Honesto: <strong>no hay una fecha única publicada centralmente</strong> — cada plantel publica su calendario. Lo verificado en fuentes oficiales:</p>' +
          '<ul><li>El semestre <strong>2026-2</strong> arrancó en febrero con "alrededor de <strong>400 mil estudiantes y académicos</strong>" (Gaceta UNAM, 3-feb-2026).</li>' +
          '<li>Posgrado: el semestre <strong>2027-1 inicia el lunes 10 de agosto de 2026</strong> (convocatoria oficial).</li>' +
          '<li>Primer ingreso a licenciatura 2026: entrega documental del <strong>27 al 31 de julio</strong>; el arranque exacto de clases lo fija el calendario de tu plantel.</li></ul>';
      }
    },
    {
      id: 'biblioteca-digital',
      nombre: 'Biblioteca Digital (BiDi)',
      prioridad: 3,
      keywords: ['biblioteca', 'bidi', 'libros', 'biblioteca digital'],
      fuente: 'bidi.unam.mx',
      respuesta: function () {
        return '<p>La <strong>Biblioteca Digital UNAM</strong> (bidi.unam.mx) está <strong>operativa</strong> (verificado 19-jul-2026). La UNAM cuenta además con <strong>140 bibliotecas y 7.6 millones de volúmenes</strong>.</p>' +
          '<p>Honesto: si conservas acceso a BiDi <strong>después de egresar</strong> no está verificado en mi base — en la versión real consultaría bidi.unam.mx y la Dirección General de Bibliotecas.</p>';
      }
    },
    {
      id: 'normatividad',
      nombre: 'Reglamentos y legislación universitaria',
      prioridad: 4,
      keywords: ['reglamento', 'normatividad', 'legislacion', 'estatuto', 'seriacion', 'reglamento de inscripciones', 'reglamento de examenes'],
      fuente: 'abogadogeneral.unam.mx',
      respuesta: function () {
        return '<p>La Legislación Universitaria completa (<strong>104 documentos vigentes</strong>) vive en <strong>abogadogeneral.unam.mx:8443/legislacion</strong>. Los clave para estudiantes:</p>' +
          '<ul><li><strong>Reglamento General de Inscripciones</strong> (2015) — reinscripción, seriación, límites de tiempo.</li>' +
          '<li><strong>Reglamento General de Exámenes</strong> (act. 2025) — evaluaciones y opciones de titulación.</li>' +
          '<li><strong>Reglamento General de Pagos</strong> (2015) · <strong>Reglamento de Becas</strong> (2024) · <strong>Reglamento del Servicio Social</strong> (act. 2025) · <strong>Estatuto General</strong> (act. 2026).</li></ul>' +
          '<p>Para dudas como seriación de materias, la letra exacta está en el Reglamento General de Inscripciones y la reglamentación de tu plantel.</p>';
      }
    },

    /* ===== Docentes ===== */

    {
      id: 'docente-calificaciones',
      nombre: 'Docentes: actas y calificaciones en el SIAE',
      prioridad: 7,
      keywords: ['subir calificaciones', 'capturar calificaciones', 'captura de calificaciones', 'acta de rectificacion', 'rectificacion de calificaciones', 'actas', 'calificaciones', 'docente', 'profesor', 'rfc', 'mis grupos'],
      fuente: 'dgae-siae.unam.mx',
      respuesta: function () {
        return '<p>Para el profesorado, el <strong>SIAE</strong> ofrece los módulos <strong>"Actas y comprobantes de evaluación"</strong> y <strong>"Rectificación de calificaciones"</strong>, además de plantilla de profesores y relación de alumnos por grupo.</p>' +
          '<ul><li>Acceso académicos: <strong>RFC con homoclave + NIP</strong> "proporcionado en correspondencia oficial".</li>' +
          '<li>Corrección de una calificación: vía el módulo de <strong>Rectificación</strong>; tu grupo debe estar en la <strong>declaración de grupos-asignatura</strong> del plantel — si no aparece, el registro se corrige con Servicios Escolares.</li>' +
          '<li>Honesto: las <strong>fechas límite de captura no se publican centralmente</strong> — las fija el calendario de cada plantel. El contacto del SIAE es solo formulario web; por teléfono, TRAMITEL: <strong>55 5622-5999</strong>.</li></ul>';
      }
    }
  ];

  /* ---------- pre-normalización de keywords ---------- */

  INTENTS.forEach(function (it) {
    it._kw = it.keywords.map(function (k) { return normaliza(k); });
  });

  /* ---------- motor de matching ---------- */

  function puntuar(intent, q, tokens) {
    var score = 0;
    intent._kw.forEach(function (kw) {
      if (kw.indexOf(' ') !== -1) {
        if (q.indexOf(kw) !== -1) score += 4;
      } else if (tokens.indexOf(kw) !== -1) {
        score += 2;
      }
    });
    return score;
  }

  /**
   * resolver(query) → { tipo: 'ok'|'ambiguo'|'fallback', matches: [{intent, score}] }
   * ok       → matches[0] es la respuesta directa
   * ambiguo  → matches = top-3 con señal, para desambiguar
   * fallback → matches = 3 sugerencias (las de mayor prioridad o señal débil)
   */
  function resolver(query) {
    var q = normaliza(query);
    var tokens = q.split(' ');
    var scored = INTENTS.map(function (it) {
      return { intent: it, score: puntuar(it, q, tokens) };
    }).sort(function (a, b) {
      return (b.score - a.score) || (b.intent.prioridad - a.intent.prioridad);
    });

    var best = scored[0];
    var second = scored[1];

    if (best.score >= 4 && (!second || best.score - second.score >= 3)) {
      return { tipo: 'ok', matches: [best] };
    }
    if (best.score >= 2) {
      return { tipo: 'ambiguo', matches: scored.slice(0, 3).filter(function (m) { return m.score > 0; }) };
    }
    return { tipo: 'fallback', matches: scored.slice(0, 3) };
  }

  /* ---------- render de cards (HTML compartido omnibox/chat) ---------- */

  function cardIntent(intent) {
    return '<article class="asist-card" role="status" aria-live="polite">' +
      '<h3 class="asist-card-titulo">' + escapeHtml(intent.nombre) + '</h3>' +
      '<div class="asist-card-cuerpo num">' + intent.respuesta() + '</div>' +
      badge(intent.fuente) +
      '</article>';
  }

  function cardAmbigua(matches) {
    var botones = matches.map(function (m) {
      return '<button type="button" class="asist-chip" data-intent="' + escapeHtml(m.intent.id) + '">' +
        escapeHtml(m.intent.nombre) + '</button>';
    }).join('');
    return '<article class="asist-card" role="status" aria-live="polite">' +
      '<h3 class="asist-card-titulo">Tu pregunta toca varios temas — elige uno:</h3>' +
      '<div class="asist-sugerencias">' + botones + '</div>' +
      '</article>';
  }

  function cardFallback(matches) {
    var botones = matches.map(function (m) {
      return '<button type="button" class="asist-chip" data-intent="' + escapeHtml(m.intent.id) + '">' +
        escapeHtml(m.intent.nombre) + '</button>';
    }).join('');
    return '<article class="asist-card" role="status" aria-live="polite">' +
      '<h3 class="asist-card-titulo">Eso aún no lo tengo verificado</h3>' +
      '<p class="asist-card-cuerpo">Solo respondo con datos confirmados en fuentes oficiales de la UNAM. ' +
      'En la versión real consultaría <strong>unam.mx</strong> y el portal de la dependencia correspondiente antes de contestarte. ' +
      'Los temas más cercanos que sí tengo verificados:</p>' +
      '<div class="asist-sugerencias">' + botones + '</div>' +
      '</article>';
  }

  /**
   * responder(query) → { tipo, matches, html }
   * Motor puro: no toca el DOM. El html es la card lista para inyectar.
   */
  function responder(query) {
    var r = resolver(query);
    var html;
    if (r.tipo === 'ok') html = cardIntent(r.matches[0].intent);
    else if (r.tipo === 'ambiguo') html = cardAmbigua(r.matches);
    else html = cardFallback(r.matches);
    return { tipo: r.tipo, matches: r.matches, html: html };
  }

  function intentPorId(id) {
    for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i].id === id) return INTENTS[i];
    return null;
  }

  /* ---------- API pública ---------- */

  var G = (typeof window !== 'undefined') ? window : globalThis;
  G.AsistenteUNAM = { responder: responder, resolver: resolver, intents: INTENTS, normaliza: normaliza };

  /* ---------- capa DOM (solo si hay documento) ---------- */

  if (typeof document === 'undefined') return;

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* entornos sin matchMedia */ }

  function listo(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  listo(function () {

    /* ----- omnibox (hooks de index.html) ----- */

    var form = document.getElementById('omnibox');
    var resultados = document.getElementById('omnibox-results');
    var input = document.getElementById('omnibox-input') ||
      (form ? form.querySelector('input[type="text"], input[type="search"], input[name="q"]') : null);

    function pintarResultado(query) {
      if (!resultados) return;
      var res = responder(query);
      resultados.innerHTML = res.html;
      if (!reduceMotion) {
        var card = resultados.firstElementChild;
        if (card) {
          card.classList.add('asist-entrando');
          requestAnimationFrame(function () { card.classList.remove('asist-entrando'); });
        }
      }
    }

    if (form && resultados) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = input ? input.value.trim() : '';
        if (!q) { if (input) input.focus(); return; }
        pintarResultado(q);
      });

      // chips de sugerencia del hero (creados por index.html)
      document.addEventListener('click', function (e) {
        var chip = e.target.closest ? e.target.closest('.sugerencia[data-q]') : null;
        if (chip) {
          if (input) input.value = chip.getAttribute('data-q');
          pintarResultado(chip.getAttribute('data-q'));
        }
      });

      // clicks en chips de desambiguación/fallback dentro de #omnibox-results
      resultados.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.asist-chip[data-intent]') : null;
        if (!btn) return;
        var it = intentPorId(btn.getAttribute('data-intent'));
        if (it) resultados.innerHTML = cardIntent(it);
      });
    }

    /* ----- chat dock flotante ----- */

    var dock = document.createElement('div');
    dock.className = 'asist-dock';
    dock.innerHTML =
      '<button type="button" class="asist-toggle" aria-expanded="false" aria-controls="asist-panel" aria-label="Abrir asistente UNAM Inteligente">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.9 3 3 6.5 3 10.8c0 2.4 1.2 4.5 3.2 5.9-.1.8-.5 2-1.6 3.2-.2.2 0 .6.3.6 2 0 3.6-.9 4.6-1.7.8.2 1.6.3 2.5.3 5.1 0 9-3.5 9-7.8S17.1 3 12 3Z"/></svg>' +
        '<span class="asist-toggle-txt">Pregunta a la UNAM</span>' +
      '</button>' +
      '<section id="asist-panel" class="asist-panel" role="dialog" aria-modal="false" aria-label="Chat del asistente UNAM Inteligente" hidden>' +
        '<header class="asist-head">' +
          '<div class="asist-head-info">' +
            '<strong>UNAM Inteligente</strong>' +
            '<span>Respuestas con fuente oficial citada</span>' +
          '</div>' +
          '<button type="button" class="asist-cerrar" aria-label="Cerrar chat">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>' +
          '</button>' +
        '</header>' +
        '<div class="asist-msgs" role="log" aria-live="polite" aria-label="Conversación"></div>' +
        '<form class="asist-form">' +
          '<label class="asist-visually-hidden" for="asist-chat-input">Escribe tu pregunta al asistente</label>' +
          '<input id="asist-chat-input" type="text" autocomplete="off" placeholder="Escribe tu pregunta…">' +
          '<button type="submit" aria-label="Enviar pregunta">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-8.5 18-2.3-7.2L3 11.5Z"/></svg>' +
          '</button>' +
        '</form>' +
      '</section>';
    document.body.appendChild(dock);

    var toggle = dock.querySelector('.asist-toggle');
    var panel = dock.querySelector('.asist-panel');
    var cerrar = dock.querySelector('.asist-cerrar');
    var msgs = dock.querySelector('.asist-msgs');
    var chatForm = dock.querySelector('.asist-form');
    var chatInput = dock.querySelector('#asist-chat-input');
    var saludado = false;

    function scrollAbajo() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    function burbujaUsuario(texto) {
      var div = document.createElement('div');
      div.className = 'asist-msg asist-msg--user num';
      div.textContent = texto;
      msgs.appendChild(div);
      scrollAbajo();
    }

    function burbujaBot(html) {
      var div = document.createElement('div');
      div.className = 'asist-msg asist-msg--bot';
      div.innerHTML = html;
      msgs.appendChild(div);
      scrollAbajo();
    }

    function saludar() {
      if (saludado) return;
      saludado = true;
      burbujaBot(
        '<p>¡Hola! Soy el asistente de la demo <strong>UNAM Inteligente</strong>. Respondo con datos verificados y te cito la fuente oficial en cada respuesta.</p>' +
        '<p>Prueba, por ejemplo:</p>' +
        '<div class="asist-sugerencias">' +
          '<button type="button" class="asist-chip" data-q="¿Cuánto tiempo tarda el trámite de título?">¿Cuánto tarda mi título?</button>' +
          '<button type="button" class="asist-chip" data-q="¿Qué becas puedo solicitar?">Becas disponibles</button>' +
          '<button type="button" class="asist-chip" data-q="¿Por qué nadie contesta en la DGAE?">Nadie me contesta</button>' +
        '</div>'
      );
    }

    function abrirChat() {
      panel.hidden = false;
      dock.classList.add('asist-abierto');
      toggle.setAttribute('aria-expanded', 'true');
      saludar();
      chatInput.focus();
    }

    function cerrarChat() {
      panel.hidden = true;
      dock.classList.remove('asist-abierto');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }

    toggle.addEventListener('click', function () {
      if (panel.hidden) abrirChat(); else cerrarChat();
    });
    cerrar.addEventListener('click', cerrarChat);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) cerrarChat();
    });

    function preguntarChat(q) {
      burbujaUsuario(q);
      var res = responder(q);
      burbujaBot(res.html);
    }

    chatForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = chatInput.value.trim();
      if (!q) { chatInput.focus(); return; }
      chatInput.value = '';
      preguntarChat(q);
      chatInput.focus();
    });

    // chips dentro del chat: data-q (pregunta sugerida) o data-intent (desambiguación)
    msgs.addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('.asist-chip') : null;
      if (!chip) return;
      var q = chip.getAttribute('data-q');
      var id = chip.getAttribute('data-intent');
      if (q) {
        preguntarChat(q);
      } else if (id) {
        var it = intentPorId(id);
        if (it) burbujaBot(cardIntent(it));
      }
      chatInput.focus();
    });
  });

})();
