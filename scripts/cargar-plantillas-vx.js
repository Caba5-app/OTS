// Carga en la app las plantillas simplificadas de las planillas de C:\Users\vitur\Documents\VX.
// Uso: node scripts/cargar-plantillas-vx.js
// Si ya existe una plantilla con el mismo nombre, la saltea (se puede correr más de una vez).
require('dotenv').config();
const db = require('../db');
const slugify = require('../slugify');

// ---------- Listas para los desplegables ----------
const SI_NO = ['SI', 'NO'];
const DEPENDENCIAS = ['DCC5', 'DIC5', 'CV5A', 'CV5B'];
const JERARQUIAS = [
  'SUPERINTENDENTE', 'COMISIONADO GENERAL', 'COMISIONADO MAYOR', 'COMISARIO INSPECTOR', 'COMISARIO',
  'SUBCOMISARIO', 'PRINCIPAL', 'INSPECTOR PRINCIPAL', 'INSPECTOR', 'OFICIAL MAYOR', 'OFICIAL PRIMERO',
  'OFICIAL', 'OFICIAL AYUDANTE', 'OFICIAL 1° GAOS', 'OFICIAL 2° GAOS', 'OFICIAL 3° GAOS',
  'AUXILIAR NIVEL A', 'AUXILIAR NIVEL B', 'AUXILIAR NIVEL C', 'AUXILIAR NIVEL D', 'AUXILIAR NIVEL E',
  'AUXILIAR NIVEL F', 'AUXILIAR NIVEL G', 'AUXILIAR NIVEL H', 'AUXILIAR NIVEL I', 'AUXILIAR NIVEL J',
  'CIVIL CONTRATADO',
];
const TIPOS_DOC = ['DNI', 'DNI EXTRANJERO', 'PASAPORTE', 'CI', 'LIBRETA ENROLAMIENTO', 'NO APORTA'];
const SEXOS = ['MASCULINO', 'FEMENINO', 'NO BINARIO', 'OTROS'];
const NACIONALIDADES = [
  'ARGENTINA', 'BOLIVIANA', 'BRASILERA', 'CHILENA', 'COLOMBIANA', 'PARAGUAYA', 'PERUANA', 'URUGUAYA',
  'VENEZOLANA', 'DOMINICANA', 'ECUATORIANA', 'CUBANA', 'HAITIANA', 'SENEGALESA', 'CHINA', 'ARMENIA',
  'BANGLADESI', 'BELGA', 'BIELORUSA', 'CANADIENSE', 'CENTROAFRICANA', 'CONGOLESA', 'COREANA',
  'COSTARICENSE', 'CROATA', 'CHIPRIOTA', 'DANESA', 'EGIPCIA', 'ESCOCESA', 'ESLOVACA', 'ESPAÑOLA',
  'ESTADOUNIDENSE', 'FINLANDESA', 'FRANCESA', 'GRIEGA', 'GUINEANA', 'HOLANDESA', 'HONDUREÑA', 'HÚNGARA',
  'INGLESA', 'IRAKÍ', 'IRANÍ', 'IRLANDESA', 'ISRAELÍ', 'ITALIANA', 'JAMAIQUINA', 'JAPONESA', 'MARFILEÑA',
  'MARROQUÍ', 'MEXICANA', 'NORUEGA', 'PANAMEÑA', 'POLACA', 'PORTUGUESA', 'RUMANA', 'RUSA', 'SAUDITA',
  'SERBIA', 'SUECA', 'SUIZA', 'TAIWANESA', 'UCRANIANA', 'OTRAS', 'NO APORTÓ',
];
const DELITOS_GAP = [
  'ABANDONO DE PERSONA', 'ABUSO DE ARMAS', 'ABUSO SEXUAL ACCESO CARNAL', 'ABUSO SEXUAL SIMPLE', 'AMENAZAS',
  'AMENAZAS EN CONTEXTO DE GENERO', 'ASOCIACIÓN ILÍCITA', 'ATENTADO Y RESISTENCIA A LA AUTORIDAD',
  'AVERIGUACIÓN ILÍCITO', 'AVERIGUACIÓN MUERTE DUDOSA', 'CORRUPCIÓN DE MENORES', 'DAÑOS', 'DESOBEDIENCIA',
  'ENCUBRIMIENTO', 'ESTABLECER CAPTURA', 'ESTAFAS Y OTRAS DEFRAUDACIONES', 'EXHIBICIONES OBSCENAS',
  'EXTORSIÓN', 'FALSIFICACIÓN DE DOCUMENTO', 'HOMICIDIO', 'HOMICIDIO CULPOSO', 'HURTO',
  'INCENDIO Y OTROS ESTRAGOS', 'INF. CODIGO ADUANERO', 'INF. LEY 23737',
  'INF. LEY 25891 COMUNICACIONES MÓVILES', 'INF. LEY DE ARMAS', 'INF. LEY DE MARCAS', 'LESIONES',
  'LESIONES 94', 'LESIONES EN CONTEXTO DE GENERO', 'OTROS DELITOS', 'PORNOGRAFIA INFANTIL',
  'PRIVACIÓN ILEGÍTIMA DE LA LIBERTAD', 'REBELDÍA', 'ROBO', 'ROBO AMA', 'ROBO AUSENCIA DE MORADORES',
  'ROBO POR ESCALAMIENTO', 'TTVA. HOMICIDIO', 'TTVA. HURTO', 'TTVA. ROBO', 'USURPACION',
  'VIOLACION DE DOMICILIO',
];
const ZONAS_DOMICILIO = ['CABA', 'PBA', 'SITUACION DE CALLE', 'INTERIOR DEL PAIS', 'DOMICILIO EN EL EXTERIOR', 'NO APORTA'];
const NOVEDADES = ['NO HUBO NOVEDAD', 'CON NOVEDAD'];

// ---------- Helpers para definir columnas ----------
// opts: { req: true, help: '...' }
const col = (type) => (name, opts = {}) => ({ name, type, required: Boolean(opts.req), help_text: opts.help || null });
const texto = col('text');
const numero = col('number');
const fecha = col('date');
const lista = (name, options, opts = {}) => ({ ...col('select')(name, opts), options });
const siNo = (name, opts) => lista(name, SI_NO, opts);

const persona = () => [
  texto('APELLIDO', { req: true }),
  texto('NOMBRES', { req: true }),
  numero('EDAD'),
  lista('TIPO DOCUMENTO', TIPOS_DOC),
  texto('NRO DOCUMENTO'),
  lista('NACIONALIDAD', NACIONALIDADES),
  lista('SEXO', SEXOS),
  texto('PROVINCIA - PARTIDO'),
];
const lugarDelHecho = () => [
  texto('CALLE'),
  texto('ALTURA'),
  texto('INTERSECCIÓN', { help: 'Completar solo si no hay altura' }),
];
const juzgado = () => [
  texto('FUERO'),
  texto('JUZGADO N°'),
  texto('JUEZ/A - FISCAL'),
  texto('SECRETARÍA N°'),
  texto('SECRETARIO/A'),
];
const personalPolicial = () => [
  lista('JERARQUÍA', JERARQUIAS),
  texto('L.P.'),
];

// ---------- Plantillas ----------
const ot86Columnas = () => [
  // Datos filiatorios
  texto('APELLIDOS', { req: true }),
  texto('NOMBRES', { req: true }),
  texto('ALIAS'),
  lista('NACIONALIDAD', NACIONALIDADES),
  lista('TIPO DOCUMENTO', TIPOS_DOC),
  texto('NRO DOCUMENTO'),
  lista('GÉNERO', SEXOS),
  texto('ORIENTACIÓN SEXUAL'),
  fecha('FECHA NACIMIENTO'),
  texto('DOMICILIO (LOCALIDAD)'),
  texto('DOMICILIO (PROVINCIA)'),
  // Datos de la detención
  texto('SUMARIO'),
  lista('DEPENDENCIA PREVENTORA', DEPENDENCIAS),
  fecha('FECHA DE DETENCIÓN'),
  texto('TIPIFICACIÓN'),
  texto('DELITO COMPLETO'),
  texto('CLASIFICACIÓN JUSTICIA'),
  texto('NRO. DE CAUSA'),
  texto('JUDICATURA ACTUANTE'),
  texto('JUDICATURA N°'),
  texto('SECRETARÍA N°'),
  texto('SITUACIÓN LEGAL'),
  numero('SENTENCIA (MESES)'),
  fecha('VENCIMIENTO'),
  texto('OFICIO DE REMISIÓN'),
  // Anotaciones conjuntas
  texto('NRO. CAUSA ANOTACIÓN CONJUNTA'),
  texto('DELITO ANOTACIÓN CONJUNTA'),
  texto('JUDICATURA ANOTACIÓN CONJUNTA'),
  // Datos de alojamiento
  texto('ALOJADO EN'),
  fecha('FECHA ALOJAMIENTO'),
  texto('CLASIFICACIÓN'),
  texto('ALOJAMIENTO TRANSITORIO', { help: 'Solo comisarías' }),
  texto('DISPOSICIÓN'),
  texto('UNIDAD DE REMISIÓN'),
  fecha('FECHA DISPOSICIÓN'),
  siNo('REITERANCIA'),
  // Carpeta médica
  siNo('HOSPITALIZADO'),
  texto('NOSOCOMIO'),
  fecha('FECHA INGRESO NOSOCOMIO'),
  fecha('FECHA ALTA'),
  texto('AFECCIONES MÉDICAS / EMBARAZADA'),
];

const ot108Base = () => [
  fecha('FECHA', { req: true }),
  lista('NOVEDADES DEL DÍA', NOVEDADES, { req: true, help: 'Si no hubo novedad, dejá el resto de la fila vacío' }),
  texto('NRO. DE SUMARIO'),
];

const ot108Contravenciones = () => [
  ...ot108Base(),
  texto('TIPO DE SERVICIO'),
  texto('NOMBRE DEL EVENTO MASIVO'),
  lista('DEPENDENCIA INTERVENTORA', DEPENDENCIAS),
  ...persona().map((c) => ({ ...c, required: false })),
  texto('OBSERVACIONES CONTRAVENTOR'),
  ...lugarDelHecho(),
  texto('NRO. ART.'),
  texto('DESCRIPCIÓN DE LA FALTA'),
  numero('DINERO SECUESTRADO'),
  siNo('REINCIDENTE'),
  siNo('¿EL FISCAL CONVALIDÓ LA REMISIÓN?'),
  siNo('¿REMITIDO?'),
  lista('REMITIDO POR / PARA', ['POR LA CONTRAVENCIÓN / DELITO', 'PARA IDENTIFICACIÓN']),
  ...juzgado(),
];

const ot63Columnas = () => [
  fecha('FECHA', { req: true }),
  texto('DIRECCIÓN'),
  texto('SUMARIO'),
  texto('CARÁTULA'),
  texto('RELEVANCIA'),
  texto('SUSTRAÍDO'),
  texto('RESEÑA'),
  siNo('DETENIDO'),
  numero('CANTIDAD DE DETENIDOS'),
];

const minutaColumnas = () => [
  fecha('FECHA A CUMPLIMENTAR', { req: true }),
  lista('DEPENDENCIA PREVENTORA', DEPENDENCIAS),
  texto('CAUSA'),
  texto('LUGAR - ZONA - ÁMBITO'),
  texto('HORA INICIO', { help: 'Ej: 06:00' }),
  texto('RECURSOS AFECTADOS'),
  texto('OFICIAL A CARGO'),
  texto('MAGISTRADO INTERVENTOR'),
  texto('EXPECTATIVA'),
];

const PLANTILLAS = [
  {
    name: 'OT 06 - Novedades oficiales superiores',
    source: 'DCC5- OT 06 -NOVEDADES OFICIALES SUPERIORES.xlsx',
    sections: [
      {
        name: 'Oficiales superiores',
        fields: [
          lista('DEPENDENCIA', DEPENDENCIAS, { req: true }),
          lista('PRELACIÓN', ['JEFE DPCIA', '2DO JEFE', '3ER JEFE', '4TO JEFE', 'AUTORIZADO']),
          texto('LEGAJO'),
          lista('GRADO', JERARQUIAS),
          texto('APELLIDO', { req: true }),
          texto('NOMBRES', { req: true }),
          texto('DNI'),
          texto('TELÉFONO ASIGNADO'),
          siNo('AUSENTE'),
          siNo('OPERATIVO'),
          texto('MOTIVO SI NO ESTÁ OPERATIVO'),
          lista('LICENCIA', ['NINGUNA', 'ANUAL', 'MÉDICA']),
          texto('NRO DE CONTROL', { help: 'Licencia anual' }),
          texto('MEMO', { help: 'Licencia médica' }),
          texto('MOTIVO DE LA LICENCIA', { help: 'Licencia médica' }),
          fecha('LICENCIA DESDE'),
          fecha('LICENCIA HASTA'),
        ],
      },
    ],
  },
  {
    name: 'OT 13 - Detenidos internados en Hospital Borda',
    source: 'DCC5 - OT 13 -DETENIDOS EN HTAL BORDA ).ods',
    sections: [
      {
        name: 'Internados',
        fields: [
          texto('APELLIDO Y NOMBRE DEL INTERNADO', { req: true }),
          texto('DNI'),
          texto('CREA'),
          texto('CARÁTULA SUMARIO'),
          texto('SECTOR DE INTERNACIÓN', { help: 'Completo' }),
        ],
      },
    ],
  },
  {
    name: 'OT 18 - Licencias y jefes',
    source: 'DCC5 - OT 18.xlsx',
    sections: [
      {
        name: 'Licencias',
        fields: [
          lista('DEPENDENCIA', DEPENDENCIAS, { req: true }),
          ...personalPolicial(),
          texto('APELLIDOS', { req: true }),
          texto('NOMBRES', { req: true }),
          lista('TIPO DE LICENCIA', ['ANUAL ORDINARIA', 'MÉDICA'], { req: true }),
          texto('ESPECIFICAR', { help: 'Solo licencia médica' }),
          fecha('DESDE', { req: true }),
          fecha('HASTA'),
        ],
      },
      {
        name: 'Jefes',
        fields: [
          lista('CARGO', ['JEFE DE ÁREA', 'JEFE DE COMUNA', 'JEFE DE COMISARÍA'], { req: true }),
          texto('DEPENDENCIA', { req: true, help: 'Ej: AREA V, COMUNA 5, DOCV5A' }),
          ...personalPolicial(),
          texto('APELLIDO', { req: true }),
          texto('NOMBRES', { req: true }),
          texto('POC'),
          texto('CELULAR PARTICULAR'),
        ],
      },
    ],
  },
  {
    name: 'OT 63 - Delitos varios',
    source: 'DCC5-OT 63  DELITOS  VARIOS AREA.ods',
    sections: [
      { name: 'Robo arrebato vía pública', fields: ot63Columnas() },
      { name: 'Robo-hurto autopartes', fields: ot63Columnas() },
      { name: 'Robo-hurto automotor', fields: ot63Columnas() },
      { name: 'Motochorro', fields: ot63Columnas() },
      { name: 'Robo a comercio', fields: ot63Columnas() },
    ],
  },
  {
    name: 'OT 71 - Minutas',
    source: 'DCC5 -  OT 71 MINUTAS .ods',
    sections: [
      { name: 'Allanamientos', fields: minutaColumnas() },
      { name: 'Diligencias (SISC)', fields: minutaColumnas() },
      {
        name: 'Órdenes de servicio',
        fields: [
          fecha('FECHA', { req: true }),
          texto('NRO ORDEN DE SERVICIO'),
          texto('NOMBRE DEL SERVICIO'),
          texto('HORA IMPLANTACIÓN', { help: 'Ej: 24HS, 22 a 06' }),
          texto('LUGAR DE IMPLANTACIÓN'),
          lista('DEPENDENCIA', DEPENDENCIAS),
          texto('RECURSOS AFECTADOS', { help: 'Ej: 2 INFANTES' }),
          lista('SERVICIO', ['ORDINARIO', 'COMPLEMENTARIO']),
          texto('RESEÑA'),
        ],
      },
    ],
  },
  {
    name: 'OT 86 - Ingresos y egresos de detenidos',
    source: 'DCC5 - OT 86 INGRESO Y EGRESOS DE DETENIDOS.ods',
    sections: [
      { name: 'Alojados', fields: ot86Columnas() },
      { name: 'Reubicaciones', fields: ot86Columnas() },
      { name: 'Egresos', fields: ot86Columnas() },
    ],
  },
  {
    name: 'OT 108 - No ingresados en alcaidías y contravenciones',
    source: 'DCC5 - OT 108.xlsx',
    sections: [
      {
        name: 'No ingresados en alcaidías',
        fields: [
          ...ot108Base(),
          lista('DEPENDENCIA INTERVENTORA', DEPENDENCIAS),
          ...persona().map((c) => ({ ...c, required: false })),
          texto('OBSERVACIONES DETENIDO'),
          ...lugarDelHecho(),
          texto('ART. CÓDIGO PENAL / LEY INFRINGIDA'),
          texto('CÓDIGO'),
          texto('OBSERVACIONES CAUSA'),
          ...juzgado(),
          siNo('¿SOLTURA DESDE COMISARÍA?'),
          siNo('¿SOLTURA DEL LUGAR DEL HECHO?'),
          siNo('¿SOLTURA DESDE NOSOCOMIO?'),
          siNo('¿SOLTURA DESDE LA O.C.I.?'),
          siNo('¿REMITIDO A SEDE JUDICIAL?'),
        ],
      },
      { name: 'Contravenciones trapitos', fields: ot108Contravenciones() },
      { name: 'Contravenciones manteros', fields: ot108Contravenciones() },
    ],
  },
  {
    name: 'OT 114 - Detenciones registradas',
    source: 'OT 114 DETENCIONES REGISTRADAS. AREA V CENTRO.xls',
    sections: [
      {
        name: 'Detenciones',
        fields: [
          texto('N° SUMARIO', { req: true }),
          lista('DEPENDENCIA INTERVENTORA', DEPENDENCIAS, { req: true }),
          fecha('FECHA DEL HECHO', { req: true }),
          texto('DIRECCIÓN', { help: 'Con numeración exacta' }),
          lista('TIPIFICACIÓN (SEGÚN GAP)', DELITOS_GAP, { req: true }),
          texto('APELLIDOS', { req: true }),
          texto('NOMBRES', { req: true }),
          lista('NACIONALIDAD', NACIONALIDADES),
          lista('TIPO DOCUMENTO', TIPOS_DOC),
          texto('NRO DOCUMENTO'),
          lista('SEXO', SEXOS),
          numero('EDAD'),
          lista('ZONA DOMICILIO', ZONAS_DOMICILIO),
        ],
      },
    ],
  },
  {
    name: 'CM - Productividad comunal motorizado',
    source: 'CM/DCC5-PLANILLA PRODUCTIVIDAD CM.xlsx',
    sections: [
      {
        name: 'Personal y móviles',
        fields: [
          fecha('FECHA', { req: true }),
          ...personalPolicial(),
          texto('APELLIDO', { req: true }),
          texto('NOMBRE', { req: true }),
          texto('TELÉFONO POC'),
          texto('HORARIO DE SERVICIO'),
          texto('CUADRANTE AFECTADO'),
          texto('MÓVIL INTERNO'),
          texto('DOMINIO'),
          numero('KMS RECORRIDOS'),
        ],
      },
      {
        name: 'Productividad',
        fields: [
          fecha('FECHA', { req: true }),
          numero('AUTOS/CAMIONETAS CONTROLADOS'),
          numero('MOTOS CONTROLADAS'),
          numero('AUTOS/CAMIONETAS REMITIDOS'),
          numero('MOTOS REMITIDAS'),
          numero('PERSONAS CONTROLADAS'),
          numero('INFRACCIONES LABRADAS'),
          numero('CONTRAVENCIONES LABRADAS'),
          numero('REMITIDOS POR CONTRAVENCIÓN'),
          numero('DETENIDOS'),
          texto('OBSERVACIONES', { help: 'Causa de remisión / detención' }),
        ],
      },
    ],
  },
  {
    name: 'Estado de flota diaria',
    source: 'FLOTAS/DCC5 -ESTADO DE FLOTA DIARIA.xlsx',
    sections: [
      {
        name: 'Flota',
        fields: [
          fecha('FECHA', { req: true }),
          lista('DEPENDENCIA', DEPENDENCIAS, { req: true }),
          lista('TIPO', ['MÓVIL', 'MOTO', 'CUATRICICLO'], { req: true }),
          lista('ESTADO', ['OPERATIVO', 'RADIADO'], { req: true }),
          texto('DOMINIO', { req: true }),
          texto('INTERNO'),
          texto('MODELO'),
          texto('OBSERVACIONES'),
        ],
      },
    ],
  },
  {
    name: 'Informe quemacoches y contenedores',
    source: 'LUNES/INFORME QUEMACOCHES Y CONTENEDORES.ods',
    sections: [
      {
        name: 'Hechos',
        fields: [
          fecha('FECHA', { req: true }),
          texto('LUGAR', { req: true }),
          siNo('CONTENEDOR', { help: 'SI si fue un contenedor, NO si fue un vehículo' }),
          texto('DATOS DEL VEHÍCULO'),
          siNo('DETENIDOS'),
          texto('SUMARIO'),
        ],
      },
    ],
  },
  {
    name: 'Operador CREA',
    source: 'DCC5- OPERADOR CREA.ods',
    sections: [
      {
        name: 'Operadores',
        fields: [
          ...personalPolicial(),
          texto('NOMBRE Y APELLIDO', { req: true }),
          texto('TELÉFONO POC'),
          texto('TELÉFONO PARTICULAR'),
          texto('HORARIO', { help: 'Ej: 07:00 a 19:00' }),
        ],
      },
    ],
  },
  {
    name: 'Orden de servicio - personal afectado',
    source: 'Órdenes de servicio 6917/2026 y 7108/2026 (jornada de protestas / cascos)',
    sections: [
      {
        name: 'Personal afectado',
        fields: [
          texto('N° ORDEN DE SERVICIO', { req: true, help: 'Ej: 7108/2026' }),
          texto('FUNCIÓN', { help: 'Brigada 1, 2, 3, moto 1, 2, infante, etc.' }),
          ...personalPolicial(),
          texto('APELLIDO Y NOMBRES', { req: true }),
          texto('POC'),
          texto('TEL. PARTICULAR'),
          texto('QTH', { help: 'Solo si la orden de servicio lo pide' }),
          lista('SERVICIO', ['ORDINARIO', 'COMPLEMENTARIO']),
          fecha('FECHA'),
          texto('HORARIO', { help: 'Ej: 06:00 a 14:00' }),
        ],
      },
    ],
  },
  {
    name: 'Detenidos en dependencias',
    source: 'detenidos en hospitales,dependencia,etc/DCC5 - DETENIDOS EN DEPENDENCIAS.ods',
    sections: [
      {
        name: 'Detenidos en dependencias',
        fields: [
          fecha('FECHA', { req: true }),
          numero('CAPACIDAD MÁXIMA', { req: true }),
          numero('DETENIDOS ALOJADOS', { req: true }),
        ],
      },
    ],
  },
  {
    name: 'Detenidos en hospitales',
    source: 'detenidos en hospitales,dependencia,etc/DCC5 - DETENIDOS EN HOSPITALES.ods',
    sections: [
      {
        name: 'Detenidos en hospitales',
        fields: [
          fecha('FECHA', { req: true }),
          numero('CANTIDAD DE DETENIDOS', { req: true }),
          texto('HECHO'),
          texto('HOSPITAL'),
        ],
      },
    ],
  },
  {
    name: 'Art. 103 y Art. 90-91',
    source: 'detenidos en hospitales,dependencia,etc/DCC5- ART. 103 Y ART. 90-91.ods',
    sections: [
      {
        name: 'Casos',
        fields: [
          fecha('FECHA', { req: true }),
          lista('ARTÍCULO', ['ART. 103', 'ART. 90', 'ART. 91'], { req: true }),
          texto('SUMARIO'),
        ],
      },
    ],
  },
];

// ---------- Inserción ----------
async function uniqueSlug(tx, base) {
  let slug = slugify(base);
  let suffix = 2;
  while (await tx.get('SELECT id FROM templates WHERE slug = $1', [slug])) {
    slug = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

async function main() {
  await db.ensureSchema();
  await db.transaction(async (tx) => {
    for (const p of PLANTILLAS) {
      if (await tx.get('SELECT id FROM templates WHERE name = $1', [p.name])) {
        console.log(`- Ya existe, se saltea: ${p.name}`);
        continue;
      }
      const template = await tx.get(
        'INSERT INTO templates (name, slug, description) VALUES ($1, $2, $3) RETURNING id',
        [p.name, await uniqueSlug(tx, p.name), `Basada en ${p.source}`]
      );
      for (const [sIndex, s] of p.sections.entries()) {
        const section = await tx.get(
          'INSERT INTO sections (template_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id',
          [template.id, s.name, sIndex]
        );
        for (const [fIndex, f] of s.fields.entries()) {
          await tx.run(
            'INSERT INTO fields (template_id, section_id, name, type, required, help_text, options, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [
              template.id,
              section.id,
              f.name,
              f.type,
              f.required,
              f.help_text,
              f.type === 'select' ? JSON.stringify(f.options) : null,
              fIndex,
            ]
          );
        }
      }
      const columnas = p.sections.reduce((n, s) => n + s.fields.length, 0);
      console.log(`+ ${p.name} (${p.sections.length} hoja/s, ${columnas} columnas)`);
    }
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
