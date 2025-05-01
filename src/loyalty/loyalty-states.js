/**
 * États des conversations pour le programme de fidélité
 */

const LOYALTY_STATES = {
  NONE: 'loyalty_none',
  WAITING_FOR_PROGRAM_NAME: 'waiting_for_loyalty_program_name',
  WAITING_FOR_SUPPLY: 'waiting_for_loyalty_supply',
  WAITING_FOR_PHOTO: 'waiting_for_receipt_photo',
  WAITING_FOR_PROGRAM_SELECTION: 'waiting_for_loyalty_program_selection'
};

module.exports = { LOYALTY_STATES };
