export type TournamentFormData = {
  name: string;
  schedule: string;
  tournamentType: string;
  playerSelection: 'system' | 'manual';
  eligibility: string;
};

export { default as TournamentOptionsModal } from './TournamentOptionsModal';
export { default as BecomeClubmasterModal } from './BecomeClubmasterModal';
export { default as InterClubTournamentModal } from './InterClubTournamentModal'; 