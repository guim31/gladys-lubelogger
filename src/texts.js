// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js).
// -----------------------------------------------------------------------------

// Feature names (frozen by Gladys at creation).
export const NAMES = {
  en: {
    odometer: 'Odometer',
    hours: 'Engine hours',
    consumption: 'Average consumption',
    month_cost: 'Cost this month',
    next_reminder: 'Next reminder',
    past_due: 'Reminders past due',
    urgent: 'Urgent reminders',
  },
  fr: {
    odometer: 'Kilométrage',
    hours: 'Heures moteur',
    consumption: 'Consommation moyenne',
    month_cost: 'Coût du mois',
    next_reminder: 'Prochain rappel',
    past_due: 'Rappels en retard',
    urgent: 'Rappels urgents',
  },
  de: {
    odometer: 'Kilometerstand',
    hours: 'Betriebsstunden',
    consumption: 'Durchschnittsverbrauch',
    month_cost: 'Kosten diesen Monat',
    next_reminder: 'Nächste Erinnerung',
    past_due: 'Überfällige Erinnerungen',
    urgent: 'Dringende Erinnerungen',
  },
  es: {
    odometer: 'Kilometraje',
    hours: 'Horas de motor',
    consumption: 'Consumo medio',
    month_cost: 'Coste del mes',
    next_reminder: 'Próximo recordatorio',
    past_due: 'Recordatorios vencidos',
    urgent: 'Recordatorios urgentes',
  },
};

// The text feature when no reminder is set.
export const NONE = { en: 'None', fr: 'Aucun', de: 'Keine', es: 'Ninguno' };

// The urgency of a reminder, as LubeLogger shows it.
export const URGENCY_TEXT = {
  en: {
    past_due: 'Past due',
    very_urgent: 'Very urgent',
    urgent: 'Urgent',
    not_urgent: 'Not urgent',
  },
  fr: {
    past_due: 'En retard',
    very_urgent: 'Très urgent',
    urgent: 'Urgent',
    not_urgent: 'Pas urgent',
  },
  de: {
    past_due: 'Überfällig',
    very_urgent: 'Sehr dringend',
    urgent: 'Dringend',
    not_urgent: 'Nicht dringend',
  },
  es: {
    past_due: 'Vencido',
    very_urgent: 'Muy urgente',
    urgent: 'Urgente',
    not_urgent: 'No urgente',
  },
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: sieh dir ihre Protokolle an.',
  es: 'La integración no pudo iniciarse: consulte sus registros.',
};

// The connection status shown in the Configuration screen.
export const STATUS_TEXT = {
  en: {
    none: 'Enter the address of LubeLogger.',
    invalid: 'The LubeLogger address is not valid (http or https, without user name in it).',
    unreachable: 'LubeLogger does not answer: check its address and that it is running.',
    unauthorized: 'Access refused: check the API key, or the user name and password.',
    invalid_answer:
      'This address does not answer like LubeLogger 1.5.9 or later (a proxy login page?).',
  },
  fr: {
    none: "Saisissez l'adresse de LubeLogger.",
    invalid:
      "L'adresse de LubeLogger n'est pas valide (http ou https, sans nom d'utilisateur dedans).",
    unreachable: 'LubeLogger ne répond pas : vérifiez son adresse et qu’il est démarré.',
    unauthorized:
      "Accès refusé : vérifiez la clé d'API, ou le nom d'utilisateur et le mot de passe.",
    invalid_answer:
      'Cette adresse ne répond pas comme LubeLogger 1.5.9 ou plus récent (page de connexion d’un proxy ?).',
  },
  de: {
    none: 'Gib die Adresse von LubeLogger ein.',
    invalid: 'Die LubeLogger-Adresse ist ungültig (http oder https, ohne Benutzername darin).',
    unreachable: 'LubeLogger antwortet nicht: prüfe die Adresse und ob es läuft.',
    unauthorized: 'Zugriff verweigert: prüfe den API-Schlüssel, oder Benutzername und Passwort.',
    invalid_answer:
      'Diese Adresse antwortet nicht wie LubeLogger 1.5.9 oder neuer (Anmeldeseite eines Proxys?).',
  },
  es: {
    none: 'Introduzca la dirección de LubeLogger.',
    invalid: 'La dirección de LubeLogger no es válida (http o https, sin nombre de usuario).',
    unreachable: 'LubeLogger no responde: compruebe su dirección y que esté en marcha.',
    unauthorized:
      'Acceso denegado: compruebe la clave de API, o el nombre de usuario y la contraseña.',
    invalid_answer:
      'Esta dirección no responde como LubeLogger 1.5.9 o posterior (¿página de acceso de un proxy?).',
  },
};

// The "Test the connection" action.
export const TEST_TEXT = {
  en: (version, vehicles, reminders) =>
    `LubeLogger ${version} answers: ${vehicles} vehicle(s), ${reminders} reminder(s).`,
  fr: (version, vehicles, reminders) =>
    `LubeLogger ${version} répond : ${vehicles} véhicule(s), ${reminders} rappel(s).`,
  de: (version, vehicles, reminders) =>
    `LubeLogger ${version} antwortet. Fahrzeuge: ${vehicles}, Erinnerungen: ${reminders}.`,
  es: (version, vehicles, reminders) =>
    `LubeLogger ${version} responde: ${vehicles} vehículo(s), ${reminders} recordatorio(s).`,
};

// Errors of the scene actions.
export const COMMAND_ERRORS = {
  en: {
    vehicle: 'Choose a vehicle of LubeLogger.',
    odometer: 'Enter the odometer reading, a positive number.',
    lower: 'This reading is below the last one in LubeLogger: not added.',
    jump: 'This reading is over 10,000 above the last one in LubeLogger: not added.',
    forbidden: 'LubeLogger refused the write: the API key needs the Edit permission.',
    unreachable: 'LubeLogger does not answer: nothing could be read or written.',
    refused: 'LubeLogger refused the reading: see the logs of the integration.',
  },
  fr: {
    vehicle: 'Choisissez un véhicule de LubeLogger.',
    odometer: 'Saisissez le relevé du compteur, un nombre positif.',
    lower: 'Ce relevé est inférieur au dernier connu de LubeLogger : non ajouté.',
    jump: 'Ce relevé dépasse de plus de 10 000 le dernier connu de LubeLogger : non ajouté.',
    forbidden: "LubeLogger a refusé l'écriture : la clé d'API doit avoir le droit Edit.",
    unreachable: "LubeLogger ne répond pas : rien n'a pu être lu ni écrit.",
    refused: "LubeLogger a refusé le relevé : consultez les journaux de l'intégration.",
  },
  de: {
    vehicle: 'Wähle ein Fahrzeug aus LubeLogger.',
    odometer: 'Gib den Kilometerstand ein, eine positive Zahl.',
    lower: 'Dieser Stand liegt unter dem letzten in LubeLogger: nicht hinzugefügt.',
    jump: 'Dieser Stand liegt über 10.000 über dem letzten in LubeLogger: nicht hinzugefügt.',
    forbidden: 'LubeLogger hat das Schreiben abgelehnt: der API-Schlüssel braucht das Recht Edit.',
    unreachable: 'LubeLogger antwortet nicht: nichts konnte gelesen oder geschrieben werden.',
    refused: 'LubeLogger hat den Stand abgelehnt: sieh dir die Protokolle der Integration an.',
  },
  es: {
    vehicle: 'Elija un vehículo de LubeLogger.',
    odometer: 'Introduzca la lectura del cuentakilómetros, un número positivo.',
    lower: 'Esta lectura es inferior a la última de LubeLogger: no se ha añadido.',
    jump: 'Esta lectura supera en más de 10.000 la última de LubeLogger: no se ha añadido.',
    forbidden: 'LubeLogger rechazó la escritura: la clave de API necesita el permiso Edit.',
    unreachable: 'LubeLogger no responde: no se pudo leer ni escribir nada.',
    refused: 'LubeLogger rechazó la lectura: consulte los registros de la integración.',
  },
};

/** { en, fr, de, es } of a coded command error. */
export function commandMessage(code) {
  return Object.fromEntries(
    Object.entries(COMMAND_ERRORS).map(([language, table]) => [language, table[code]]),
  );
}

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
const locale = (language) => LOCALES[language] ?? LOCALES.en;

/** "2026-10-29" -> "29/10/2026" (fr), "29.10.2026" (de)... */
export function formatDay(day, language) {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

// The unit after an odometer value: "km", "mi", or "h" for hour meters.
export const DISTANCE_SYMBOL = { km: 'km', mi: 'mi', hours: 'h' };

/** 45000 -> "45 000 km" (fr), "45.000 km" (de)... */
export function formatDistance(value, unit, language) {
  const text = new Intl.NumberFormat(locale(language), { maximumFractionDigits: 0 }).format(value);
  // A plain space: the narrow no-break space of some locales reads badly in a log.
  return `${text.replace(/[\u202f\u00a0]/g, ' ')} ${DISTANCE_SYMBOL[unit] ?? unit}`;
}

const OR = { en: 'or', fr: 'ou', de: 'oder', es: 'o' };

/** When a reminder is due: its date, its odometer, or both ("whichever first"). */
export function dueText(reminder, unit, language) {
  const parts = [];
  if (reminder.dueDate) {
    parts.push(formatDay(reminder.dueDate, language));
  }
  if (reminder.dueOdometer !== null) {
    parts.push(formatDistance(reminder.dueOdometer, unit, language));
  }
  return parts.join(` ${OR[language] ?? OR.en} `);
}

// A short symbol for the widget tile unit (6 characters at most).
export const currencySymbol = (symbol) => String(symbol ?? '').slice(0, 6);
