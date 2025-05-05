# Clubmaster Chess Application

This is a Progressive Web App for the Clubmaster Chess platform. The app allows players to play chess games with various time controls, join tournaments, participate in clubs, and more.

## Core Chess Game Features

- Standard chessboard with pieces positioned according to chess rules
- Support for different player perspectives (white/black)
- Time controls (blitz, rapid, bullet)
- Move tracking and game replay
- Game options (draw offers, resignation, aborting)
- Game end conditions (checkmate, timeout, draws)

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```

## Project Structure

- `/src/app/components` - React components for the chess UI
- `/public/pieces` - SVG files for chess pieces

## Implementation Details

The chessboard is implemented using React components and styled with Tailwind CSS. The board automatically adjusts its orientation based on the player's perspective (white or black).

## Day 1 Deliverables

- [x] Project setup with Next.js and Tailwind CSS
- [x] Chessboard UI component
- [x] Chess pieces SVG implementation
- [x] Board orientation based on player perspective

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
