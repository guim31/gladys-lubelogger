// -----------------------------------------------------------------------------
// The "Upcoming maintenance" dashboard widget: two tiles (reminders past due,
// urgent reminders) and the list of the reminders, the most urgent first —
// of every vehicle, or of the one chosen in the widget settings.
// Read only: no button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { odometerUnit, parseVehicleId } from './devices.js';
import { WIDGET_KEY } from './hub.js';
import { URGENCY_TEXT, dueText } from './texts.js';

export const MAX_ITEMS = 8;

export const TEXT = {
  past_due: { en: 'Past due', fr: 'En retard', de: 'Überfällig', es: 'Vencidos' },
  urgent: { en: 'Urgent', fr: 'Urgents', de: 'Dringend', es: 'Urgentes' },
  nothing: {
    en: 'No maintenance reminder in LubeLogger.',
    fr: "Aucun rappel d'entretien dans LubeLogger.",
    de: 'Keine Wartungserinnerung in LubeLogger.',
    es: 'Ningún recordatorio de mantenimiento en LubeLogger.',
  },
  waiting: {
    en: 'Waiting for LubeLogger: check the configuration of the integration.',
    fr: "En attente de LubeLogger : vérifiez la configuration de l'intégration.",
    de: 'Warte auf LubeLogger: prüfe die Konfiguration der Integration.',
    es: 'Esperando a LubeLogger: compruebe la configuración de la integración.',
  },
};

const COLORS = {
  past_due: WIDGET_COLORS.DANGER,
  very_urgent: WIDGET_COLORS.DANGER,
  urgent: WIDGET_COLORS.WARNING,
  not_urgent: WIDGET_COLORS.INFO,
};

const pick = (table, language) => table[language] ?? table.en;
const cut = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

/** The reminders of the chosen vehicles, most urgent first, as card-list rows. */
export function reminderItems(vehicles, { language, distanceUnit, single }) {
  const urgency = pick(URGENCY_TEXT, language);
  return vehicles
    .flatMap((vehicle) => vehicle.reminders.map((reminder) => ({ vehicle, reminder })))
    .sort((a, b) => {
      const rank = (r) => ['past_due', 'very_urgent', 'urgent', 'not_urgent'].indexOf(r.urgency);
      const far = Number.MAX_SAFE_INTEGER;
      return (
        rank(a.reminder) - rank(b.reminder) ||
        (a.reminder.daysLeft ?? far) - (b.reminder.daysLeft ?? far) ||
        (a.reminder.distanceLeft ?? far) - (b.reminder.distanceLeft ?? far)
      );
    })
    .slice(0, MAX_ITEMS)
    .map(({ vehicle, reminder }) => {
      const due = dueText(reminder, odometerUnit(vehicle, distanceUnit), language);
      return {
        title: cut(reminder.description, 60),
        // One vehicle shown: its name would repeat on every row.
        subtitle: cut(single ? due : `${vehicle.name} · ${due}`, 60),
        badge: { text: cut(urgency[reminder.urgency], 16), color: COLORS[reminder.urgency] },
      };
    });
}

export function buildContent(hub, { settings = {}, language = 'en' } = {}) {
  const summary = hub.summary;
  if (!summary) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'body', text: pick(TEXT.waiting, language) }],
    };
  }
  const chosen = parseVehicleId(hub.gladys, settings.vehicle);
  const vehicles =
    chosen === null ? summary.vehicles : summary.vehicles.filter((v) => v.id === chosen);
  const pastDue = vehicles.reduce((sum, v) => sum + v.pastDue, 0);
  const urgent = vehicles.reduce((sum, v) => sum + v.urgent + v.veryUrgent, 0);
  const items = reminderItems(vehicles, {
    language,
    distanceUnit: hub.config.distanceUnit,
    single: chosen !== null,
  });
  return {
    // The hub nudges the widget after every read.
    ttl_seconds: 900,
    components: [
      {
        type: 'value',
        label: pick(TEXT.past_due, language),
        value: pastDue,
        icon: 'alert-triangle',
        color: pastDue > 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
      },
      {
        type: 'value',
        label: pick(TEXT.urgent, language),
        value: urgent,
        icon: 'tool',
        color: urgent > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      },
      items.length > 0
        ? { type: 'card-list', display: 'list', items }
        : { type: 'text', variant: 'caption', text: pick(TEXT.nothing, language) },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (hub, request) => buildContent(hub, request),
  },
};
