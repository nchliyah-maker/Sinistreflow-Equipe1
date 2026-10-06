const { ConflictError } = require('./errors');

/**
 * Cycle de vie d'un dossier sinistre.
 * Validé avec le service Indemnisation (cf. docs/ARCHITECTURE.md).
 */
const STATUSES = [
  'DECLARE',
  'EN_INSTRUCTION',
  'EXPERTISE_EN_COURS',
  'EXPERTISE_TERMINEE',
  'ACCEPTE',
  'REFUSE',
  'INDEMNISE',
  'CLOS',
];

const TRANSITIONS = {
  DECLARE: ['EN_INSTRUCTION', 'REFUSE'],
  EN_INSTRUCTION: ['EXPERTISE_EN_COURS', 'ACCEPTE', 'REFUSE'],
  EXPERTISE_EN_COURS: ['EXPERTISE_TERMINEE'],
  EXPERTISE_TERMINEE: ['ACCEPTE', 'REFUSE'],
  ACCEPTE: ['INDEMNISE'],
  REFUSE: ['CLOS'],
  INDEMNISE: ['CLOS'],
  CLOS: [],
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function assertTransition(from, to) {
  if (!STATUSES.includes(to)) {
    throw new ConflictError(`Statut inconnu : ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new ConflictError(`Transition interdite : ${from} -> ${to}`);
  }
}

module.exports = { STATUSES, TRANSITIONS, canTransition, assertTransition };
