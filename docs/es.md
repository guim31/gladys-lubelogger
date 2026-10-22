# LubeLogger

Siga sus vehículos en Gladys con [LubeLogger](https://lubelogger.com), el
cuaderno de mantenimiento de vehículos autoalojado: kilometraje, consumo
medio, gastos del mes y sobre todo los **recordatorios de mantenimiento**
(cambio de aceite, neumáticos, ITV, seguro) como desencadenantes de escena.
Gladys habla directamente con su servidor LubeLogger, en casa o en un servidor
remoto.

Probada con un servidor LubeLogger 1.7.4 real (la imagen Docker oficial),
recordatorios por fecha y por kilometraje incluidos. Sus comentarios son
bienvenidos en el foro de Gladys.

## Requisitos

- Gladys Assistant 5.1 o posterior.
- LubeLogger **1.5.9 o posterior**, accesible desde el equipo de Gladys (puerto
  8080 por defecto, o detrás de un proxy inverso).
- Si la autenticación está activada en LubeLogger: una **clave de API**
  (LubeLogger → Ajustes → API Keys, permisos **View** y **Edit**; View solo
  basta si no añade lecturas del cuentakilómetros), o el nombre de usuario y la
  contraseña de un usuario de LubeLogger. La integración ve los vehículos de
  ese usuario.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. En **Dirección de LubeLogger**, introduzca la dirección IP del servidor, por
   ejemplo `192.168.1.50`: la integración usa entonces el puerto 8080. Añada un
   puerto si el suyo es distinto (`192.168.1.50:8081`). Detrás de un proxy
   inverso, introduzca la dirección completa (`https://example.org/lubelogger`).
3. Si la autenticación está activada en LubeLogger, pegue una **clave de API**,
   o rellene **Nombre de usuario** y **Contraseña**. La clave prevalece si
   ambos están rellenos. Si no, deje estos campos vacíos.
4. **Unidad de distancia usada en LubeLogger**: LubeLogger guarda números sin
   unidad. Elija **Kilómetros** (litros, L/100 km, kWh/100 km) o **Millas**
   (galones EE. UU., mpg, mi/kWh), como en sus registros.
5. **Leer LubeLogger cada**: 5, 15 (por defecto), 30 o 60 minutos.
6. **Idioma de nombres y mensajes** fija los nombres de las funciones
   (congelados al añadir el dispositivo), los textos y las fechas de las
   variables de escena. Francés por defecto.
7. Guarde y use **Probar la conexión**: muestra la versión de LubeLogger, el
   número de vehículos y de recordatorios.
8. En la pestaña **Descubrimiento**, añada los vehículos que desea seguir.

## Dispositivos

Un dispositivo por vehículo de LubeLogger, con el nombre de su marca, su modelo
y su matrícula (`Renault Clio (AA-000-AA)`). Los vehículos vendidos se omiten.

| Función                | Valor                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- |
| Kilometraje            | última lectura conocida por LubeLogger, en km o en millas                        |
| Consumo medio          | L/100 km (o mpg); kWh/100 km (o mi/kWh) para un vehículo eléctrico               |
| Coste del mes          | combustible, mantenimientos, reparaciones, mejoras e impuestos del mes en curso  |
| Próximo recordatorio   | el recordatorio más urgente y su vencimiento (`Aceite · 45.000 km`), o «Ninguno» |
| Recordatorios vencidos | recordatorios cuya fecha o kilometraje se ha superado                            |
| Recordatorios urgentes | recordatorios urgentes o muy urgentes                                            |

El consumo es la media de LubeLogger: la distancia recorrida sobre el
combustible usado, en los repostajes que sabe calcular (no el primero, no
después de un repostaje olvidado). Gladys no tiene unidad «L/100 km» ni «mpg»:
el valor se publica en litros (o sin unidad), la unidad completa figura en el
nombre de la función. El coste está en la moneda de LubeLogger (euro, dólar o
libra esterlina; otra moneda aparece en el nombre). Un vehículo contado en
horas (barco, tractor) muestra sus **Horas de motor**, sin consumo.

La urgencia de los recordatorios es la de LubeLogger (por defecto: urgente a 30
días o 100 km, muy urgente a 7 días o 50 km, ajustable en sus ajustes): Gladys
y LubeLogger siempre coinciden.

## Widget del panel

**Próximos mantenimientos**: dos mosaicos (recordatorios vencidos,
recordatorios urgentes) y la lista de los recordatorios, los más urgentes
primero, con su vencimiento y una insignia de color. Ajuste **Vehículo**: vacío
para todos los vehículos, o uno. Solo lectura.

## Desencadenantes de escena

- **Recordatorio de mantenimiento urgente**: un recordatorio se vuelve urgente
  y luego muy urgente. Una vez por nivel y por vencimiento. Variables:
  vehículo, recordatorio, vencimiento, urgencia («Urgente» o «Muy urgente»).
- **Recordatorio de mantenimiento vencido**: un recordatorio supera su fecha o
  su kilometraje. Una vez por vencimiento. Variables: vehículo, recordatorio,
  vencimiento.

Ambos se pueden filtrar por **Vehículo** (vacío: todos). La primera lectura
tras la instalación es silenciosa: lo que ya es urgente o está vencido se
muestra en el dispositivo, no se anuncia. Un recordatorio recurrente marcado
como hecho en LubeLogger recibe un nuevo vencimiento: se anunciará de nuevo
llegado el momento. Los desencadenantes se activan en la primera lectura tras
el cambio.

## Acciones de escena

- **Añadir una lectura del cuentakilómetros a LubeLogger**: elija el vehículo e
  introduzca la lectura, un número o una variable de escena (por ejemplo el
  kilometraje que envía la integración del fabricante de su coche). La acción
  lee LubeLogger, añade la lectura con la fecha de hoy y vuelve a leer los
  recordatorios (los de kilometraje avanzan con ella). Una lectura igual a la
  última no añade nada; una inferior, o una más de 10.000 por encima (unidad
  errónea, fallo de un sensor), se rechaza. Resultados: **Lectura
  añadida** y **Kilometraje**.
- **Leer un vehículo en LubeLogger**: devuelve el vehículo, el kilometraje, el
  consumo medio, el coste del mes, el próximo recordatorio y su urgencia, el
  número de recordatorios vencidos y urgentes, para un mensaje o una
  condición.

## Ejemplos de escenas

- **Cambio de aceite próximo**: desencadenante «Recordatorio de mantenimiento
  urgente» → mensaje «{{triggerEvent.data.vehicle_name}}:
  {{triggerEvent.data.reminder}} pendiente ({{triggerEvent.data.due}})».
- **ITV vencida**: desencadenante «Recordatorio de mantenimiento vencido» →
  mensaje urgente a toda la familia.
- **Lectura automática**: cada noche a las 21 h → «Añadir una lectura del
  cuentakilómetros» con la variable de kilometraje del coche, luego «Leer un
  vehículo» → continuar solo si hay recordatorios vencidos → mensaje con el
  próximo recordatorio.

## Solución de problemas

- **«Acceso denegado»**: compruebe la clave de API (puede haberse eliminado), o
  el nombre de usuario y la contraseña.
- **«LubeLogger rechazó la escritura»** al añadir una lectura: la clave de API
  solo tiene el permiso View; cree una con View y Edit.
- **«LubeLogger no responde»**: compruebe la dirección y el puerto desde el
  equipo de Gladys. El contenedor está en una red puente: `localhost` es el
  propio contenedor, introduzca en su lugar la dirección IP del servidor.
- **«Esta dirección no responde como LubeLogger 1.5.9 o posterior»**: una
  página de acceso de un proxy responde en lugar de LubeLogger, o su versión es
  demasiado antigua.
- Kilometraje o consumo incoherentes: compruebe la **Unidad de distancia**.
- Para más detalles en los registros de la integración, configure
  `LOG_LEVEL=debug`.

## Limitaciones

- Cada lectura hace siete peticiones, entre ellas la lista de todos los
  repostajes (para el consumo): mantenga un intervalo largo con un historial
  muy largo.
- La única escritura es la lectura del cuentakilómetros de la acción de escena;
  nunca se elimina nada.
- Los recordatorios «por fecha o kilometraje» no se pueden comparar entre sí: a
  igual urgencia, los que tienen fecha van antes que los de solo kilometraje.
- Sin relación con el proyecto LubeLogger.
