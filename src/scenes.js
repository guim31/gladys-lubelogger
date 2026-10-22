// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): add an odometer reading (from the
// car's own integration, for instance) and read the state of a vehicle (for a
// message or a condition).
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  add_odometer(hub, { fields = {} }) {
    return hub.addOdometer(fields);
  },
  vehicle_status(hub, { fields = {} }) {
    return hub.vehicleStatus(fields);
  },
};
