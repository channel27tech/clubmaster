import { PieceType, PieceColor, CapturedPiece, PlayerData } from './types';

// Mock data for players
export const player1: PlayerData = {
  username: "Asif",
  rating: 2850,
  clubAffiliation: "Oslo Chess Club",
  isGuest: false,
  capturedPieces: [
    { type: 'pawn', color: 'black', id: 'bp1' },
    { type: 'pawn', color: 'black', id: 'bp2' },
    { type: 'knight', color: 'black', id: 'bn1' }
  ]
};

export const player2: PlayerData = {
  username: "Basith",
  rating: 2780,
  clubAffiliation: "St. Louis Chess Club",
  isGuest: false,
  capturedPieces: [
    { type: 'pawn', color: 'white', id: 'wp1' },
    { type: 'bishop', color: 'white', id: 'wb1' }
  ]
};

export const guestPlayer: PlayerData = {
  username: "Guest123",
  isGuest: true,
  capturedPieces: []
}; 