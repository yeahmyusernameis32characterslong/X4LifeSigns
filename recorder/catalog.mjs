// Original listener selection. Vendor source is intentionally not distributed.
// All asset selectors checked against base X4 9.00 common.xsd objecteventsource.
const asset = [
  'event_object_attacked', 'event_object_attacked_object',
  'event_object_shield_damaged', 'event_object_hull_damaged', 'event_object_hull_repaired',
  'event_object_abandoned', 'event_object_changed_attention', 'event_object_changed_cluster',
  'event_object_changed_owner', 'event_object_changed_true_owner',
  'event_object_changed_sector', 'event_object_changed_zone', 'event_object_collected_ware',
  'event_object_commander_set', 'event_object_destroyed', 'event_object_docked',
  'event_object_docking_started', 'event_object_undocked', 'event_object_undocking_started',
  'event_object_killed_object', 'event_object_subordinate_added',
  'event_object_subordinate_removed', 'event_object_subordinate_promoted',
  'event_object_order_ready', 'event_object_order_cancelled', 'event_object_order_finished',
  'event_object_order_param_edited', 'event_object_production_started',
  'event_object_production_finished', 'event_object_production_cancelled',
  'event_object_built_ship', 'event_object_built_station',
  'event_control_entity_added', 'event_control_entity_removed'
];
const global = [
  'event_player_owned_attacked', 'event_player_owned_attacked_object',
  'event_player_owned_claimed_object', 'event_player_owned_dropped_objects',
  'event_player_owned_collected_resource', 'event_player_owned_destroyed',
  'event_player_owned_killed_object', 'event_player_owned_money_updated',
  'event_player_production_started', 'event_player_production_finished',
  'event_player_production_cancelled', 'event_player_trade_started',
  'event_player_trade_completed', 'event_player_trade_cancelled',
  'event_player_assigned_hired_actor', 'event_player_relation_changed',
  'event_player_money_updated'
];
export const catalog = Object.freeze([
  ...asset.map(event => ({ event, scope: 'assets' })),
  ...global.map(event => ({ event, scope: 'player' })),
  { event: 'event_object_destroyed', scope: 'observed_personnel' }
].map(Object.freeze));
export const levels = Object.freeze(['OFF', 'ERROR', 'WARNING', 'INFO', 'DEBUG']);
