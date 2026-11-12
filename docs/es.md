# US Fuel Prices (EIA)

Los precios medios semanales de la gasolina y el diésel en Estados Unidos en
Gladys, de la U.S. Energy Information Administration (EIA): el promedio
nacional, las regiones PADD, y los estados y ciudades que publica la EIA.

Son **promedios de la encuesta del lunes, no precios de gasolineras**: la EIA
consulta una muestra de gasolineras cada lunes por la mañana y publica los
promedios esa misma tarde (hora del Este). No se usan GasBuddy ni AAA: no
ofrecen una API abierta.

Sin relación con la EIA. Desarrollada desde Europa, con los datos públicos de
la EIA: sus comentarios son bienvenidos.

## Lo que obtiene

- Un dispositivo por **zona** seguida, con para cada carburante (gasolina
  Regular, Midgrade, Premium y diésel): el precio en $/gal, su variación en
  una semana y en un año (52 semanas, como la EIA) y la fecha de la encuesta.
- Un disparador de escena **Nuevos precios semanales de carburantes (EIA)**,
  con un resumen listo para un mensaje.
- Un widget del panel con los precios de cualquier zona y sus variaciones.

## Requisitos

- Gladys 5.3.0 o posterior.
- Acceso a Internet desde Gladys (`api.eia.gov`).
- Una **clave de API de la EIA** gratuita: regístrese en
  https://www.eia.gov/opendata/register.php (un nombre y un correo), la clave
  llega enseguida por correo. Sin clave, la integración usa `DEMO_KEY`, la
  clave de demostración compartida de la EIA: está limitada a pocas
  solicitudes por hora y por día, a menudo ya agotadas.

## Instalación

En Gladys, abra **Integraciones → Instalar desde GitHub** e introduzca la
dirección del repositorio: `https://github.com/guim31/gladys-us-fuel-prices`.

## Configuración

| Campo                  | Función                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clave de API de la EIA | Su clave gratuita. Vacía: `DEMO_KEY`. Guardada por Gladys, nunca escrita en los registros.                                                                                                 |
| Zonas a seguir         | Un dispositivo por zona: el promedio de EE. UU. (por defecto), las 5 regiones PADD y 4 subregiones, 9 estados, 10 ciudades. El diésel solo existe para el país, las regiones y California. |
| Carburantes            | Los carburantes mostrados en cada dispositivo y en el widget. Vacío: los cuatro.                                                                                                           |
| Idioma de los nombres  | Idioma de los nombres de dispositivos y funciones (fijados al añadir un dispositivo), de la fecha de la encuesta y del resumen del disparador. Francés por defecto.                        |

Abra después la pestaña **Descubrimiento** de la integración y añada los
dispositivos.

## Dispositivos

### Precios de carburantes – zona

| Función                         | Tipo                        | Ejemplo (EE. UU., 09/11/2026) |
| ------------------------------- | --------------------------- | ----------------------------- |
| Regular ($/gal)                 | Moneda, dólares             | 3,995                         |
| Regular, variación en 1 semana  | Moneda, dólares (con signo) | −0,158                        |
| Regular, variación en 1 año     | Moneda, dólares (con signo) | 0,939                         |
| … lo mismo para cada carburante |                             |                               |
| Fecha de la encuesta            | Texto                       | 9 nov 2026                    |

Gladys no tiene unidad $/gal: la función de precio muestra un signo de
dólar, y su nombre indica «por galón». Una variación de −0,158 es una bajada
de 15,8 centavos.

## Escenas

### Precio por debajo de un umbral

No hace falta un disparador especial: en una escena, elija **Valor de un
dispositivo** sobre la función de precio, por ejemplo «Regular ($/gal) menor
que 3,50».

### Una bajada de N centavos

Lo mismo con la variación semanal: «Regular, variación en 1 semana menor que
−0,10» inicia la escena cuando el precio bajó más de 10 centavos en la
semana.

### Nuevos precios semanales de carburantes (EIA)

Se dispara una vez por semana y por zona seguida, cuando la EIA publica una
nueva encuesta (nunca por la encuesta ya conocida al iniciar la
integración). Filtro: las zonas. Variables: `zone` (identificador de la EIA,
por ejemplo `NUS`), `zone_name`, `survey_date` (`AAAA-MM-DD`) y `summary`,
por ejemplo «Regular 3,995 US$ (−15,8 ¢), Diésel 6,127 US$ (−16,5 ¢)», listo
para un mensaje.

## Panel

### Widget Carburantes en EE. UU.

Ajustes: la zona (cualquiera, seguida o no; el promedio de EE. UU. por
defecto) y si se muestran las variaciones. Un mosaico por carburante, verde
cuando el precio bajó en la semana, naranja cuando subió; después las
variaciones en una semana y en un año en centavos, y la fecha de la encuesta.

## Acciones

**Probar la conexión con la EIA** (pestaña Configuración) lee enseguida la
última encuesta, con la clave de la configuración, y responde con un precio.

## Datos y límites

- Datos semanales: la integración lee la EIA cada 6 horas, y cada hora desde
  el lunes a las 21:00 UTC hasta que sale la nueva encuesta (el martes tras
  un festivo federal). Unas decenas de solicitudes por semana, muy por debajo
  de los límites de una clave gratuita.
- Una encuesta de más de 15 días no se muestra: mejor ningún valor que uno
  antiguo.
- El diésel solo se publica para el país, las regiones y California.
- Algunas semanas la EIA retiene un valor: la función conserva entonces su
  último valor, igual que una variación que no se puede calcular sin él.
- Los precios incluyen todos los impuestos.

## Solución de problemas

- **«La EIA rechaza la clave de API»**: revise la clave (cópiela de nuevo
  del correo) y luego ejecute **Probar la conexión con la EIA**.
- **«Se alcanzó el límite de la clave de demostración de la EIA»**:
  introduzca su propia clave gratuita.
- **Ningún valor**: añada primero los dispositivos en la pestaña
  Descubrimiento; los valores llegan en un minuto.
- Más detalles en los registros de la integración (`LOG_LEVEL=debug`).

## Créditos

Datos: U.S. Energy Information Administration, Open Data API v2
(`petroleum/pri/gnd`), dominio público (obra del gobierno de EE. UU.).
Integración bajo licencia Apache 2.0.
